"""Acting on a scene: render, QA, listen, approve, decline.

Everything here either runs a model or writes a verdict, which is why it is separate from
`scenes.py` — those are document edits and return in milliseconds. The endpoints wrap exactly
the operations `atlas-listening scene render` and `scene qa` wrap, with the same gates in the
same order, because two surfaces that disagree about when the fake engine is allowed is how a
test take reaches a learner.

**Approval is the one thing in this file that is not a wrapper.** It is the human signature, and
it is bound to the exact bytes the reviewer heard: the request must name the sha256 of the master
it is approving, and a mismatch is refused. Until 2026-08-02 the dialogue approval recorded who
and when but nothing about the audio, so a WAV regenerated after approval was published carrying
an approval that never covered it — `cli.verify_approval` exists because of that, and this
endpoint keeps its discipline on the request side, before anything is stored.
"""

from __future__ import annotations

import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..adapters import ENGINES, SOUND_ENGINES, engine_for, sound_engine_for
from ..domain import Stage
from ..export import sha256
from ..generative.fake import FakeSound
from ..generative.gateway import SoundGenerator, SpeechGenerator
from ..generative.locks import set_models_root
from ..generative.voices import ResolvedVoices, resolve_voices
from ..graph.render import render_scene
from ..graph.scene_qa import scene_qa
from ..scene.model import Scene
from ..scene.publish import (
    PUBLISHED_VARIANT,
    PublishRefusal,
    default_backup_root,
    plan_publish,
    stage_publish,
    write_publish,
)
from ..storage import Store, remember_editor

#: One transcription of one file. The seam `graph.scene_qa` already defines and documents: the
#: real implementation is MLX Whisper and macOS-local, so the tests inject a fake and run in an
#: environment that has never seen torch — which is precisely what CI is.
Transcriber = Callable[[Path], str]

#: What a human certifies when they approve a scene, key by key — **and this is its one home.**
#:
#: Until PR 9b the same eight keys were also declared in `ui.py`, which stated each of them as a
#: full German sentence for the HTML approval form, and `tests/test_api_scenes.py` held the two
#: lists equal. `ui.py` is deleted; the sentences moved to Tonwerk, which is the surface that
#: speaks German, and this tuple is the vocabulary they are keyed on. A Tonwerk checklist that
#: drifted from it does not fail silently: an unknown key is refused with the vocabulary named,
#: and a missing required one is refused with the missing keys named.
#:
#: The keys are written verbatim into the published provenance manifest, so they are fixed and
#: must never be renamed; only the wording beside them moves.
APPROVAL_CHECKLIST: tuple[str, ...] = (
    "accent",
    "naturalness",
    "intelligibility",
    "identity",
    "speakers",
    "pace",
    "questions",
    "context",
)


#: What a render artifact is served as. Read off the suffix rather than guessed by `mimetypes`,
#: which answers `audio/x-wav` on some platforms and nothing at all for a suffix it has not been
#: taught — and a browser handed `application/octet-stream` for a WAV downloads it instead of
#: playing it.
MEDIA_TYPES = {
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".mp3": "audio/mpeg",
    ".json": "application/json",
}


class RenderRequest(BaseModel):
    variant: str = "natural"
    #: `stable_audio_sfx` or `fake`. Absent means *no generator*, and a scene that asks for a
    #: `SoundSpec` is then refused rather than rendered silently without it — the renderer's
    #: rule, not this endpoint's.
    sound_engine: str | None = None


class QARequest(BaseModel):
    variant: str = "natural"


class ApprovalRequest(BaseModel):
    """The signature: who, on which bytes, having certified what."""

    editor: str = Field(min_length=1)
    #: The sha256 of the master the reviewer actually listened to. Not decoration and not
    #: derivable server-side: a client that fetched the audio, played it and then approved a
    #: *different* render is the failure this field exists to make impossible.
    master_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    checklist: list[str] = Field(min_length=1)
    variant: str = "natural"


class PublishRequest(BaseModel):
    """What a publish may be told, and the two things it may not.

    `variant` is present rather than absent so that asking for a difficulty rendering is *refused
    by name* instead of quietly publishing the natural one — a request nobody would see in a diff.

    `level` exists for the scene that has no brief to read one off. It **overrides** the brief when
    both are present, which is why every surface prints the level it resolved before it writes:
    an artifact filed under the wrong level fails `bun run validate` in three places at once, and
    a silent override is how it would get there.
    """

    #: Where a scene with no brief goes. `None` means "read it off the brief, or refuse".
    level: str | None = None
    variant: str = PUBLISHED_VARIANT
    #: Stage every byte, report where each would land, write nothing.
    dry_run: bool = False


