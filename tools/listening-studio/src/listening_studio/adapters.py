"""The render half of the pipeline: everything that happens to audio after a model made it.

Generation itself lives in `generative/`. The boundary is deliberate — pace, resampling,
concatenation and mixing are DSP, and asking a speech model for them is how one take ends up
regenerated for every variant it appears in.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable, Mapping, cast

from .domain import Line, RevisionPayload, line_cache_key
from .generative.fake import FakeClone, FakeSound, FakeSpeech
from .generative.gateway import ClonableVoice, SoundGenerator, SpeechGenerator, SpeechRequest
from .generative.locks import locked_snapshot
from .generative.qwen import QwenSpeech
from .generative.qwen_clone import QwenBaseClone
from .generative.stable_audio_mlx import StableAudioSfx
from .sources import load_source

log = logging.getLogger(__name__)

# The stored `tts_adapter` name, and the engine it selects. Two entries, and the switch used to
# be written out at four call sites — web, the studio API, the CLI and the authoring reports —
# which is four places to forget one when an engine is added or removed.
ENGINES: dict[str, type[QwenSpeech] | type[FakeSpeech] | type[QwenBaseClone] | type[FakeClone]] = {
    "qwen_tts": QwenSpeech,
    "qwen_tts_base": QwenBaseClone,
    "fake": FakeSpeech,
    "fake_clone": FakeClone,
}

#: The engines whose speech comes from a stored voice reference. One reading of that fact, because
#: three places need it and each of them would otherwise carry its own list: the claims computation
#: in `export`, the engine constructor below, and the render path that has to resolve voices before
#: it can build an engine at all.
CLONING_ENGINES: frozenset[str] = frozenset({"qwen_tts_base", "fake_clone"})

# The same table for non-speech sound, and deliberately a second one rather than a merged
# registry: the two protocols take different requests, and a caller that could look a speech
# engine up by a sound engine's name would be one typo away from a scene cast on a tone
# generator. The key is the name a command line uses; `FakeSound.name` stays `fake_sound`, which
# is what a provenance record and a render manifest report, because that is what produced the
# bytes.
SOUND_ENGINES: dict[str, type[StableAudioSfx] | type[FakeSound]] = {
    "stable_audio_sfx": StableAudioSfx,
    "fake": FakeSound,
}


def engine_for(name: str, voices: Mapping[str, ClonableVoice] | None = None) -> SpeechGenerator:
    """The engine a stored payload names. Never a gate — the fake-engine gate stays at the caller.

    `voices` is the resolved set of stored voice references this render may synthesize through, and
    it reaches only a cloning engine. It is **injected here rather than looked up there** so that
    `generative/` keeps knowing nothing about a database: the store, the app-data root and the
    revocation check all live on this side of the boundary, and a model can be replaced without
    taking the consent rules with it.
    """

    try:
        engine = ENGINES[name]
    except KeyError:
        raise ValueError(f"unknown synthesis engine {name}") from None
    if name in CLONING_ENGINES:
        return cast(SpeechGenerator, engine(voices or {}))  # type: ignore[call-arg]
    return cast(SpeechGenerator, engine())


def engine_revision(name: str) -> str:
    """The revision cache paths are keyed by, without constructing the engine."""

    try:
        return ENGINES[name].revision
    except KeyError:
        raise ValueError(f"unknown synthesis engine {name}") from None


def sound_engine_for(name: str) -> SoundGenerator:
    """The sound engine a command line names. Constructing it downloads and loads nothing."""

    try:
        return SOUND_ENGINES[name]()
    except KeyError:
        raise ValueError(
            f"unknown sound engine {name}; known: {', '.join(sorted(SOUND_ENGINES))}"
        ) from None


def speech_request(line: Line) -> SpeechRequest:
    """One resolved line, as the engine-neutral request. `pace` is not in it — it is DSP."""

    return SpeechRequest(
        text=line.spoken_text(),
        voice=line.voice,
        language="German",
        style=line.style,
        seed=line.seed,
    )


def warn_if_style_is_inert(engine: SpeechGenerator, styled: bool) -> None:
    """One warning per generation run when a styled line meets an engine that discards style.

    Not per line: a twelve-turn dialogue would print twelve identical lines and teach the editor
    to scroll past them. Not an error either — the style is still the editorial record of how the
    turn should be delivered, and a bigger checkpoint would honour it.
    """

    if styled and not engine.supports_style:
        log.warning(
            "%s does not apply style instructions: the delivery notes on these lines are stored "
            "and hashed, but they do not reach the audio (docs/quality/tts-reliability.md)",
            engine.name,
        )


def render_line(engine: SpeechGenerator, line: Line, target: Path) -> None:
    """Generate one line, then apply pace and the 16 kHz mono format outside the engine."""

    target.parent.mkdir(parents=True, exist_ok=True)
    # Appended, not `with_suffix`: a target name containing a dot would otherwise lose part of
    # itself and two lines could collide on one intermediate file.
    raw = target.with_name(target.name + ".model.wav")
    try:
        engine.generate(speech_request(line), raw)
        conform(raw, target, line.pace)
    finally:
        raw.unlink(missing_ok=True)


def wav_duration(path: Path) -> float | None:
    """Seconds of audio, or None when the file is missing or unreadable.

    The approval page states this against the plan's `duration_seconds` window, because
    "is the pace right for this level" is not answerable from the recording alone — a take can
    sound perfectly paced and still be half the length the curriculum asked for.
    """

    if not path.exists():
        return None
    try:
        import soundfile as sf

        return float(sf.info(str(path)).duration)
    except Exception:
        return None


def conform(
    source: Path,
    target: Path,
    pace: float = 1.0,
    *,
    rate: int = 16000,
    channels: int = 1,
    codec: str = "pcm_s16le",
) -> None:
    """Apply pace and a target PCM format to a model's raw output.

    The whole of what an engine's audio has done to it before it reaches the timeline. `atempo`
    changes duration without changing pitch, which is why pace is a filter here rather than a
    generation parameter — the same take can be re-paced without asking the model again.

    The three format arguments default to the corpus format (16 kHz mono `pcm_s16le`), which is
    what every legacy caller passes and what the line cache, Whisper QA and `speaker_qa` all
    require. They exist because the scene render graph works at 48 kHz (`graph.nodes`) and the
    pace step there is the same computation against a different destination — re-implementing
    `atempo` next to a second ffmpeg invocation is how two pace behaviours start to diverge.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    filters = [f"atempo={pace}"] if pace != 1.0 else []
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(source),
            *(["-filter:a", ",".join(filters)] if filters else []),
            "-ar",
            str(rate),
            "-ac",
            str(channels),
            "-c:a",
            codec,
            "-y",
            str(target),
        ],
        check=True,
    )


