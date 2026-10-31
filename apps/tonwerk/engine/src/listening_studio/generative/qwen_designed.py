"""Qwen3-TTS **1.7B Base**, behind the gateway: every roster character's designed voice.

The production speech engine of the roster (ADR 0013). Each character speaks through one designed
synthetic reference — a clip the VoiceDesign checkpoint spoke from a written description of a
fictional person — and this checkpoint clones it for every line. One model, one checkpoint, and
the character's catalog pace brings the clones back to the corpus's speaking rate.

A sibling of `qwen_clone.QwenBaseClone`, not a mode of it. The consented engine resolves a stored
*person* through the consent store; this one resolves a *synthetic* reference by digest, needs no
consent, and runs on the larger checkpoint. One class answering both would have to say "it
depends" to the questions the manifest asks of it.

**A cast member names its voice by the reference's SHA-256** (`VoiceSpec.voice`), and `voice_ref`
stays null. The digest is in the request, so the synth node's hash covers the reference bytes.

**The references are injected.** The engine never looks up the store or the app-data root; the
caller resolves the digests the cast names (`generative.designed.resolve_designed`) and a digest
that was not resolved is refused here rather than spoken in some other voice.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from .gateway import AudioAsset, DesignedVoice, SpeechRequest
from .locks import locked_snapshot
from .qwen_clone import MAX_NEW_TOKENS


class QwenDesignedClone:
    """Cloned speech from a designed synthetic reference held in app data."""

    name = "qwen_tts_designed"
    revision = "fd4b254389122332181a7c3db7f27e918eec64e3"
    model_id = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
    adapter_code_revision = "QwenLM/Qwen3-TTS@022e286b98fbec7e1e916cb940cdf532cd9f488e"
    #: Matches the `qwen_tts_designed` entry in `models.lock.json`; `tests/test_designed.py` holds
    #: them equal.
    license = "Apache-2.0"
    #: The Base checkpoint takes no instruction: `generate_voice_clone` has no `instruct`. The
    #: delivery a designed voice has is the one its description gave the reference.
    supports_style = False

    def __init__(self, designed: Mapping[str, DesignedVoice] | None = None) -> None:
        self._designed: dict[str, DesignedVoice] = dict(designed or {})
        self._model: Any = None
        self._prompts: dict[str, Any] = {}

    def voice_for(self, request: SpeechRequest) -> DesignedVoice:
        """The designed reference this request names, or a refusal that says why.

        Separate from `generate` so the refusals hold without the speech runtime installed: a cast
        on a digest this machine does not hold must never be answered in another voice.
        """

        if request.params:
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        if request.voice_ref is not None:
            raise ValueError(
                f"{self.name} speaks designed voices, not consented ones ({request.voice_ref}); "
                "cast a consented voice on qwen_tts_base"
            )
        voice = self._designed.get(request.voice)
        if voice is None:
            raise ValueError(
                f"{self.name} was not given designed reference {request.voice[:12]}; the clip is "
                "not in this studio's app data, or the caller did not resolve it — run "
                "`atlas-listening voices adopt-designed <run>` on this machine"
            )
        return voice

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset:
        voice = self.voice_for(request)
        try:
            import soundfile as sf
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as exc:
            raise RuntimeError(
                "Install the pinned Qwen MLX adapter before generating audio"
            ) from exc

        if self._model is None:
            # float32 on MPS, stated rather than inherited: `QwenSpeech` records why.
            self._model = Qwen3TTSModel.from_pretrained(
                locked_snapshot(self.model_id, self.revision),
                device_map="mps" if torch.backends.mps.is_available() else "cpu",
                dtype=torch.float32,
            )

        prompt = self._prompt_for(voice)
        torch.manual_seed(request.seed)
        wavs, rate = self._model.generate_voice_clone(
            text=request.text,
            language=request.language,
            voice_clone_prompt=prompt,
            # The bound `qwen_clone` documents: an unbounded generation is a take that keeps
            # talking after the line ended.
            max_new_tokens=MAX_NEW_TOKENS,
        )
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

    def _prompt_for(self, voice: DesignedVoice) -> Any:
        """The clone prompt, built once per reference per process, exactly as the evaluation did.

        The reference transcript conditions the clone (`x_vector_only_mode=False`), which is how
        `evaluation.QwenEvaluationBackend.clone` produced the takes the owner chose.
        """

        cached = self._prompts.get(voice.reference_sha256)
        if cached is None:
            cached = self._model.create_voice_clone_prompt(
                ref_audio=str(voice.reference_path),
                ref_text=voice.reference_text,
                x_vector_only_mode=False,
            )
            self._prompts[voice.reference_sha256] = cached
        return cached