class DeclineRequest(BaseModel):
    reason: str = Field(min_length=8)
    editor: str | None = None


def _speech_engines(
    scene: Scene, allow_test_adapters: bool, resolved: ResolvedVoices
) -> dict[str, SpeechGenerator]:
    """One engine per engine name the cast uses, with the same fake-engine gate as the CLI.

    There is no engine override on this endpoint. `scene render --engine` exists so a scene can
    be smoke-rendered on the fake engine from a shell; over HTTP the cast is the record of what
    this scene is synthesized with, and letting a request replace it would mean the stored scene
    and the audio under its sha disagree about which model produced it.

    `resolved` is every stored voice the cast names, looked up before this point. It is handed to
    the engine rather than fetched by it — the store, the app-data root and the revocation check
    stay on this side of `generative/`.
    """

    names = sorted({member.voice.engine for member in scene.cast})
    unknown = [name for name in names if name not in ENGINES]
    if unknown:
        raise HTTPException(
            409,
            f"this scene is cast on unknown engine(s) {', '.join(unknown)}; "
            f"known: {', '.join(sorted(ENGINES))}",
        )
    fake = sorted(name for name in names if name.startswith("fake"))
    if fake and not allow_test_adapters:
        raise HTTPException(
            409,
            f"this scene is cast on the {', '.join(fake)} engine(s); they render no real audio",
        )
    return {name: engine_for(name, resolved.clonable) for name in names}


def _resolved_voices(store: Store, scene: Scene) -> ResolvedVoices:
    """The stored voices this cast names, or a 409 saying which one is missing or withdrawn.

    409 rather than 400: the request is well formed and the *machine* cannot answer it — either
    this studio has never had the voice, or consent for it was withdrawn. Both are conflicts with
    the state of the store, which is what the render endpoint's other 409s already mean.
    """

    ids = [member.voice.voice_ref for member in scene.cast if member.voice.voice_ref]
    try:
        return resolve_voices(store, store.root, ids)
    except ValueError as error:
        raise HTTPException(409, str(error)) from error


def _sound_engine(name: str | None, allow_test_adapters: bool) -> SoundGenerator | None:
    if name is None:
        # No name means no generator — except under the test gate, where the fake one keeps
        # dealing, which is what `scene render --test-adapter` does and what every workflow test
        # written before `--sound-engine` existed expects.
        return FakeSound() if allow_test_adapters else None
    if name not in SOUND_ENGINES:
        raise HTTPException(
            400, f"unknown sound engine {name}; known: {', '.join(sorted(SOUND_ENGINES))}"
        )
    if name == "fake" and not allow_test_adapters:
        raise HTTPException(409, "the fake sound engine renders a tone, not a sound")
    return sound_engine_for(name)


def _required_checks(scene: Scene, has_exercise: bool) -> set[str]:
    """Which of the eight a reviewer must certify for *this* scene.

    Two of them are conditional, and both would otherwise be a signature on something that does
    not exist. `context` is about background sound masking a syllable, so it applies only to a
    scene that has non-speech material; `questions` is about the answer key, so it applies only
    to a scene that carries an exercise. The legacy dialogue form made the same `context`
    decision — it certified `context` only when the payload had context sounds — and could not
    make the `questions` one, because a `RevisionPayload` always had questions.
    """

    conditional = {"context", "questions"}
    required = {key for key in APPROVAL_CHECKLIST if key not in conditional}
    if any(entry.type in {"ambience", "sfx"} for entry in scene.timeline):
        required.add("context")
    if has_exercise:
        required.add("questions")
    return required


