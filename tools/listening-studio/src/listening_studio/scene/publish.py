"""Publishing one approved scene into the course repository.

The legacy publisher (`export.write_bundle` + `cli.publish`) writes a **bundle** — eighteen files,
two PDFs, a zip — and then copies five of them into the repo. This one writes what the repo needs
and nothing else, because a scene already *is* the editorial document the bundle existed to carry:

| Target | What it is |
| --- | --- |
| `content/listening/<level>/<id>.yaml` | the artifact record (`listeningArtifactSchema`) |
| `content/listening/<level>/<id>.mp3` | the render's own `publish.mp3` |
| `data/audio-provenance/<level>/<id>.json` | the scene-native manifest, version 2 |
| `data/prompts/<date>-<id>-listening.md` | the generation brief |

The fourth is not in the brief for this publisher and is written anyway, for one measured reason:
`scripts/validate.ts` fails a listening artifact whose provenance names no resolvable
`generation_brief`, so a publisher that skipped it would leave the repository invalid. It is
derived from the **scene's own** `authoring`/`generation_prompt` — the three branches
`export.write_bundle` uses — and never reconstructed from the finished script.

**Every field of every target is derived from the scene and the render.** Nothing is read out of
the artifact record already in the repository: a publisher that copied a field forward would keep
publishing the old answer after the scene stopped agreeing with it, and no gate here or in the
course repo can see that. Where a target wants something a scene genuinely lacks, the publish is
refused by name rather than filled in — see `PublishRefusal` and the gate table below.

**The gates, each with its own name.** A refusal names the gate so a caller can act on it rather
than parse a sentence, and Tonwerk can render German for a gate id it knows:

| Gate | Refuses |
| --- | --- |
| `scene` | no scene project under this slug |
| `kind` | a `narration`/`custom` scene — `content/listening/` is the dialogue path |
| `variant` | any variant but `natural`; the others are rendered, never published |
| `stage` | a scene that is not `human_approved` |
| `approval` | a missing approval, or one that is a decline |
| `approval-scene-sha` | an approval given for other scene bytes |
| `approval-variant` | an approval given for another variant |
| `approval-master-sha` | an approval whose master sha is not this render's master |
| `render` | no render of these bytes, or one missing an artifact |
| `render-drift` | a render whose files no longer hash to what its manifest declares |
| `qa` | no QA report, or one that did not pass |
| `level` | a level that cannot be derived and was not given |
| `brief` | no scenario — only the brief carries one |
| `speakers` | a cast outside the 1–4 the artifact schema allows |
| `voice-unknown` | a cast voice reference this studio does not have |
| `voice-revoked` | a cast voice whose consent was withdrawn |
| `voice-scope` | a cast voice consented for `evaluation`, not `publication` (P28-7) |
| `audio-source` | a Freesound original this repository does not carry |
| `exercise-turns` | a transcript that would contradict the items already asking about it |
| `backup` | a replacement with nowhere to put the bytes it is replacing (raised at write time) |

`voice-scope` is the whole of backlog P28-7. Casting an evaluation-scope voice stays legal — the
editor deliberately allows it, because casting is not publishing — and this is the gate that was
missing on the other side.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping, Sequence

from ..domain import Stage
from ..export import dump_yaml, sha256
from ..storage import Store
from .convert import exercise_sets_for, load_yaml
from .model import Scene

#: The levels a course artifact may declare (`packages/schema`'s `LEVELS`).
LEVELS: tuple[str, ...] = ("A1", "A2", "B1", "B2")

#: The only variant a publish may name. Every scene declares `natural` and it is the one rendered,
#: approved and shipped; `clean` and `challenging` exist so a difficulty ladder can be *auditioned*
#: and there is no learner-facing artifact shape for them yet. Refused by name rather than accepted
#: silently, because "published the challenging mix as the recording" is not a mistake anyone would
#: see in a diff.
PUBLISHED_VARIANT = "natural"

#: The provenance manifest's own version. 1 is `export.manifest` — a `RevisionPayload`, its resolved
#: lines and its per-line cache keys. 2 is a **scene**: `scene_sha256`, the render's node hashes, its
#: voices map and its timing. They are different documents about different things and a reader has
#: to be able to tell which it is holding; `api.registry._published_revision` already keys on it,
#: which is how a converted artifact stops reporting `stale` forever.
MANIFEST_VERSION = 2

#: Where the package's two lock files live — the same pair `cli.bundle_project` hashes.
PACKAGE_ROOT = Path(__file__).resolve().parents[3]

#: The artifact schema's bound (`listeningArtifactSchema.speakers`, `.min(1).max(4)`).
MAX_SPEAKERS = 4


class PublishRefusal(ValueError):
    """A gate said no, **with the gate named.**

    `ConsentViolation`'s shape and its reason: a caller reading "this scene cannot be published"
    learns nothing, and one reading `voice-scope` can be shown the sentence it has to satisfy. The
    API turns it into a 409 whose body carries the id; the CLI prints it before the message.
    """

    def __init__(self, gate: str, message: str) -> None:
        super().__init__(f"{gate}: {message}")
        self.gate = gate
        self.detail = message


@dataclass(frozen=True)
class PublishTargets:
    """Where the four files go, relative to the repository root."""

    artifact: Path
    audio: Path
    manifest: Path
    brief: Path

    def all(self) -> list[Path]:
        return [self.artifact, self.audio, self.manifest, self.brief]


@dataclass(frozen=True)
class PublishPlan:
    """Everything a publish would write, computed before anything is written.

    Separating the plan from the write is what makes `--dry-run` an honest answer rather than a
    second implementation: the dry run stages exactly these bytes and stops before the rename, so
    what it reports is what a real publish would put there.
    """

    slug: str
    level: str
    variant: str
    scene_sha256: str
    render_dir: Path
    artifact: dict[str, Any]
    manifest: dict[str, Any]
    brief: str
    targets: PublishTargets
    #: Which targets already exist in the repository holding different bytes. Non-empty means this
    #: is a replacement, and a replacement needs a backup directory.
    replaces: list[Path]

    def files(self) -> dict[str, str]:
        """Target path → what it is, for a `--json` envelope and for a dry run's report."""

        return {
            self.targets.artifact.as_posix(): "artifact",
            self.targets.audio.as_posix(): "audio",
            self.targets.manifest.as_posix(): "provenance",
            self.targets.brief.as_posix(): "generation-brief",
        }