def write_with_pace(
    target: Path, samples: object, rate: int, pace: float, soundfile_module: Any
) -> None:
    """In-memory samples to a conformed WAV. For research paths that hold their own model."""

    target.parent.mkdir(parents=True, exist_ok=True)
    raw = target.with_suffix(".raw.wav")
    soundfile_module.write(raw, samples, rate)
    try:
        conform(raw, target, pace)
    finally:
        raw.unlink(missing_ok=True)


def transcribe(path: Path) -> str:
    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError("Install the pinned MLX Whisper adapter before running QA") from exc
    model_path = locked_snapshot(
        "mlx-community/whisper-large-v3-turbo",
        "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb",
    )
    # `condition_on_previous_text=False` is the guard against Whisper's long-form repetition
    # loop. Three Wave-2 takes transcribed their whole script correctly and then degenerated —
    # "ist mir klar, ist mir klar, ist mir klar…" for hundreds of characters — which scored full
    # WER 1.6 to 1.9 while every individual line passed at 0.00. That signature is unmistakable:
    # the speech is fine and the decoder is feeding its own output back to itself. Conditioning
    # on previous text buys fluency across segment boundaries, which is worth nothing here — the
    # comparison is against a script we already have, word by word.
    result = mlx_whisper.transcribe(
        str(path),
        path_or_hf_repo=model_path,
        language="de",
        condition_on_previous_text=False,
    )
    return str(result["text"]).strip()