def router(
    store: Store,
    repo: Path,
    *,
    allow_test_adapters: bool = False,
    transcribe_fn: Transcriber | None = None,
) -> APIRouter:
    api = APIRouter(prefix="/api", tags=["workflow"])

    def stored(slug: str) -> tuple[Any, Any, Scene, Any]:
        found = store.get_scene_by_slug(slug)
        if found is None:
            raise HTTPException(404, f"no scene project {slug}")
        return found

    def render_dir(scene: Scene, variant: str) -> Path:
        return store.root / "renders" / scene.sha256() / variant

    @api.post("/scenes/{slug}/render")
    def render(slug: str, request: RenderRequest) -> dict[str, Any]:
        project, revision, scene, _ = stored(slug)
        resolved = _resolved_voices(store, scene)
        speech = _speech_engines(scene, allow_test_adapters, resolved)
        sound = _sound_engine(request.sound_engine, allow_test_adapters)
        # The repository this server was started against is where `.models/` is looked for.
        set_models_root(repo)
        try:
            result = render_scene(
                scene,
                store.root,
                variant=request.variant,
                speech_engines=speech,
                voices=resolved.refs,
                sound_engine=sound,
                repo=repo,
            )
        except ValueError as error:
            # An unknown variant, an unknown room/device/preset id, or a `SoundSpec` with no
            # generator. All three are the caller asking for something this scene and this
            # repository cannot produce — a conflict, not a server fault, and nothing failed.
            raise HTTPException(409, str(error)) from error
        except Exception as error:
            # The engine itself fell over. Recorded, then reported as itself.
            #
            # This is the dialogue pipeline's rule, moved to the path that still exists: there is
            # no second engine to revise the scene onto, and a synthesis failure was never
            # evidence that the script needed rewriting. So the project stays exactly where it
            # was and the failure is written down beside the render it was trying to produce —
            # under the scene sha, so a failure and the audio it failed to make share an address.
            names = "-".join(sorted(speech)) or "render"
            directory = render_dir(scene, request.variant)
            directory.mkdir(parents=True, exist_ok=True)
            (directory / f"{names}-failure-rev-{revision.number}.json").write_text(
                json.dumps(
                    {
                        "slug": scene.slug,
                        "scene_sha256": scene.sha256(),
                        "variant": request.variant,
                        # One entry per engine the cast uses: a scene can be cast across two, and
                        # "which model revision was this" is the first question a failure raises.
                        "engines": {name: engine.revision for name, engine in speech.items()},
                        "sound_engine": request.sound_engine,
                        "failed_at": datetime.now(UTC).isoformat(),
                        "error_type": type(error).__name__,
                        "message": str(error),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            raise HTTPException(
                409, f"{names} failed and the failure was recorded: {error}"
            ) from error

        stage = Stage(project.stage)
        if stage == Stage.DRAFT:
            store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
            stage = Stage.VALIDATED
        if stage == Stage.VALIDATED:
            store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
            stage = Stage.AUDIO_GENERATED
        # Anything later is left alone. A re-render of unchanged bytes is a cache walk, and
        # dropping a QA report or an approval because someone re-ran it would be a workflow
        # regression, not a safety measure — the scene sha is in the render path, so a *changed*
        # scene is a new render.

        return {
            "slug": scene.slug,
            "revision": revision.number,
            "scene_sha256": revision.scene_sha256,
            "stage": str(stage),
            "variant": result.variant,
            "duration_ms": result.duration_ms,
            "nodes_evaluated": result.nodes_evaluated,
            "nodes_cached": result.nodes_cached,
            "artifacts": [
                {
                    "path": str(row.path.relative_to(result.directory).as_posix()),
                    "sha256": row.sha256,
                    "kind": row.kind,
                }
                for row in result.artifacts
            ],
        }

    @api.post("/scenes/{slug}/qa")
    def qa(slug: str, request: QARequest) -> dict[str, Any]:
        project, revision, scene, _ = stored(slug)
        directory = render_dir(scene, request.variant)
        if not (directory / "render.json").exists():
            raise HTTPException(
                409,
                f"{scene.slug} has no {request.variant} render of these bytes; render it first",
            )
        if Stage(project.stage) != Stage.AUDIO_GENERATED:
            raise HTTPException(
                409, f"this scene is at {project.stage}; QA runs on {Stage.AUDIO_GENERATED}"
            )
        set_models_root(repo)
        transcriber = transcribe_fn
        if transcriber is None:
            # Imported at call time, not at module scope: the real transcriber is MLX Whisper,
            # macOS-local, and every other endpoint in this file has to keep working without it.
            from ..adapters import transcribe as transcriber_impl

            transcriber = transcriber_impl
        try:
            report = scene_qa(scene, directory, transcribe_fn=transcriber)
        except RuntimeError as error:
            # `adapters.transcribe` raises this when the pinned MLX Whisper adapter is not
            # installed. Said once, clearly, rather than as a 500 with an ImportError in it: on
            # a machine without the ASR runtime this is the expected answer, not a fault.
            raise HTTPException(
                409, f"scene QA needs the local MLX Whisper runtime, which is not available: {error}"
            ) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        store.transition_scene(
            project.id, Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, qa=report
        )
        return {
            "slug": scene.slug,
            "revision": revision.number,
            "scene_sha256": revision.scene_sha256,
            "stage": str(Stage.AUTOMATICALLY_CHECKED),
            "variant": request.variant,
            "passed": report["passed"],
            "qa": report,
        }

    @api.get("/scenes/{slug}/renders/{variant}/master")
    def master(slug: str, variant: str) -> FileResponse:
        _, _, scene, _ = stored(slug)
        target = render_dir(scene, variant) / "master.wav"
        if not target.exists():
            raise HTTPException(404, f"{scene.slug} has no {variant} master of these bytes")
        return FileResponse(
            target, media_type="audio/wav", filename=f"{scene.slug}-{variant}.wav"
        )

    @api.get("/scenes/{slug}/renders/{variant}/artifact/{path:path}")
    def artifact(slug: str, variant: str, path: str) -> FileResponse:
        """Any one file this render **declared it wrote** — a stem, the dry mix, the QA cut.

        The master has its own route because it is the thing a reviewer plays; this is what makes
        the rest audible, so a mix can be taken apart one voice at a time instead of being judged
        only as a whole.

        **The allowlist is the manifest, never the filesystem.** `render.json` lists every artifact
        the run produced, and a path that is not in that list is a 404 *whether or not a file of
        that name exists* — which is what makes `../../db.sqlite3` unremarkable here rather than a
        traversal to defend against with string checks. Two 404s are kept apart for the same
        reason a QA report for another variant is: not declared, and declared but missing from
        disk, are different failures and need different fixes.
        """

        _, _, scene, _ = stored(slug)
        directory = render_dir(scene, variant)
        manifest = directory / "render.json"
        if not manifest.exists():
            raise HTTPException(404, f"{scene.slug} has no {variant} render of these bytes")
        declared = {
            str(row.get("path"))
            for row in json.loads(manifest.read_text()).get("artifacts", [])
            if isinstance(row, dict)
        }
        if path not in declared:
            raise HTTPException(404, f"{path} is not an artifact of this render")
        target = directory / path
        if not target.is_file():
            raise HTTPException(404, f"{path} is declared by this render but is not on disk")
        return FileResponse(
            target,
            media_type=MEDIA_TYPES.get(target.suffix.lower(), "application/octet-stream"),
            filename=f"{scene.slug}-{variant}-{target.name}",
        )

    @api.get("/scenes/{slug}/renders/{variant}/qa-report")
    def qa_report(slug: str, variant: str) -> dict[str, Any]:
        """The stored QA report, when it is a report about *this* variant.

        One report is stored per revision, and it names the variant it ran on. Serving it under
        another variant's URL would answer "did the challenging mix pass" with the natural mix's
        numbers, which is worse than answering nothing.
        """

        _, revision, scene, _ = stored(slug)
        if not revision.qa_json:
            raise HTTPException(404, f"{scene.slug} has no QA report for this revision")
        report: dict[str, Any] = json.loads(revision.qa_json)
        if report.get("variant") != variant:
            raise HTTPException(
                404,
                f"the stored QA report is for variant {report.get('variant')}, not {variant}",
            )
        return report

    @api.post("/scenes/{slug}/approve")
    def approve(slug: str, request: ApprovalRequest) -> dict[str, Any]:
        project, revision, scene, exercise = stored(slug)
        if Stage(project.stage) != Stage.AUTOMATICALLY_CHECKED:
            raise HTTPException(
                409, f"this scene is at {project.stage}; approval follows automatic QA"
            )
        report = json.loads(revision.qa_json or "{}")
        if report.get("passed") is not True:
            raise HTTPException(409, "automatic QA failed; revise or re-render before approval")
        if report.get("variant") != request.variant:
            raise HTTPException(
                409,
                f"the passing QA report is for variant {report.get('variant')}, "
                f"not {request.variant}",
            )
        # startswith, not equality: fake_clone is as much a test engine as fake, and a guard
        # naming one engine exactly is a guard the next test engine walks past.
        if any(
            member.voice.engine.startswith("fake") for member in scene.cast
        ) and not allow_test_adapters:
            raise HTTPException(409, "test audio cannot be approved")

        directory = render_dir(scene, request.variant)
        final = directory / "master.wav"
        if not final.exists():
            raise HTTPException(409, "there is no master of these bytes to approve")
        actual = sha256(final)
        if actual != request.master_sha256:
            # The reviewer approved audio this project does not have. Either they listened to a
            # render that has since been replaced, or they are approving a different variant —
            # both mean the signature would vouch for bytes nobody in this exchange heard.
            raise HTTPException(
                409,
                f"the master of {scene.slug} {request.variant} is {actual}, "
                f"not the {request.master_sha256} this approval names — "
                "re-listen to the current render before approving it",
            )

        certified = set(request.checklist)
        unknown = sorted(certified - set(APPROVAL_CHECKLIST))
        if unknown:
            raise HTTPException(
                400,
                f"unknown checklist key(s) {', '.join(unknown)}; "
                f"the vocabulary is {', '.join(APPROVAL_CHECKLIST)}",
            )
        missing = sorted(_required_checks(scene, exercise is not None) - certified)
        if missing:
            raise HTTPException(
                400, f"this approval does not certify {', '.join(missing)}"
            )

        editor = request.editor.strip()
        if not editor:
            raise HTTPException(400, "an approval needs the name of the person giving it")
        remember_editor(store.root, editor)
        dry = directory / "dry.wav"
        approval: dict[str, object] = {
            "status": "complete",
            "editor": editor,
            "reviewed_at": datetime.now(UTC).isoformat(),
            "checklist": sorted(certified),
            "audio_sha256": actual,
            "dry_audio_sha256": sha256(dry) if dry.exists() else None,
            # A scene has variants and a `RevisionPayload` did not, so the legacy approval shape
            # gains exactly these two fields: without them an approval names bytes but not which
            # rendering of which document produced them.
            "scene_sha256": scene.sha256(),
            "variant": request.variant,
        }
        store.transition_scene(
            project.id, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED, approval=approval
        )
        return {
            "slug": scene.slug,
            "revision": revision.number,
            "stage": str(Stage.HUMAN_APPROVED),
            "approval": approval,
        }

    @api.post("/scenes/{slug}/publish")
    def publish(slug: str, request: PublishRequest) -> dict[str, Any]:
        """Write one approved scene into the course repository, or say which gate refused.

        Every refusal is a **409 naming its gate**, because the client's next move differs per
        gate and a sentence is not something a UI can branch on: `voice-scope` sends the editor to
        Figuren, `approval-master-sha` sends them back to Freigabe, `exercise-turns` sends them to
        the exercise set. The gate ids are `scene.publish`'s and are listed in that module.

        `dry_run` stages every byte and stops before the rename, so what it reports is what a real
        publish would put where — the same plan object, not a second description of it.

        The backup goes under **app-data**, not under the repository: a backup inside the tree
        being published to is a file the next `bun run validate` has to be taught to ignore.
        """

        try:
            plan = plan_publish(store, repo, slug, level=request.level, variant=request.variant)
        except PublishRefusal as refusal:
            raise HTTPException(
                409, {"gate": refusal.gate, "detail": refusal.detail}
            ) from refusal
        answer: dict[str, Any] = {
            "slug": plan.slug,
            "level": plan.level,
            "variant": plan.variant,
            "scene_sha256": plan.scene_sha256,
            "dry_run": request.dry_run,
            "files": plan.files(),
            "replaces": [path.as_posix() for path in plan.replaces],
            "claims": plan.manifest["claims"],
            "duration_seconds": plan.artifact["duration_seconds"],
        }
        if request.dry_run:
            with tempfile.TemporaryDirectory(prefix="scene-publish-dry-") as staging:
                answer["staged"] = [
                    target.as_posix() for _, target in stage_publish(plan, Path(staging))
                ]
            return answer
        backup = default_backup_root(store.root, plan.slug) if plan.replaces else None
        try:
            written = write_publish(plan, repo, backup_root=backup)
        except PublishRefusal as refusal:
            raise HTTPException(
                409, {"gate": refusal.gate, "detail": refusal.detail}
            ) from refusal
        project, _, _, _ = stored(slug)
        store.transition_scene(project.id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
        answer["written"] = [str(path) for path in written]
        answer["stage"] = str(Stage.EXPORTED)
        answer["backup"] = str(backup) if backup else None
        return answer

    @api.post("/scenes/{slug}/decline")
    def decline(slug: str, request: DeclineRequest) -> dict[str, Any]:
        project, revision, scene, _ = stored(slug)
        if Stage(project.stage) == Stage.DRAFT:
            raise HTTPException(409, "this scene is already a draft; there is no take to decline")
        if Stage(project.stage) == Stage.EXPORTED:
            raise HTTPException(409, "this scene is published; declining it is a republication")
        record: dict[str, object] = {
            "status": "declined",
            "editor": (request.editor or "").strip() or None,
            "reviewed_at": datetime.now(UTC).isoformat(),
            "reason": request.reason.strip(),
            "scene_sha256": scene.sha256(),
        }
        store.decline_scene(project.id, record)
        return {
            "slug": scene.slug,
            "revision": revision.number,
            "stage": str(Stage.DRAFT),
            "decline": record,
        }

    return api
