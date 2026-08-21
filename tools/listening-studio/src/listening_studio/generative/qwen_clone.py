"""Qwen3-TTS **Base**, behind the gateway: synthesis through a consented voice reference.

The sibling of `qwen.py` and deliberately a separate class rather than a mode of it. `CustomVoice`
speaks nine preset speakers and cannot clone; `Base` clones and has no presets. One class with a
flag would have had to answer "which voice does this engine offer" with "it depends", and that
question is asked by the cast editor, the render path and the manifest.

**What is pinned, and where.** The checkpoint used to live in `benchmark-models.lock.json` under
`purpose: research-only … forbidden from production export`. That is no longer the policy
(`docs/authoring/product-protection.md`), so the pin moved into `models.lock.json` beside the other
production models, with its licence and the same training-data honesty note they all carry. The
benchmark lock keeps VoiceDesign, which really is research-only. The revision is stated **here**
once and read from there by `voice_benchmark`, so there is one pin rather than two that can drift.

**This engine never decides whether a clone is allowed.** It is handed a `ClonableVoice` whose
consent was validated by `generative.voices` before the store wrote a row. See `VoiceCloning`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

from .gateway import AudioAsset, ClonableVoice, SpeechRequest, VoiceRef
from .locks import locked_snapshot

#: 20 seconds at the 12 Hz codec. The same cap `human_voice_experiment` set, and for the reason it
#: recorded: a 2048-token runaway continuation was observed on this checkpoint, and an unbounded
#: generation is a take that keeps talking after the line ended.
MAX_NEW_TOKENS = 240


class QwenBaseClone:
    """Cloned speech from a stored, consented reference."""

    name = "qwen_tts_base"
    revision = "5d83992436eae1d760afd27aff78a71d676296fc"
    model_id = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
    adapter_code_revision = "QwenLM/Qwen3-TTS@022e286b98fbec7e1e916cb940cdf532cd9f488e"
    #: Matches the `qwen_tts_base` entry in `models.lock.json`; `tests/test_voices.py` holds them
    #: equal, the way `test_domain` does for the CustomVoice row.
    license = "Apache-2.0"
    #: The Base checkpoint takes no style instruction at all — `generate_voice_clone` has no
    #: `instruct` parameter. Stated as False rather than left unstated, so a scene cast on a clone
    #: with a delivery note gets the gateway's warning instead of silence.
    supports_style = False
    #: The optional capability. Read through `gateway.supports_cloning`, never by attribute.
    supports_cloning = True

    def __init__(self, voices: Mapping[str, ClonableVoice] | None = None) -> None:
        """`voices` is what this engine may synthesize through, resolved by the caller.

        Injected rather than looked up. The engine has no store, no app-data root and no idea that
        a database exists — which is what keeps `generative/` importable by a test that has never
        run a migration, and what stops the revocation check from living somewhere a model could
        be swapped out from under it.
        """

        self._voices: dict[str, ClonableVoice] = dict(voices or {})
        self._model: Any = None
        self._prompts: dict[str, Any] = {}

    # -- the capability -------------------------------------------------------

    def make_voice(
        self,
        *,
        voice_id: str,
        reference: Path,
        reference_sha256: str,
        ref_text: str | None,
        consent_sha256: str,
        x_vector_only: bool,
    ) -> VoiceRef:
        """Bind one consented recording to this checkpoint, and say so.

        Deliberately cheap: it resolves the pinned snapshot and reads nothing else. Building the
        clone prompt here would load 0.6B of weights to register a row, and would cache a tensor
        against a process that is about to answer an HTTP request and exit. The prompt is built on
        first synthesis instead (`_prompt_for`).

        What it *does* refuse is a voice this machine could never speak in: absent weights raise
        `RuntimeError` with the installer named, which the API turns into a 409. Writing a row for
        a voice that can never be synthesized is a catalogue entry that lies.
        """

        if not reference.exists():
            raise ValueError(f"the reference recording {reference} is not on this machine")
        locked_snapshot(self.model_id, self.revision)
        del ref_text, x_vector_only  # recorded on the row; not needed to bind the identity
        return VoiceRef(
            id=voice_id,
            engine=self.name,
            model_revision=self.revision,
            reference_sha256=reference_sha256,
            consent_sha256=consent_sha256,
        )

    # -- synthesis ------------------------------------------------------------

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset:
        if request.params:
            raise ValueError(f"{self.name} accepts no engine parameters: {sorted(request.params)}")
        if request.voice_ref is None:
            # The mirror of `QwenSpeech`'s refusal below. This engine has no preset speakers at
            # all, so a request without a stored voice is not "a different voice" — it is a
            # request the checkpoint cannot answer, and answering it in *some* voice would be the
            # worst possible failure mode for a module about consent.
            raise ValueError(
                f"{self.name} synthesizes only through a stored voice reference; "
                "this request names none"
            )
        voice = self._voices.get(request.voice_ref)
        if voice is None:
            known = ", ".join(sorted(self._voices)) or "none"
            raise ValueError(
                f"{self.name} was not given voice reference {request.voice_ref}; "
                f"resolved for this render: {known}"
            )

        try:
            import soundfile as sf
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as exc:
            raise RuntimeError(
                "Install the pinned Qwen MLX adapter before generating audio"
            ) from exc

        if self._model is None:
            # Device and dtype stated, never inherited — the identical decision `QwenSpeech`
            # documents at length. float16 on MPS overflows the talker's sampling logits and dies
            # with `probability tensor contains either inf, nan or element < 0`; float32 on MPS is
            # what ran clean. Measurements: docs/quality/tts-reliability.md.
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
            voice=voice.ref,
        )

    def _prompt_for(self, voice: ClonableVoice) -> Any:
        """The clone prompt, built once per voice per process.

        `x_vector_only` is the voice's own recorded setting and not a request parameter: it changes
        what the model is conditioned on and therefore what the take sounds like, so it belongs to
        the *identity* — two voices from one recording that differ in this mode are two voices.
        """

        cached = self._prompts.get(voice.ref.id)
        if cached is not None:
            return cached
        if voice.x_vector_only:
            prompt = self._model.create_voice_clone_prompt(
                ref_audio=str(voice.reference_path), x_vector_only_mode=True
            )
        else:
            if not voice.ref_text:
                raise ValueError(
                    f"voice reference {voice.ref.id} has no reference transcript and is not in "
                    "x-vector-only mode; the transcript is what the model conditions on"
                )
            prompt = self._model.create_voice_clone_prompt(
                ref_audio=str(voice.reference_path),
                ref_text=voice.ref_text,
                x_vector_only_mode=False,
            )
        self._prompts[voice.ref.id] = prompt
        return prompt
