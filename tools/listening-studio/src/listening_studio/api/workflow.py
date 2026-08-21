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
from ..graph.render import render_scene
from ..graph.scene_qa import scene_qa
from ..scene.model import Scene
from ..storage import Store, remember_editor

#: One transcription of one file. The seam `graph.scene_qa` already defines and documents: the
#: real implementation is MLX Whisper and macOS-local, so the tests inject a fake and run in an
#: environment that has never seen torch — which is precisely what CI is.
Transcriber = Callable[[Path], str]

#: What a human certifies when they approve a scene, key by key.
#:
#: These are the same eight keys `ui.APPROVAL_CHECKS` states in full German sentences, and they
#: are deliberately re-declared here rather than imported: `ui.py` is the legacy HTML surface and
#: is deleted once the desktop app reaches parity, and the API must not be what keeps it alive.
#: `tests/test_api_scenes.py` holds the two lists equal so the duplication cannot drift, and so
#: that deletion is a one-line change to that test rather than a silent loss of a checklist key.
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


class DeclineRequest(BaseModel):
    reason: str = Field(min_length=8)
    editor: str | None = None


def _speech_engines(scene: Scene, allow_test_adapters: bool) -> dict[str, SpeechGenerator]:
    """One engine per engine name the cast uses, with the same fake-engine gate as the CLI.

    There is no engine override on this endpoint. `scene render --engine` exists so a scene can
    be smoke-rendered on the fake engine from a shell; over HTTP the cast is the record of what
    this scene is synthesized with, and letting a request replace it would mean the stored scene
    and the audio under its sha disagree about which model produced it.
    """

    names = sorted({member.voice.engine for member in scene.cast})
    unknown = [name for name in names if name not in ENGINES]
    if unknown:
        raise HTTPException(
            409,
            f"this scene is cast on unknown engine(s) {', '.join(unknown)}; "
            f"known: {', '.join(sorted(ENGINES))}",
        )
    if "fake" in names and not allow_test_adapters:
        raise HTTPException(409, "this scene is cast on the fake engine; it renders no real audio")
    return {name: engine_for(name) for name in names}


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
    decision (`web.py`: `certified.add("context")` only when there were context sounds) and could
    not make the `questions` one, because a `RevisionPayload` always had questions.
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
        speech = _speech_engines(scene, allow_test_adapters)
        sound = _sound_engine(request.sound_engine, allow_test_adapters)
        # The repository this server was started against is where `.models/` is looked for.
        set_models_root(repo)
        try:
            result = render_scene(
                scene,
                store.root,
                variant=request.variant,
                speech_engines=speech,
                sound_engine=sound,
                repo=repo,
            )
        except ValueError as error:
            # An unknown variant, an unknown room/device/preset id, or a `SoundSpec` with no
            # generator. All three are the caller asking for something this scene and this
            # repository cannot produce — a conflict, not a server fault.
            raise HTTPException(409, str(error)) from error

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
        if any(member.voice.engine == "fake" for member in scene.cast) and not allow_test_adapters:
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
