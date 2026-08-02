from __future__ import annotations

import json
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any, Callable, Protocol, cast

from huggingface_hub import snapshot_download

from .domain import Line, RevisionPayload, line_cache_key
from .sources import load_source


class TTSAdapter(Protocol):
    name: str
    revision: str

    def synthesize(self, line: Line, target: Path) -> None: ...


class FakeTTS:
    """Deterministic silence adapter for tests and UI workflow development."""

    name = "fake"
    revision = "fake-v1"

    def synthesize(self, line: Line, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        frames = int(16000 * max(0.25, len(line.spoken_text()) / 14))
        with wave.open(str(target), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\0\0" * frames)


class QwenTTS:
    name = "qwen_tts"
    revision = "85e237c12c027371202489a0ec509ded67b5e4b5"

    def __init__(self) -> None:
        self._model: Any = None

    def synthesize(self, line: Line, target: Path) -> None:
        try:
            from qwen_tts import Qwen3TTSModel
            import soundfile as sf
        except ImportError as exc:
            raise RuntimeError(
                "Install the pinned Qwen MLX adapter before generating audio"
            ) from exc
        if self._model is None:
            model_path = locked_snapshot("Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice", self.revision)
            self._model = Qwen3TTSModel.from_pretrained(model_path)
        import torch

        torch.manual_seed(line.seed)
        wavs, rate = self._model.generate_custom_voice(
            text=line.spoken_text(), language="German", speaker=line.voice
        )
        write_with_pace(target, wavs[0], rate, line.pace, sf)


class ParlerTTS:
    name = "parler_tts"
    revision = "11b27d57855dec1ce0914ba1f12363bf2ea75ba3"

    def __init__(self) -> None:
        self._model: Any = None
        self._tokenizer: Any = None
        self._description_tokenizer: Any = None
        self._device = "cpu"

    def synthesize(self, line: Line, target: Path) -> None:
        try:
            import soundfile as sf
            import torch
            from parler_tts import ParlerTTSForConditionalGeneration
            from transformers import AutoTokenizer
        except ImportError as exc:
            raise RuntimeError("Install the pinned Parler adapter before generating audio") from exc
        if self._model is None:
            model_path = locked_snapshot(
                "parler-tts/parler-tts-mini-multilingual-v1.1", self.revision
            )
            self._device = "mps" if torch.backends.mps.is_available() else "cpu"
            self._model = ParlerTTSForConditionalGeneration.from_pretrained(model_path).to(
                self._device
            )
            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            tokenizer_path = locked_snapshot(
                "google/flan-t5-large",
                "0613663d0d48ea86ba8cb3d7a44f0f65dc596a2a",
                [
                    "tokenizer.json",
                    "tokenizer_config.json",
                    "spiece.model",
                    "special_tokens_map.json",
                ],
            )
            self._description_tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
        description = (
            f"{line.voice}'s German voice is clear, close, natural, and has no background noise."
        )
        torch.manual_seed(line.seed)
        input_ids = self._description_tokenizer(description, return_tensors="pt").input_ids.to(
            self._device
        )
        prompt_ids = self._tokenizer(line.spoken_text(), return_tensors="pt").input_ids.to(
            self._device
        )
        generation = self._model.generate(input_ids=input_ids, prompt_input_ids=prompt_ids)
        write_with_pace(
            target,
            generation.cpu().numpy().squeeze(),
            self._model.config.sampling_rate,
            line.pace,
            sf,
        )


def locked_snapshot(model_id: str, revision: str, allow_patterns: list[str] | None = None) -> str:
    try:
        return snapshot_download(
            repo_id=model_id,
            revision=revision,
            allow_patterns=allow_patterns,
            local_files_only=True,
        )
    except Exception as exc:
        raise RuntimeError(
            f"{model_id}@{revision} is not installed; run atlas-listening models fetch first"
        ) from exc


def write_with_pace(
    target: Path, samples: object, rate: int, pace: float, soundfile_module: Any
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if pace == 1.0:
        soundfile_module.write(target, samples, rate)
        return
    raw = target.with_suffix(".raw.wav")
    soundfile_module.write(raw, samples, rate)
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(raw),
            "-filter:a",
            f"atempo={pace}",
            "-y",
            str(target),
        ],
        check=True,
    )
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
    result = mlx_whisper.transcribe(str(path), path_or_hf_repo=model_path, language="de")
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
        from mlx_lm import generate, load  # type: ignore[attr-defined]
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
                    "tts_adapter": "parler_tts",
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


def generate_lines(payload: RevisionPayload, root: Path, adapter: TTSAdapter) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    for line in payload.lines:
        key = line_cache_key(line, adapter.revision)
        path = root / "cache" / f"{key}.wav"
        if not path.exists():
            adapter.synthesize(line, path)
        paths[line.id] = path
    return paths


def assemble(payload: RevisionPayload, lines: dict[str, Path], target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    concat = target.with_suffix(".concat.txt")
    raw = target.with_suffix(".unnormalized.wav")
    parts: list[str] = []
    for line in payload.lines:
        parts.append(f"file '{lines[line.id].as_posix()}'")
        if line.pause_after_ms:
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

    if not payload.context_sounds:
        shutil.copy2(dry, target)
        return
    command = ["ffmpeg", "-v", "error", "-i", str(dry)]
    filters: list[str] = []
    mix_inputs = ["[0:a]"]
    for index, context in enumerate(payload.context_sounds, 1):
        source, source_path = load_source(source_root, context.source_sha256)
        if source.sound_id != context.sound_id:
            raise ValueError("context sound id does not match its imported source")
        command.extend(["-i", str(source_path)])
        start = context.start_ms / 1000
        duration = context.duration_ms / 1000
        filters.append(
            f"[{index}:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,"
            f"adelay={context.delay_ms}|{context.delay_ms},volume={context.gain_db}dB[c{index}]"
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
