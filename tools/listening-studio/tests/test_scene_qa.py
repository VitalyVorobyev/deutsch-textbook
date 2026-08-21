"""Automatic QA over a rendered scene, with the transcriber injected.

Whisper here is MLX and macOS-local, so every test below hands `scene_qa` a `transcribe_fn` and
none of them imports an ML runtime. What is being checked is the *shape* of the judgement — which
slices are cut, which thresholds apply, and that a skipped speaker check says so — not Whisper.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import soundfile as sf

from listening_studio.graph.nodes import QA_RATE
from listening_studio.graph.scene_qa import WEIGHTS_MISSING, scene_qa
from listening_studio.qa import check_units
from test_graph_render import cafe_scene, render, tone_in_store


@pytest.fixture
def rendered(tmp_path: Path):  # type: ignore[no-untyped-def]
    scene = cafe_scene(tone_in_store(tmp_path))
    return scene, render(scene, tmp_path)


def perfect(scene):  # type: ignore[no-untyped-def]
    """A transcriber that hears exactly what the script says, keyed on the slice's filename."""

    spoken = {utterance.id: utterance.spoken_text() for utterance in scene.script}

    def transcribe(path: Path) -> str:
        if path.name == "qa.wav":
            return " ".join(spoken[utterance.id] for utterance in scene.script)
        return spoken[path.stem]

    return transcribe


def test_a_clean_take_passes_and_reports_every_utterance(rendered) -> None:  # type: ignore[no-untyped-def]
    scene, result = rendered
    report = scene_qa(
        scene, result.directory, transcribe_fn=perfect(scene), speaker_qa=False
    )
    assert report["passed"] is True
    assert report["scene_sha256"] == scene.sha256()
    assert [row["line_id"] for row in report["transcripts"]["lines"]] == [
        "line-1", "line-2", "line-3"
    ]
    assert report["transcripts"]["full_wer"] == 0.0


def test_the_slices_come_out_of_the_mix_at_the_qa_format(rendered) -> None:  # type: ignore[no-untyped-def]
    """Per-utterance evidence is cut from `qa.wav`, because the mix is what a learner hears.

    Checking each take on its own would pass a bed that buries a word — the take is clean and the
    scene is not.
    """

    scene, result = rendered
    seen: list[tuple[int, int, int]] = []

    def transcribe(path: Path) -> str:
        info = sf.info(str(path))
        seen.append((info.samplerate, info.channels, round(info.duration * 1000)))
        return scene.utterance(path.stem).spoken_text() if path.name != "qa.wav" else ""

    scene_qa(scene, result.directory, transcribe_fn=transcribe, speaker_qa=False)
    slices = seen[: len(scene.script)]
    assert all(rate == QA_RATE and channels == 1 for rate, channels, _ in slices)
    expected = [row.end_ms - row.start_ms for row in result.timing]
    assert all(abs(cut - want) <= 2 for (_, _, cut), want in zip(slices, expected))


def test_a_missing_protected_word_fails_the_take(rendered) -> None:  # type: ignore[no-untyped-def]
    """`Kaffee` is in the brief's vocabulary, so losing it is a failure and not a WER rounding."""

    scene, result = rendered
    spoken = {utterance.id: utterance.spoken_text() for utterance in scene.script}
    spoken["line-1"] = "Guten Tag, ich hätte gern einen Tee."

    def transcribe(path: Path) -> str:
        if path.name == "qa.wav":
            return " ".join(spoken[utterance.id] for utterance in scene.script)
        return spoken[path.stem]

    report = scene_qa(scene, result.directory, transcribe_fn=transcribe, speaker_qa=False)
    assert report["passed"] is False
    line = next(row for row in report["transcripts"]["lines"] if row["line_id"] == "line-1")
    assert line["missing_protected"] == ["kaffee"]


def test_the_soundscape_counts_beds_and_events_off_the_scene(rendered) -> None:  # type: ignore[no-untyped-def]
    scene, result = rendered
    report = scene_qa(
        scene, result.directory, transcribe_fn=perfect(scene), speaker_qa=False
    )
    soundscape = report["soundscape"]
    assert (soundscape["bed_count"], soundscape["event_count"]) == (1, 1)
    assert soundscape["continuous_ambience"] is True
    assert soundscape["configured_gain_min_db"] == -24.0
    assert soundscape["warnings"] == []


def test_a_scene_without_a_bed_warns_that_it_falls_silent(tmp_path: Path) -> None:
    reference = tone_in_store(tmp_path)
    timeline = [row for row in cafe_scene(reference).timeline if row.type != "ambience"]
    scene = cafe_scene(reference, timeline=timeline)
    result = render(scene, tmp_path)
    report = scene_qa(
        scene, result.directory, transcribe_fn=perfect(scene), speaker_qa=False
    )
    assert report["soundscape"]["bed_count"] == 0
    assert "falls silent" in report["soundscape"]["warnings"][0]


def test_a_skipped_speaker_check_says_so_rather_than_going_missing(
    rendered, monkeypatch: pytest.MonkeyPatch
) -> None:  # type: ignore[no-untyped-def]
    """An absent field would read exactly like a report that passed identity."""

    import listening_studio.graph.scene_qa as module

    scene, result = rendered
    monkeypatch.setattr(module, "weights_available", lambda: False)
    report = scene_qa(scene, result.directory, transcribe_fn=perfect(scene))
    assert report["speaker_qa"] == WEIGHTS_MISSING


def test_speaker_consistency_runs_against_the_slices_when_a_backend_is_given(
    rendered,
) -> None:  # type: ignore[no-untyped-def]
    """A stand-in embedder proves the wiring: one vector per role, read from the QA slices."""

    import numpy as np
    import numpy.typing as npt

    scene, result = rendered
    calls: list[int] = []

    class Backend:
        def embed(
            self, samples: npt.NDArray[np.float32], sample_rate: int
        ) -> npt.NDArray[np.float64]:
            calls.append(sample_rate)
            return np.asarray([1.0, 0.0, 0.0], dtype=np.float64)

    report = scene_qa(
        scene, result.directory, transcribe_fn=perfect(scene), embedding_backend=Backend()
    )
    identity = report["speaker_qa"]
    assert isinstance(identity, dict)
    assert [row["speaker"] for row in identity["characters"]] == ["Mara", "Jonas"]
    # WavLM refuses anything but 16 kHz, which is exactly why `qa.wav` is the QA derivative.
    assert set(calls) == {QA_RATE}


def test_qa_refuses_a_directory_that_holds_no_render(tmp_path: Path) -> None:
    scene = cafe_scene(tone_in_store(tmp_path))
    with pytest.raises(ValueError, match="render the scene before QA"):
        scene_qa(scene, tmp_path / "nowhere", transcribe_fn=perfect(scene))


# -- the shared threshold table ------------------------------------------------


def test_one_threshold_table_serves_both_pipelines() -> None:
    """`check_units` is what `check_transcripts` and `scene_qa` both call. Same evidence, once."""

    passing = check_units([("a", "Guten Tag")], {"a": "Guten Tag"})
    assert passing.passed is True
    failing = check_units([("a", "Guten Tag")], {"a": ""})
    assert failing.passed is False and failing.failures[0].startswith("a: ")


def test_a_single_word_slip_in_a_short_line_is_forgiven() -> None:
    """The "or one word" clause: a four-word greeting must not fail on one article."""

    report = check_units(
        [("a", "Mit Milch, bitte.")], {"a": "Mit Milch bitte dann"}
    )
    assert report.lines[0].passed is True