def draft_prompt(payload: RevisionPayload) -> str:
    return (
        "Return only JSON matching the supplied draft shape. Create natural German at the declared "
        "CEFR level, use only the supplied curriculum vocabulary/grammar, retain EN and RU feedback, "
        "and make every question answerable from sound and meaning rather than one keyword. "
        "Replace every editorial placeholder, including feedback and answer options. Use four to "
        "eight short dialogue turns for two or more speakers, or three to five short paragraphs for "
        "one speaker. Keep the total spoken length close to the requested duration. Preserve the "
        "requested three response kinds and all stable ids. "
        # The site shuffles an item's options on every render, so "the second option" names
        # nothing. Fourteen of the first forty-one published sets said it anyway, in both
        # halves, and `scripts/validate.ts` now rejects the shape — but a validator that fires
        # after synthesis and approval costs a rewrite pass, and this line costs nothing.
        "In feedback, identify a choice by quoting what it says, never by its position: the "
        "options are shuffled before the learner sees them, so 'the second option' is wrong for "
        "most readers. "
        "Never add voice cloning, music, effects, or reference audio. Context sounds are selected "
        "separately by a human and must not be invented by the text model.\nDRAFT SHAPE:\n"
        + payload.model_dump_json(indent=2)
    )


def generate_draft(payload: RevisionPayload) -> RevisionPayload:
    return generate_drafts([payload])[0]


def generate_drafts(
    payloads: list[RevisionPayload],
    on_draft: Callable[[int, RevisionPayload], None] | None = None,
    on_error: Callable[[int, Exception], None] | None = None,
) -> list[RevisionPayload]:
    """Generate several editorial drafts while loading the MLX model only once."""

    try:
        from mlx_lm import generate, load
    except ImportError as exc:
        raise RuntimeError("Install the pinned MLX generation adapter first") from exc
    model_path = locked_snapshot(
        "mlx-community/Qwen3-4B-Instruct-2507-4bit",
        "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b",
    )
    loaded: Any = load(model_path)
    model, tokenizer = loaded[0], loaded[1]
    drafts: list[RevisionPayload] = []
    for index, payload in enumerate(payloads):
        try:
            # Captured before the call, not rebuilt after it: this is the string the model
            # actually received, and it is what the published manifest must carry.
            submitted = draft_prompt(payload)
            response = generate(model, tokenizer, prompt=submitted, max_tokens=8192)
            start = response.find("{")
            if start < 0:
                raise RuntimeError("generator did not return a JSON object")
            try:
                decoded, _ = json.JSONDecoder().raw_decode(response[start:])
            except json.JSONDecodeError as exc:
                raise RuntimeError("generator did not return one complete JSON object") from exc
            generated = RevisionPayload.model_validate(decoded)
            final = generated.model_dump(mode="json")
            final.update(
                {
                    "brief": payload.brief.model_dump(mode="json"),
                    # The project's own engine, not a hard-coded one. This used to force
                    # `parler_tts` without reassigning the voices with it, so a draft could be
                    # written with voices that engine does not offer — and the store then
                    # refused to load the project it had just written.
                    "tts_adapter": payload.tts_adapter,
                    "context_sounds": [
                        sound.model_dump(mode="json") for sound in payload.context_sounds
                    ],
                    "max_replays": payload.max_replays,
                    "authoring": "generated",
                    "generation_prompt": submitted,
                }
            )
            draft = RevisionPayload.model_validate(final)
            drafts.append(draft)
            if on_draft is not None:
                on_draft(index, draft)
        except Exception as exc:
            if on_error is None:
                raise
            on_error(index, exc)
    return drafts


def generate_lines(
    payload: RevisionPayload, root: Path, engine: SpeechGenerator
) -> dict[str, Path]:
    resolved_lines = [payload.resolved_line(line) for line in payload.lines]
    warn_if_style_is_inert(engine, any(line.style for line in resolved_lines))
    paths: dict[str, Path] = {}
    for line, resolved in zip(payload.lines, resolved_lines, strict=True):
        # Style is part of the cache key even where it is inert, so an engine that does honour it
        # cannot be served a take generated without it. Cache identity is restructured by the
        # render-graph work; until then, see docs/quality/tts-reliability.md for why a 0.6B key
        # can differ while the audio cannot.
        key = payload.cache_key(line, engine.revision)
        path = root / "cache" / f"{key}.wav"
        if not path.exists():
            profile = payload.profile_for(line.speaker)
            previous = (
                root
                / "cache"
                / f"{line_cache_key(resolved, engine.revision, f'3-profile-v{profile.version}')}.wav"
                if profile is not None
                else None
            )
            if previous is not None and previous.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    [
                        "ffmpeg",
                        "-v",
                        "error",
                        "-i",
                        str(previous),
                        "-ar",
                        "16000",
                        "-ac",
                        "1",
                        "-c:a",
                        "pcm_s16le",
                        "-y",
                        str(path),
                    ],
                    check=True,
                )
            else:
                render_line(engine, resolved, path)
        paths[line.id] = path
    return paths


