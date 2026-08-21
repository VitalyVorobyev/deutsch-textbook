"""Qwen3-TTS CustomVoice, behind the gateway."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .gateway import AudioAsset, SpeechRequest
from .locks import locked_snapshot


class QwenSpeech:
    name = "qwen_tts"
    revision = "85e237c12c027371202489a0ec509ded67b5e4b5"
    model_id = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
    adapter_code_revision = "QwenLM/Qwen3-TTS@022e286b98fbec7e1e916cb940cdf532cd9f488e"
    #: Matches the `qwen_tts` entry in `models.lock.json`; `tests/test_domain.py` holds them equal.
    license = "Apache-2.0"
    # Measured, not assumed: upstream's `generate_custom_voice` runs
    # `if self.model.tts_model_size in "0b6": instruct = None`, and this checkpoint's
    # `tts_model_size` is exactly `"0b6"` — so every style instruction is discarded before it
    # reaches the model. The instruction is still passed below (a larger checkpoint would use
    # it), but this engine must not claim a capability its audio does not carry.
    # Source, code and rejected alternatives: docs/quality/tts-reliability.md.
    supports_style = False

    def __init__(self) -> None:
        self._model: Any = None

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset:
        if request.params:
            # Silently dropping an engine-specific parameter is the failure this gateway exists
            # to prevent; refusing is the only honest answer for an engine that takes none.
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        if request.voice_ref is not None:
            # CustomVoice has nine preset speakers and no cloning path. Ignoring the field would
            # produce a perfectly good take **in the wrong person's voice** and report success —
            # the one failure a consent-gated feature must not have.
            raise ValueError(
                f"{self.name} cannot synthesize through a voice reference "
                f"({request.voice_ref}); cast the role on qwen_tts_base instead"
            )
        try:
            import torch
            from qwen_tts import Qwen3TTSModel
            import soundfile as sf
        except ImportError as exc:
            raise RuntimeError(
                "Install the pinned Qwen MLX adapter before generating audio"
            ) from exc
        if self._model is None:
            model_path = locked_snapshot(self.model_id, self.revision)
            # Device and dtype are stated here, never inherited. `from_pretrained` with neither
            # loads on CPU, and the upstream wrapper forwards whatever the loader picked — so the
            # placement this engine runs on was an accident of the installed transformers rather
            # than a decision. float16 on MPS is the accident that costs something: the talker's
            # sampling logits overflow and generation dies with `torch.AcceleratorError:
            # probability tensor contains either `inf`, `nan` or element < 0` — within half a
            # second, on every line it was given, and it is the signature the 2026-08-01 run
            # recorded as "Qwen is unreliable on this machine". float32 on MPS ran 74 generations
            # with no failure and no NaN. Numbers, method and the rejected alternatives (bfloat16
            # is faster and was still declined): docs/quality/tts-reliability.md.
            self._model = Qwen3TTSModel.from_pretrained(
                model_path,
                device_map="mps" if torch.backends.mps.is_available() else "cpu",
                dtype=torch.float32,
            )

        torch.manual_seed(request.seed)
        style = {"instruct": request.style} if request.style else {}
        wavs, rate = self._model.generate_custom_voice(
            text=request.text, language=request.language, speaker=request.voice, **style
        )
        # The model's own rate and the model's own samples: pace and resampling are applied
        # after generation, so one take can be re-paced without asking the model again.
        target.parent.mkdir(parents=True, exist_ok=True)
        sf.write(target, wavs[0], rate)
        return AudioAsset.record(
            target,
            int(rate),
            engine=self.name,
            model_id=self.model_id,
            model_revision=self.revision,
            adapter_code_revision=self.adapter_code_revision,
            license=self.license,
            seed=request.seed,
            request_sha256=request.sha256(),
            params=request.params,
        )