# -- reading the render -------------------------------------------------------


def render_dir(store_root: Path, scene: Scene, variant: str = PUBLISHED_VARIANT) -> Path:
    return store_root / "renders" / scene.sha256() / variant


def default_backup_root(store_root: Path, slug: str) -> Path:
    """Where the bytes a replacement overwrites are kept: `cli.republish`'s answer, unchanged.

    Under **app-data**, never under the repository. A backup inside the tree being published to is
    a file the next `bun run validate` has to be taught to ignore, and one somebody eventually
    commits. Stated once here because three callers need the same path and a fourth spelling of it
    would be a backup nobody could find.
    """

    return store_root / "replaced" / slug / datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def _artifact_sha(render: Mapping[str, Any], kind: str) -> str | None:
    for row in render.get("artifacts", []):
        if isinstance(row, dict) and row.get("kind") == kind:
            digest = row.get("sha256")
            return str(digest) if isinstance(digest, str) else None
    return None


def _published_bitrate(render: Mapping[str, Any]) -> str | None:
    """What the MP3 was encoded at, read off the render's own encode node.

    Not restated from `graph.nodes.PUBLISH_BITRATE`: that constant is what the *current* build
    would encode at, and this manifest describes a file that already exists. A published bitrate
    copied from a constant is a claim that silently becomes wrong the day the constant changes,
    for every artifact rendered before it did.
    """

    for node in render.get("nodes") or []:
        if not isinstance(node, dict) or node.get("type") != "encode":
            continue
        params = node.get("params")
        if isinstance(params, dict) and params.get("encoding") == "publish":
            bitrate = params.get("bitrate")
            return str(bitrate) if bitrate is not None else None
    return None


def _lock_hashes() -> dict[str, str]:
    """The dependency and model lock digests, exactly as `cli.bundle_project` computes them."""

    return {
        "dependency_lock_sha256": hashlib.sha256(
            (PACKAGE_ROOT / "uv.lock").read_bytes()
        ).hexdigest(),
        "model_lock_sha256": hashlib.sha256(
            (PACKAGE_ROOT / "models.lock.json").read_bytes()
        ).hexdigest(),
    }


# -- the artifact record ------------------------------------------------------


