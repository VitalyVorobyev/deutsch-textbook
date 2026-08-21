"""The regeneration wave: convert, render and QA the published dialogue corpus in one process.

Separate from `scene/cli.py` for the reason `graph.scene_qa` takes a `transcribe_fn`: the real
transcriber is MLX Whisper and macOS-local, so a run has to be drivable from a test in an
environment that has never seen torch. A verb that imported the ASR runtime at the top of its own
body would be a verb no test could execute end to end, and the wave's interesting behaviour — the
resume rule, the failure rows, the engine cache — is exactly what wants a test.

**Three properties, and each one is why this is a wave rather than a shell loop.**

*One process.* The pinned Qwen adapter pays a ~150 s MPS warm-up on its first synthesis and nothing
after it. Forty `scene render` invocations pay it forty times; here the engines are constructed once
and handed to every render, so the cost lands inside artifact 1 and nowhere else.

*It stops before the human.* Convert, render, QA — and then nothing. It never approves and never
publishes. An approval is a person's signature on bytes they heard, and a bulk verb that could
produce one would be a bulk verb that could forge one.

*A failure is a row, not an exit.* An artifact that fails to convert, render or QA is recorded with
its error type and message and the run continues. A wave that aborted on artifact 12 would leave 28
unattempted and one operator deciding, at midnight, whether to restart from the top.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable

from ..domain import Stage
from ..storage import Store
from .convert import dialogue_scene, published_dialogue_ids
from .model import Scene

#: One transcription of one file — `graph.scene_qa`'s seam, passed through.
Transcriber = Callable[[Path], str]

#: Where a progress line goes. The default swallows it, so a library caller pays nothing and the
#: CLI does its own printing; nothing in here knows about typer.
Progress = Callable[[str], None]

#: The variant a wave renders. Deliberately the same one the publisher ships: rendering a ladder of
#: difficulty variants across forty artifacts before anyone has approved one natural take is model
#: time spent on a decision that has not been made.
DEFAULT_VARIANT = "natural"

#: Stages at which a scene has already been through this wave. Reaching one of these means the run
#: is a resume and this row is done, whatever else changed on the machine.
FINISHED = (Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED, Stage.EXPORTED)


def wave_targets(repo: Path, level: str | None = None, only: list[str] | None = None) -> list[str]:
    """`<level>/<id>` for every published artifact this run covers, ordered level then id.

    The order **is** the resume point. A run that dies at artifact 23 is restarted with the same
    command and walks the same sequence, so "where did it stop" is a position in a printed list
    rather than a set difference somebody has to compute at midnight.

    `only` matches on the bare id, so both `ls-wohnen-01` and `a1/ls-wohnen-01` name the same row.
    """

    ids = published_dialogue_ids(repo)
    if level:
        ids = [row for row in ids if row.split("/")[0] == level.lower()]
    if only:
        wanted = {row.split("/")[-1] for row in only}
        ids = [row for row in ids if row.split("/")[-1] in wanted]
    return sorted(ids)


def wave_state(store: Store, slug: str, scene: Scene) -> tuple[str, Any]:
    """Where this artifact already is: `absent`, `stored`, or `edited`.

    "Came from the same artifact" is answered by the **hash**, not by a flag. A stored scene whose
    sha equals a fresh conversion's is the same document by construction; one whose sha differs is
    either an edited scene or a changed artifact, indistinguishable from here and, either way, not
    something a bulk run may overwrite. That is what makes the wave resumable in both directions:
    re-running it over work already done is a no-op, and re-running it over work somebody has since
    edited is a refusal rather than a silent revert.
    """

    found = store.get_scene_by_slug(slug)
    if found is None:
        return "absent", None
    project, _revision, stored, _exercise = found
    if stored.sha256() != scene.sha256():
        return "edited", project
    return "stored", project


def run_wave(
    store: Store,
    repo: Path,
    targets: list[str],
    *,
    variant: str = DEFAULT_VARIANT,
    engine: str | None = None,
    test_adapter: bool = False,
    speaker_qa: bool = True,
    dry_run: bool = False,
    transcribe_fn: Transcriber | None = None,
    progress: Progress | None = None,
) -> list[dict[str, Any]]:
    """Walk the targets, one row per artifact. Returns the rows; writes nothing to `content/`."""

    # Imported here, not at module scope: this pulls the adapters, huggingface-hub and soundfile,
    # and `scene/cli.py`'s whole argument is that reaching `scene validate` costs none of that.
    from ..adapters import CLONING_ENGINES, engine_for
    from ..generative.gateway import ClonableVoice, SpeechGenerator
    from ..generative.voices import resolve_voices
    from ..graph.render import render_scene
    from ..graph.scene_qa import scene_qa

    say: Progress = progress or (lambda _line: None)
    transcriber = transcribe_fn
    if transcriber is None:
        from ..adapters import transcribe as transcriber_impl

        transcriber = transcriber_impl

    total = len(targets)
    rows: list[dict[str, Any]] = []
    warm: dict[str, SpeechGenerator] = {}

    def speech_for(scene: Scene, clonable: dict[str, ClonableVoice]) -> dict[str, SpeechGenerator]:
        """One engine per engine name the cast uses, reusing the warm ones.

        A **cloning** engine is deliberately not cached: it is constructed around the reference
        recordings of one scene's cast, so reusing an instance across artifacts would hand scene 12
        the voices resolved for scene 11. Nothing in the converted corpus is cast on one — all 40
        are preset `qwen_tts` — and the exception is written down rather than assumed away.
        """

        built: dict[str, SpeechGenerator] = {}
        for name in sorted({member.voice.engine for member in scene.cast}):
            actual = engine or name
            if actual.startswith("fake") and not test_adapter:
                raise ValueError(f"this scene is cast on {actual}; add --test-adapter")
            if actual in CLONING_ENGINES:
                built[name] = engine_for(actual, clonable)
                continue
            if actual not in warm:
                warm[actual] = engine_for(actual, {})
            built[name] = warm[actual]
        return built

    for index, artifact_id in enumerate(targets, start=1):
        slug = artifact_id.split("/")[-1]
        row: dict[str, Any] = {"n": index, "id": artifact_id, "slug": slug}
        clock = time.monotonic()
        try:
            scene, exercise = dialogue_scene(repo, artifact_id)
            state, project = wave_state(store, slug, scene)
            row["scene_sha256"] = scene.sha256()
            if state == "edited":
                row |= {"outcome": "skipped", "reason": "scene-edited"}
                say(f"[{index}/{total}] {slug} skipped — the stored scene is not this artifact")
                rows.append(row)
                continue
            if dry_run:
                # The action a real run would take, read off the same two things the real run
                # reads: whether a scene exists with these bytes, and how far it has got. A dry run
                # that said "would render" about a row already through QA would be a plan nobody
                # could count from — and counting the plan is what a dry run is for.
                stage = Stage(project.stage) if project is not None else None
                row |= {
                    "outcome": "planned",
                    "action": (
                        "convert"
                        if state == "absent"
                        else "nothing" if stage in FINISHED else "render"
                    ),
                }
                say(f"[{index}/{total}] {slug} · would {row['action']}")
                rows.append(row)
                continue
            if state == "absent":
                project = store.create_scene(scene, exercise)
            assert project is not None
            stage = Stage(project.stage)
            if stage in FINISHED:
                row |= {"outcome": "already-done", "stage": str(stage)}
                say(f"[{index}/{total}] {slug} · already at {stage}")
                rows.append(row)
                continue

            resolved = resolve_voices(
                store,
                store.root,
                [member.voice.voice_ref for member in scene.cast if member.voice.voice_ref],
            )
            result = render_scene(
                scene,
                store.root,
                variant=variant,
                speech_engines=speech_for(scene, resolved.clonable),
                # No sound generator: every converted dialogue's non-speech material is an
                # `AssetRef` into the library. A scene carrying a `SoundSpec` is refused by the
                # renderer and lands in the failure table, which is the right outcome — a bulk run
                # must not quietly drop a sound the scene asked for.
                sound_engine=None,
                repo=repo,
                voices=resolved.refs,
            )
            # `scene render`'s ladder, verbatim: a re-render of unchanged bytes is a cache walk,
            # and anything past `audio_generated` was left alone above.
            if stage == Stage.DRAFT:
                store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
                stage = Stage.VALIDATED
            if stage == Stage.VALIDATED:
                store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
                stage = Stage.AUDIO_GENERATED
            report = scene_qa(
                scene, result.directory, transcribe_fn=transcriber, speaker_qa=speaker_qa
            )
            store.transition_scene(
                project.id, Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED, qa=report
            )
            identity = report["speaker_qa"]
            row |= {
                "outcome": "checked",
                "duration_ms": result.duration_ms,
                "nodes_evaluated": result.nodes_evaluated,
                "nodes_cached": result.nodes_cached,
                "qa_passed": report["passed"],
                "full_wer": report["transcripts"]["full_wer"],
                "speaker_qa": identity if isinstance(identity, str) else "measured",
            }
            say(
                f"[{index}/{total}] {slug} · {time.monotonic() - clock:5.1f} s · "
                f"{result.nodes_evaluated} evaluated, {result.nodes_cached} cached · "
                f"WER {report['transcripts']['full_wer']:.1%} · "
                f"QA {'passed' if report['passed'] else 'needs review'}"
            )
        except Exception as error:  # noqa: BLE001 — every failure is a row, never an exit
            row |= {
                "outcome": "failed",
                "error_type": type(error).__name__,
                "message": str(error),
            }
            say(f"[{index}/{total}] {slug} FAILED · {type(error).__name__}: {error}")
            rows.append(row)
            continue
        row["seconds"] = round(time.monotonic() - clock, 1)
        rows.append(row)
    return rows


def wave_summary(rows: list[dict[str, Any]]) -> dict[str, int]:
    """How many rows reached each outcome, for the final table and the `--json` envelope."""

    counts: dict[str, int] = {}
    for row in rows:
        key = str(row.get("outcome", "unknown"))
        counts[key] = counts.get(key, 0) + 1
    return counts