def assemble(payload: RevisionPayload, lines: dict[str, Path], target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    concat = target.with_suffix(".concat.txt")
    raw = target.with_suffix(".unnormalized.wav")
    parts: list[str] = []
    for index, line in enumerate(payload.lines):
        parts.append(f"file '{lines[line.id].as_posix()}'")
        # No silence after the final line. A pause between turns is what a listener catches up
        # in; a pause at the end is trailing silence, and Whisper answers trailing silence by
        # repeating the last sentence it heard — which showed up as a duplicated closing line in
        # the full-audio QA transcript and pushed a clean take over the 8% threshold.
        if line.pause_after_ms and index < len(payload.lines) - 1:
            silence = target.parent / f"silence-{line.pause_after_ms}.wav"
            if not silence.exists():
                subprocess.run(
                    [
                        "ffmpeg",
                        "-v",
                        "error",
                        "-f",
                        "lavfi",
                        "-i",
                        "anullsrc=r=16000:cl=mono",
                        "-t",
                        str(line.pause_after_ms / 1000),
                        "-y",
                        str(silence),
                    ],
                    check=True,
                )
            parts.append(f"file '{silence.as_posix()}'")
    concat.write_text("\n".join(parts) + "\n")
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-af",
            "loudnorm=I=-19:TP=-1.5:LRA=7",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            "-y",
            str(raw),
        ],
        check=True,
    )
    raw.replace(target)
    concat.unlink(missing_ok=True)


def mix_context(payload: RevisionPayload, source_root: Path, dry: Path, target: Path) -> None:
    """Create a deterministic final mix; contextual audio is never louder than -12 dB."""

    if not payload.context_sounds and not payload.lead_in_ms:
        shutil.copy2(dry, target)
        return
    command = ["ffmpeg", "-v", "error", "-i", str(dry)]
    filters: list[str] = []
    # The speech is the first mix input, and `duration=first` measures the mix against it —
    # so delaying the speech is what makes room for a sound *before* anyone talks, and the
    # mix simply grows by the same amount. Delaying the context sound instead can only ever
    # push it further into the dialogue.
    speech = "[0:a]"
    if payload.lead_in_ms:
        filters.append(f"[0:a]adelay={payload.lead_in_ms}|{payload.lead_in_ms}[speech]")
        speech = "[speech]"
    mix_inputs = [speech]
    mix_duration = (wav_duration(dry) or 0) + payload.lead_in_ms / 1000
    for index, context in enumerate(payload.context_sounds, 1):
        source, source_path = load_source(source_root, context.source_sha256)
        if source.sound_id != context.sound_id:
            raise ValueError("context sound id does not match its imported source")
        if context.role == "bed":
            command.extend(["-stream_loop", "-1"])
        command.extend(["-i", str(source_path)])
        start = context.start_ms / 1000
        duration = context.duration_ms / 1000
        if context.role == "bed":
            fade_out = max(0.0, mix_duration - 0.45)
            processing = (
                f"atrim=start={start}:duration={mix_duration},asetpts=PTS-STARTPTS,"
                f"afade=t=in:st=0:d=0.35,afade=t=out:st={fade_out}:d=0.45"
            )
        else:
            processing = f"atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS"
        filters.append(
            f"[{index}:a]{processing},adelay={context.delay_ms}|{context.delay_ms},"
            f"volume={context.gain_db}dB[c{index}]"
        )
        mix_inputs.append(f"[c{index}]")
    filters.append(
        "".join(mix_inputs)
        + f"amix=inputs={len(mix_inputs)}:duration=first:normalize=0,"
        "alimiter=limit=0.8414[out]"
    )
    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[out]",
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            "-y",
            str(target),
        ]
    )
    subprocess.run(command, check=True)


def model_lock(path: Path) -> dict[str, object]:
    return cast(dict[str, object], json.loads(path.read_text()))