def listening_record(
    scene: Scene, render: Mapping[str, Any], level: str, provenance: str
) -> dict[str, Any]:
    """The `listeningArtifactSchema` record, derived from the scene and this render.

    Three fields are worth their comment.

    `duration_seconds` is measured off the render, never off the brief. The brief states the
    window the plan *asked* for; twelve of the forty-one legacy takes do not land inside theirs.

    `transcript` is ordered by **when each turn was heard**, from the render's own timing table,
    rather than by the order the script happens to be stored in. For every scene shipped so far
    the two are identical — the timeline is sequential — and they stop being identical the moment
    a scene pins an `at_ms` to overlap two turns, which is exactly when a transcript in storage
    order would start describing a recording nobody hears.

    `speakers` is the cast in cast order, not the set of roles that speak: the cast is the
    declared list and a role with no line is a scene defect, refused by the model, not something
    to hide by deriving the list from the script.
    """

    order = {
        str(row["utterance_id"]): index
        for index, row in enumerate(
            sorted(render.get("timing", []), key=lambda row: (int(row["start_ms"]), row["utterance_id"]))
        )
    }
    script = sorted(scene.script, key=lambda row: order.get(row.id, len(order)))
    assert scene.brief is not None  # guaranteed by the `brief` gate
    return {
        "id": scene.slug,
        "level": level,
        "title": scene.title.model_dump(exclude_none=True),
        "scenario": scene.brief.scenario,
        "duration_seconds": max(1, round(int(render["duration_ms"]) / 1000)),
        "speakers": [member.role for member in scene.cast],
        "transcript": [
            {"speaker": utterance.role, "text": utterance.display_text} for utterance in script
        ],
        "provenance": provenance,
    }


def generation_brief(scene: Scene) -> str:
    """The brief document, in the scene's own words about its own authoring.

    `export.write_bundle`'s three branches, unchanged, because the failure they encode has not
    moved: printing a prompt rebuilt from the finished script publishes a generation history that
    did not happen, and calling a model-drafted script "manually authored" is the same fabrication
    pointed the other way. A converted dialogue takes the middle branch and that is the truth —
    the 40 published scripts were drafted by a model whose prompt was not retained.
    """

    header = f"# Listening generation brief — {scene.slug}\n\n"
    if scene.authoring == "generated" and scene.generation_prompt:
        return (
            header
            + "## Exact prompt, as submitted\n\n"
            + f"{scene.generation_prompt}\n\n"
            + "The script below was revised editorially after generation; this prompt is the "
            "input that produced the draft, not a description of the final text.\n"
        )
    if scene.authoring == "generated":
        return (
            header
            + "## Model-drafted; the submitted brief was not retained\n\n"
            + "This script was drafted by a language model, but the prompt that produced it was "
            "not saved and cannot be recovered. It is deliberately not reconstructed from the "
            "final scene: that string would describe the edited text, not the model's input.\n"
        )
    return (
        header
        + "## Manually authored\n\n"
        + "No prompt was submitted to a language model for this script. It was written by the "
        "editor, and the model lock in this recording's provenance covers the speech synthesis "
        "only.\n"
    )


# -- the provenance manifest --------------------------------------------------


def contextual_sources(render: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Every imported third-party original this render used, from the asset store's own sidecars.

    `AssetStore.resolve_source` writes `{kind: "imported-source", source_sha256, sound_id,
    license, source_record}` beside an imported Freesound original, and `render.json` copies every
    asset sidecar into `assets`. So the licence trail survives the move from `RevisionPayload`'s
    `context_sounds` to a scene's `AssetRef` without the publisher knowing anything about
    Freesound — which is the point, because a scene names a sha and nothing else.

    The key is `original_sha256` rather than `source_sha256`: `scripts/validate.ts` reads this
    block, and renaming a field the course repo already checks would be a silent hole in a check
    rather than a tidier name.
    """

    found: list[dict[str, Any]] = []
    for digest, record in sorted((render.get("assets") or {}).items()):
        if not isinstance(record, dict) or record.get("kind") != "imported-source":
            continue
        found.append(
            {
                "asset_sha256": digest,
                "original_sha256": record.get("source_sha256"),
                "sound_id": record.get("sound_id"),
                "license": record.get("license"),
                "source_record": record.get("source_record"),
            }
        )
    return found


def scene_manifest(
    scene: Scene,
    revision_number: int,
    render: Mapping[str, Any],
    qa: Mapping[str, Any],
    approval: Mapping[str, Any],
    *,
    level: str,
    published_audio_sha256: str,
) -> dict[str, Any]:
    """The scene-native provenance manifest — version 2.

    **The claims come from `render.json`'s `voices` map and from nothing else.** That map is cast
    role → the bound `VoiceRef` a take was actually spoken through, filled in by `graph.render`
    after `generative.voices.resolve_voices` checked the row, so:

        voice_cloning_used = bool(manifest["voices"])
        consent_sha256     = sorted({row["consent_sha256"] for row in ...})

    and `reference_audio_used` is the same boolean, because in this design a reference recording is
    the only thing a cloned voice can come from. Computing them any other way — from the scene
    document, from the engine name, from an editor's checkbox — would answer a question about what
    was *rendered* with something that is not the render. `export.manifest` says the same thing
    about its own ceiling and points here.

    The scene document itself is embedded. `scene_sha256` is the manifest's whole claim to identity
    and the registry's `stale` signal is computed from it, and a hash naming a document that lives
    only in one machine's SQLite is a hash nobody else can check. The legacy bundle carried
    `project.json` for the same reason; the difference is that this one lands in the repository.
    """

    voices = {
        role: row for role, row in (render.get("voices") or {}).items() if isinstance(row, dict)
    }
    consent = sorted(
        {str(row["consent_sha256"]) for row in voices.values() if row.get("consent_sha256")}
    )
    return {
        "version": MANIFEST_VERSION,
        "id": scene.slug,
        "kind": scene.kind,
        "level": level,
        "created_at": str(approval.get("reviewed_at") or datetime.now(UTC).isoformat()),
        # The registry compares this against the studio's current revision sha, which is what makes
        # a scene edited after publication read `stale` instead of `published`.
        "scene_sha256": scene.sha256(),
        "scene_revision": revision_number,
        "scene": scene.model_dump(mode="json"),
        "script_sha256": hashlib.sha256(
            "\n".join(utterance.display_text for utterance in scene.script).encode()
        ).hexdigest(),
        **_lock_hashes(),
        # The master the editor approved (WAV, never committed), the dialogue bus the soundscape
        # diagnostic measured against, and the file a learner downloads. All three are pinned;
        # leaving one out would leave it free to drift.
        "master_audio_sha256": _artifact_sha(render, "master"),
        "dry_audio_sha256": _artifact_sha(render, "dry"),
        "published_audio_sha256": published_audio_sha256,
        "published_audio_bitrate": _published_bitrate(render),
        "models": render.get("models_lock") or {},
        "render": {
            "variant": render.get("variant"),
            "created_at": render.get("created_at"),
            "duration_ms": render.get("duration_ms"),
            "ffmpeg": render.get("ffmpeg"),
            "acoustics": render.get("acoustics"),
            "engines": render.get("engines"),
            # Node hashes, not node outputs: this is the record that says the same scene on the
            # same weights would produce the same bytes, and the one a cache-hit claim is checked
            # against.
            "nodes": render.get("nodes"),
            "nodes_evaluated": render.get("nodes_evaluated"),
            "nodes_cached": render.get("nodes_cached"),
            "timing": render.get("timing"),
            "timeline": render.get("timeline"),
            "artifacts": render.get("artifacts"),
            "assets": render.get("assets"),
        },
        "voices": voices,
        "contextual_sources": contextual_sources(render),
        "qa": dict(qa),
        "approval": dict(approval),
        "claims": {
            "model_license_is_training_data_provenance": False,
            "voice_cloning_used": bool(voices),
            "reference_audio_used": bool(voices),
            # A list rather than a bool, because the question a reader asks of a cloned artifact is
            # *which consent*, not *whether*.
            "consent_sha256": consent,
        },
    }


# -- the gates ----------------------------------------------------------------


def _resolve_level(scene: Scene, level: str | None) -> str:
    """A1/A2/B1/B2, or a refusal saying how to supply one.

    The level decides two directory names and the artifact record's own `level` field, and
    `scripts/validate.ts` holds the three equal. A dialogue scene converted from a published
    artifact carries it in its brief, because the converter read it off the artifact. Anything
    else — a scene authored from scratch with no brief — has to be told, and guessing from the
    slug is exactly the rule nobody wrote down.
    """

    if level is not None:
        if level.upper() not in LEVELS:
            raise PublishRefusal("level", f"{level} is not one of {', '.join(LEVELS)}")
        return level.upper()
    if scene.brief is not None:
        return str(scene.brief.level)
    raise PublishRefusal(
        "level",
        f"{scene.slug} has no brief, so its level cannot be derived; pass --level explicitly",
    )


def _check_voices(store: Store, scene: Scene) -> None:
    """P28-7: every cast voice reference is consented **for publication** and not withdrawn.

    Casting an evaluation-scope voice is deliberately allowed — a disabled picker would imply a
    gate that does not exist, and auditioning is not publishing. This is the other side of that
    decision, and until it existed the only thing between an evaluation-scope voice and a shipped
    artifact was the human approval step.

    The scope is read from the store row rather than from `render.json`'s voices map: the map
    records the consent *digest* the take was made under, and the scope is a property of the
    consent this studio holds now. A consent downgraded or a voice revoked between render and
    publish must refuse, and only the live row can say so.
    """

    for member in scene.cast:
        voice_ref = member.voice.voice_ref
        if voice_ref is None:
            continue
        row = store.get_voice(voice_ref)
        if row is None:
            raise PublishRefusal(
                "voice-unknown",
                f"role {member.role} is cast on voice reference {voice_ref}, which this studio "
                "does not have",
            )
        if row.revoked_at is not None:
            raise PublishRefusal(
                "voice-revoked",
                f"voice reference {voice_ref} ({row.subject_display_name}) was revoked on "
                f"{row.revoked_at[:10]}; consent was withdrawn and nothing spoken through it is "
                "published",
            )
        if row.scope != "publication":
            raise PublishRefusal(
                "voice-scope",
                f"voice reference {voice_ref} ({row.subject_display_name}) is consented at scope "
                f"{row.scope}, not publication; role {member.role} cannot be published in it",
            )


def _check_audio_sources(repo: Path, sources: Sequence[Mapping[str, Any]]) -> None:
    """Every imported original this render used is committed in the repository.

    `scripts/validate.ts` checks the same thing from the other end — it hashes
    `data/audio-sources/freesound/<id>/original.*` against the manifest — and fails the whole
    corpus if it does not match. This publisher does not write that directory (the regeneration
    wave reuses sources the legacy publisher already committed), so an uncommitted source is
    refused here rather than published into a repository that then fails to validate.
    """

    for source in sources:
        sound_id = source.get("sound_id")
        if sound_id is None:
            raise PublishRefusal(
                "audio-source",
                f"asset {source.get('asset_sha256')} is an imported source with no Freesound id",
            )
        directory = repo / "data" / "audio-sources" / "freesound" / str(sound_id)
        originals = (
            sorted(path for path in directory.iterdir() if path.name.startswith("original."))
            if directory.is_dir()
            else []
        )
        if len(originals) != 1 or sha256(originals[0]) != source.get("original_sha256"):
            raise PublishRefusal(
                "audio-source",
                f"Freesound source {sound_id} is not committed under "
                f"data/audio-sources/freesound/{sound_id}/ with the bytes this render used; "
                "import and commit it before publishing",
            )


def _check_exercise_turns(repo: Path, level: str, slug: str, transcript: list[dict[str, str]]) -> None:
    """The items already asking about this recording say exactly what the transcript says.

    `scripts/validate.ts` holds an `audio-comprehension` item's `source.turns` equal to its
    recording's transcript, so that a learner on a build with audio and one on a build without are
    answering a question about the same words. That equality is checked in the course repo and
    broken *here*: publishing a scene whose script was edited after the exercise was written
    leaves a corpus that no longer validates, and the artifact record is the half that moved.

    Refused rather than fixed, because the fix is editorial — either the item is revised or the
    scene is put back — and a publisher that rewrote 57 committed exercise items to match a new
    take would be making that decision silently.
    """

    for path in exercise_sets_for(repo, level.lower()):
        document = load_yaml(path)
        for item in document.get("items") or []:
            if item.get("type") != "audio-comprehension" or item.get("recording") != slug:
                continue
            turns = [
                {"speaker": turn.get("speaker"), "text": turn.get("text")}
                for turn in (item.get("source") or {}).get("turns") or []
            ]
            if turns != transcript:
                raise PublishRefusal(
                    "exercise-turns",
                    f"item {item.get('id')} in {path.name} carries a script this scene no longer "
                    "matches; revise the item and the scene together, or `bun run validate` fails "
                    "on the published corpus",
                )


# -- planning -----------------------------------------------------------------


def plan_publish(
    store: Store,
    repo: Path,
    slug: str,
    *,
    level: str | None = None,
    variant: str = PUBLISHED_VARIANT,
) -> PublishPlan:
    """Run every gate and compute every byte, writing nothing.

    Order matters in one place only, and it is the cheap-before-expensive one: the document gates
    (stage, approval, level) run before the filesystem gates (render, sources, exercise turns), so
    a scene nobody approved is refused without reading a render tree.
    """

    if variant != PUBLISHED_VARIANT:
        raise PublishRefusal(
            "variant",
            f"only the {PUBLISHED_VARIANT} variant is published; {variant} is a difficulty "
            "rendering with no learner-facing artifact shape",
        )
    found = store.get_scene_by_slug(slug)
    if found is None:
        raise PublishRefusal("scene", f"no scene project {slug}")
    project, revision, scene, _exercise = found

    if scene.kind != "dialogue":
        raise PublishRefusal(
            "kind",
            f"{scene.slug} is a {scene.kind} scene; content/listening/ is the dialogue path and a "
            "narration publishes to content/reading-audio/, which this publisher does not write",
        )
    if Stage(project.stage) != Stage.HUMAN_APPROVED:
        raise PublishRefusal(
            "stage",
            f"{scene.slug} is at {project.stage}; publishing follows {Stage.HUMAN_APPROVED}",
        )
    approval: dict[str, Any] = json.loads(revision.approval_json or "{}")
    if approval.get("status") != "complete":
        raise PublishRefusal(
            "approval",
            f"{scene.slug} carries no completed human approval "
            f"(status {approval.get('status') or 'none'})",
        )
    qa: dict[str, Any] = json.loads(revision.qa_json or "{}")
    if qa.get("passed") is not True:
        raise PublishRefusal(
            "qa", f"{scene.slug} has no passing automatic QA report for this revision"
        )
    # Level **before** scenario, and the order is load-bearing rather than tidy: a scene with no
    # brief lacks both, and `--level` is the documented escape hatch for exactly that scene. Asking
    # for the scenario first would make the level refusal unreachable — the caller would be told to
    # supply a brief when what they can actually supply is a level.
    resolved_level = _resolve_level(scene, level)
    if scene.brief is None:
        raise PublishRefusal(
            "brief",
            f"{scene.slug} has no brief, and only the brief carries the scenario a published "
            "artifact states",
        )
    if not 1 <= len(scene.cast) <= MAX_SPEAKERS:
        raise PublishRefusal(
            "speakers",
            f"{scene.slug} casts {len(scene.cast)} speakers; a published artifact declares 1 to "
            f"{MAX_SPEAKERS}",
        )
    _check_voices(store, scene)

    if approval.get("scene_sha256") not in (None, scene.sha256()):
        raise PublishRefusal(
            "approval-scene-sha",
            f"the approval on record is for scene {str(approval.get('scene_sha256'))[:12]} and "
            f"this revision is {scene.sha256()[:12]}",
        )
    if approval.get("variant") not in (None, variant):
        raise PublishRefusal(
            "approval-variant",
            f"the approval on record is for variant {approval.get('variant')}, not {variant}",
        )

    directory = render_dir(store.root, scene, variant)
    manifest_path = directory / "render.json"
    if not manifest_path.exists():
        raise PublishRefusal(
            "render",
            f"{scene.slug} has no {variant} render of these bytes; render it before publishing",
        )
    render: dict[str, Any] = json.loads(manifest_path.read_text())
    master = directory / "master.wav"
    published = directory / "publish.mp3"
    for name, path in (("master.wav", master), ("publish.mp3", published)):
        if not path.exists():
            raise PublishRefusal(
                "render", f"the {variant} render of {scene.slug} has no {name}"
            )
    master_sha = sha256(master)
    declared = _artifact_sha(render, "master")
    if declared != master_sha:
        raise PublishRefusal(
            "render-drift",
            f"master.wav hashes to {master_sha[:12]} and render.json declares "
            f"{str(declared)[:12]}; re-render before publishing",
        )
    published_sha = sha256(published)
    if _artifact_sha(render, "publish") != published_sha:
        raise PublishRefusal(
            "render-drift",
            "publish.mp3 does not hash to what render.json declares; re-render before publishing",
        )
    if approval.get("audio_sha256") != master_sha:
        # The approval vouches for bytes this render does not have. Either the reviewer signed a
        # render that has since been replaced, or the render was rebuilt after approval — both
        # publish a signature that never covered the recording.
        raise PublishRefusal(
            "approval-master-sha",
            f"the approval names master {str(approval.get('audio_sha256'))[:12]} and this render's "
            f"master is {master_sha[:12]}; re-approve the current render before publishing it",
        )

    provenance_ref = f"data/audio-provenance/{resolved_level.lower()}/{scene.slug}.json"
    artifact = listening_record(scene, render, resolved_level, provenance_ref)
    transcript = [dict(row) for row in artifact["transcript"]]
    manifest = scene_manifest(
        scene,
        revision.number,
        render,
        qa,
        approval,
        level=resolved_level,
        published_audio_sha256=published_sha,
    )
    _check_audio_sources(repo, manifest["contextual_sources"])
    _check_exercise_turns(repo, resolved_level, scene.slug, transcript)

    review_date = str(approval.get("reviewed_at", ""))[:10] or datetime.now(UTC).date().isoformat()
    level_dir = resolved_level.lower()
    targets = PublishTargets(
        artifact=Path("content") / "listening" / level_dir / f"{scene.slug}.yaml",
        # Beside the record, not under `public/`: whether a build ships audio is a build decision,
        # and `src/integrations/audio-bundle.ts` copies from here into any build that asks.
        audio=Path("content") / "listening" / level_dir / f"{scene.slug}.mp3",
        manifest=Path(provenance_ref),
        brief=Path("data") / "prompts" / f"{review_date}-{scene.slug}-listening.md",
    )
    brief_text = generation_brief(scene)
    manifest["generation_brief"] = {
        "path": targets.brief.as_posix(),
        "sha256": hashlib.sha256(brief_text.encode()).hexdigest(),
    }

    staged = {
        targets.artifact: dump_yaml(artifact).encode(),
        targets.manifest: (
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        ).encode(),
        targets.brief: brief_text.encode(),
    }
    replaces = [
        target
        for target, content in staged.items()
        if (repo / target).exists() and (repo / target).read_bytes() != content
    ]
    if (repo / targets.audio).exists() and sha256(repo / targets.audio) != published_sha:
        replaces.append(targets.audio)

    return PublishPlan(
        slug=scene.slug,
        level=resolved_level,
        variant=variant,
        scene_sha256=scene.sha256(),
        render_dir=directory,
        artifact=artifact,
        manifest=manifest,
        brief=brief_text,
        targets=targets,
        replaces=sorted(replaces),
    )


# -- writing ------------------------------------------------------------------


def stage_publish(plan: PublishPlan, stage: Path) -> list[tuple[Path, Path]]:
    """Write every file into a staging directory. Returns `(staged file, repo-relative target)`.

    A dry run stops here. What it reports is therefore what a real publish would move, byte for
    byte, rather than a second rendering of the same intention.
    """

    stage.mkdir(parents=True, exist_ok=True)
    written: list[tuple[Path, Path]] = []
    bodies: list[tuple[Path, bytes]] = [
        (plan.targets.artifact, dump_yaml(plan.artifact).encode()),
        (
            plan.targets.manifest,
            (json.dumps(plan.manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode(),
        ),
        (plan.targets.brief, plan.brief.encode()),
    ]
    for index, (target, body) in enumerate(bodies):
        candidate = stage / f"{index}{target.suffix}"
        candidate.write_bytes(body)
        written.append((candidate, target))
    audio = stage / f"{len(bodies)}.mp3"
    shutil.copy2(plan.render_dir / "publish.mp3", audio)
    written.append((audio, plan.targets.audio))
    return written


def write_publish(plan: PublishPlan, repo: Path, *, backup_root: Path | None = None) -> list[Path]:
    """Stage every file, back up what is being replaced, then rename them all into place.

    `cli.republish`'s discipline, kept whole and applied to every publish rather than only to a
    replacement. Three properties, each of which has cost something when it was absent:

    * **Stage all, then rename.** A `shutil.copy2` straight to the target leaves a half-written
      file if the process dies mid-copy, and a half-published recording is worse than none — it
      validates as an artifact and plays as noise.
    * **Roll back on failure.** If the fourth rename fails the first three are put back, from the
      backup where there was one and by deletion where there was not.
    * **Back up before replacing.** Under app-data, not under the repository: a backup inside the
      tree being published to is a file the next `bun run validate` has to be taught to ignore.
    """

    staging_parent = repo / ".atlas-publish-staging"
    staging_parent.mkdir(parents=True, exist_ok=True)
    if plan.replaces and backup_root is None:
        raise PublishRefusal(
            "backup",
            f"{plan.slug} is already published with different bytes; a replacement needs a local "
            "backup directory",
        )
    if backup_root is not None:
        backup_root.mkdir(parents=True, exist_ok=False)
        for target in plan.targets.all():
            source = repo / target
            if not source.exists():
                continue
            backup = backup_root / target
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, backup)

    replaced: list[tuple[Path, Path | None]] = []
    try:
        with tempfile.TemporaryDirectory(dir=staging_parent) as temporary:
            staged = stage_publish(plan, Path(temporary))
            for candidate, target in staged:
                destination = repo / target
                destination.parent.mkdir(parents=True, exist_ok=True)
                saved = (backup_root / target) if backup_root is not None else None
                replaced.append(
                    (destination, saved if saved is not None and saved.exists() else None)
                )
                candidate.replace(destination)
    except Exception:
        for destination, saved in reversed(replaced):
            if saved is not None:
                shutil.copy2(saved, destination)
            else:
                destination.unlink(missing_ok=True)
        raise
    finally:
        try:
            staging_parent.rmdir()
        except OSError:
            pass
    return [repo / target for target in plan.targets.all()]


def publish_scene(
    store: Store,
    repo: Path,
    slug: str,
    *,
    level: str | None = None,
    variant: str = PUBLISHED_VARIANT,
    backup_root: Path | None = None,
) -> tuple[PublishPlan, list[Path]]:
    """Plan, write, and move the project to `exported`.

    The stage transition is last on purpose: a scene marked exported over a publish that failed
    halfway would be a project the registry reports as published and the repository does not.

    `backup_root` is **derived when it is not given and the publish replaces something**, rather
    than refused. A caller that has to remember to pass one is a caller that publishes a
    replacement without a backup on the day they forget, and there is exactly one right answer:
    `replaced/<slug>/<timestamp>` under app-data, which is where `cli.republish` has always put it.
    """

    plan = plan_publish(store, repo, slug, level=level, variant=variant)
    if backup_root is None and plan.replaces:
        backup_root = default_backup_root(store.root, plan.slug)
    written = write_publish(plan, repo, backup_root=backup_root)
    found = store.get_scene_by_slug(slug)
    assert found is not None
    store.transition_scene(found[0].id, Stage.HUMAN_APPROVED, Stage.EXPORTED)
    return plan, written


# -- unpublishing, and the one deletion that is safe --------------------------
#
# In this module because the question a deletion has to answer is a *publication* question — has
# anything in the course repository been told about this scene — and `published_slugs` is the only
# reading of the repository that can answer it. Two surfaces call it (the CLI verb and
# `DELETE /api/scenes/{slug}`) and neither may hold its own copy of the rule.


def published_slugs(repo: Path) -> set[str]:
    """Every slug a provenance manifest in this repository names, dialogue and reading alike.

    Read from the manifests rather than from a scene's own brief, and across every level directory
    rather than the one the scene claims: a scene published and then corrected to another level
    must still be found, and "no manifest names it" is the only answer that makes a deletion gate
    safe. One directory walk, which is the same cost as the single query the scene rows come from.
    """

    root = repo / "data" / "audio-provenance"
    if not root.is_dir():
        return set()
    found: set[str] = set()
    for path in root.rglob("*.json"):
        relative = path.relative_to(root).parts
        # A dialogue manifest is `<level>/<slug>.json` and its slug is the artifact id. A reading
        # manifest is `readings/<level>/<name>.json`, and the scene slug for it is
        # `reading_slug(id)` — the level and the name joined by a hyphen. Matching on the bare stem
        # would miss every published narration, which is exactly the case the gate exists for.
        if len(relative) == 3 and relative[0] == "readings":
            found.add(f"{relative[1]}-{path.stem}")
        elif len(relative) == 2:
            found.add(path.stem)
    return found


def deletion_refusal(project: Any, revision: Any) -> str | None:
    """Why this scene project may **not** be deleted, or None when it may (backlog P28-6).

    Two conditions here and a third at the caller, and each one is a different kind of loss. A
    scene past `draft` has audio rendered against its sha and may carry a QA report or a
    signature. A scene at revision 2 has edit history that deleting the project would take with
    it. The third — a published slug — is the caller's, because only it has the repository.
    """

    if str(project.stage) != str(Stage.DRAFT):
        return f"this scene is at {project.stage}; only a draft is deleted"
    if revision.number != 1:
        return (
            f"this scene has {revision.number} revisions; deleting it would take its edit history "
            "with it"
        )
    return None
