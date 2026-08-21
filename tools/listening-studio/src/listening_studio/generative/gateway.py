"""The one contract every generative model is reached through.

Two request shapes, three asset/identity shapes, and three protocols — two of which every engine
of its kind satisfies and one, `VoiceCloning`, which is **optional**. Deliberately no streaming,
no registry and no base class with behaviour: an engine is whatever satisfies the protocol, and
the gateway is the reason a caller never has to know which one it got.

Cloning is a capability, not a third kind of generator. It hangs off a speech engine
(`make_voice` → `VoiceRef`, then ordinary `generate` with `SpeechRequest.voice_ref` set) rather
than living in an interface of its own, so nothing that already synthesizes speech has to learn
about it and nothing that clones has to reimplement synthesis.

The requests are **engine-neutral**. Anything one engine understands and another does not goes
in `params`, the single opaque dict — never as a named field. A named field is a promise every
engine has to keep, and the ones that cannot keep it end up ignoring it silently, which is the
exact failure `supports_style` exists to make visible.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, Field


def _canonical_json(value: object) -> str:
    """Sorted keys, no whitespace, UTF-8 as itself — `RevisionPayload.canonical_json()`'s rule.

    Two requests that differ only in the order their `params` were written are the same request,
    so they must hash the same. `sort_keys=True` recurses, which is what makes that true of the
    nested dict as well as of the model's own fields.
    """

    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class SpeechRequest(BaseModel):
    """One utterance, as any speech engine would be asked for it."""

    text: str
    voice: str
    language: str = "German"
    style: str | None = None
    seed: int = 0
    #: The id of a **stored** voice reference (`generative.voices`), or None for a preset voice.
    #:
    #: Engine-neutral by the same rule as everything else here: it names a voice this studio holds,
    #: not a capability of any particular model. An engine that cannot clone refuses a request that
    #: carries one rather than ignoring it — silently dropping this field would synthesize a
    #: *different person's voice* and report success.
    voice_ref: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)

    def identity_payload(self) -> dict[str, Any]:
        """The dict this request is hashed and cached by.

        **`voice_ref` is omitted when it is None**, and that omission is load-bearing. A node's
        parameters embed this dict (`graph.nodes.synth_node`), so a new key with a null value would
        change the hash of every take ever synthesized — a whole corpus of cached audio orphaned by
        a field that reached nothing. It is the same argument `track_node` makes for leaving `fx`
        and `acoustics` out when a stem has no acoustic treatment, and the same one `mix_node`
        makes for `send_db`: **a value that cannot reach the audio must not reach the hash.**
        """

        payload: dict[str, Any] = self.model_dump(mode="json")
        if payload.get("voice_ref") is None:
            del payload["voice_ref"]
        return payload

    def canonical_json(self) -> str:
        return _canonical_json(self.identity_payload())

    def sha256(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()


class SoundRequest(BaseModel):
    """One non-speech sound — ambience, or a single event.

    Defined here before anything but `FakeSound` implements it, so that the interface is settled
    by the gateway rather than by whichever model lands first.
    """

    prompt: str
    negative_prompt: str | None = None
    seed: int = 0
    duration_seconds: float = 5.0
    params: dict[str, Any] = Field(default_factory=dict)

    def canonical_json(self) -> str:
        return _canonical_json(self.model_dump(mode="json"))

    def sha256(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()


@dataclass(frozen=True)
class VoiceRef:
    """A consented voice reference, bound to the exact bytes and the exact document behind it.

    This is what crosses the line into an engine, a node hash and a published manifest — never the
    consent document itself. Five fields and every one of them is a hash or a pin: the id an author
    casts, the engine and model revision the identity was created for (a clone prompt is not
    portable across checkpoints), and the two digests that make the claim checkable — the recording
    that was cloned, and the consent that permitted it.
    """

    id: str
    engine: str
    model_revision: str
    reference_sha256: str
    consent_sha256: str

    def as_json(self) -> dict[str, str]:
        return {
            "id": self.id,
            "engine": self.engine,
            "model_revision": self.model_revision,
            "reference_sha256": self.reference_sha256,
            "consent_sha256": self.consent_sha256,
        }


@dataclass(frozen=True)
class ClonableVoice:
    """A `VoiceRef` plus what the engine needs to build a clone prompt from it.

    Separate from `VoiceRef` because the two travel to different places: the identity goes into the
    manifest and the node hash, and *this* goes into a model. The path points at app-data and never
    at the repository, which is the invariant the store enforces and this type only carries.
    """

    ref: VoiceRef
    reference_path: Path
    #: What is spoken in the reference. Improves clone quality markedly and is optional because
    #: `x_vector_only` mode does not use it.
    ref_text: str | None
    #: Speaker embedding only, no reference transcript conditioning. Recorded per voice because it
    #: changes what the model is given and therefore what it sounds like.
    x_vector_only: bool


@dataclass(frozen=True)
class AudioAsset:
    """A WAV an engine wrote, and enough provenance to say where it came from.

    `sha256` is over the WAV bytes, not over the request: the published manifests state what was
    heard, and a request hash cannot prove that two runs of the same model produced it.
    """

    path: Path
    sample_rate: int
    sha256: str
    provenance: dict[str, Any]

    @classmethod
    def record(
        cls,
        path: Path,
        sample_rate: int,
        *,
        engine: str,
        model_id: str,
        model_revision: str,
        adapter_code_revision: str,
        license: str,
        seed: int,
        request_sha256: str,
        params: dict[str, Any],
        voice: VoiceRef | None = None,
    ) -> AudioAsset:
        """Build the asset with the provenance every engine owes, in one place.

        Not a base class and not behaviour an engine can override — the shape of `provenance`
        is a published contract, and three engines each assembling their own dict is three
        chances for a field to go missing where no gate would see it.

        `license` is the model's licence, and it is a field rather than a lookup because the
        published render manifest has to be able to state it. An imported Freesound original
        carries its licence in the reviewed `source.json`; a generated one has no such record,
        and a licence that lives only in `models.lock.json` is a licence the asset sidecar
        cannot answer for once it is one row in a sound library beside the imports.

        `voice` is written into the provenance only when a stored voice reference produced these
        bytes, and it is the same argument one step further: the sidecar has to be able to answer
        *whose voice this is and what permitted it* without anyone holding the render manifest that
        shipped it. Omitted rather than written as `null` for a preset voice — the shape of every
        sidecar already written stays what it was.
        """

        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        return cls(
            path=path,
            sample_rate=sample_rate,
            sha256=digest.hexdigest(),
            provenance={
                "engine": engine,
                "model_id": model_id,
                "model_revision": model_revision,
                "adapter_code_revision": adapter_code_revision,
                "license": license,
                "seed": seed,
                "request_sha256": request_sha256,
                "params": params,
            }
            | ({"voice": voice.as_json()} if voice is not None else {}),
        )


class SpeechGenerator(Protocol):
    name: str
    revision: str
    # False means style is *inert on this engine*, not that it is unwelcome input. The synthesis
    # path warns rather than refuses, because a style that reaches nothing must not silently
    # look like a delivery decision that was honoured.
    supports_style: bool

    def generate(self, request: SpeechRequest, target: Path) -> AudioAsset: ...


class SoundGenerator(Protocol):
    name: str
    revision: str

    def generate(self, request: SoundRequest, target: Path) -> AudioAsset: ...


class VoiceCloning(Protocol):
    """**Optional.** A speech engine that can make a voice from a consented reference recording.

    Deliberately not a third mandatory interface and not a base class. Cloning is a capability some
    checkpoints have; an engine either satisfies this protocol or it does not, and
    `supports_cloning` is what a caller reads before offering the feature — the same shape and the
    same reason as `supports_style`.

    **`make_voice` is not given the consent document.** It receives an id, a recording and the two
    digests that bind them, because whether a consent *authorises* anything was decided by
    `generative.voices` long before a model was reached. An engine that could rule on consent is an
    engine that could be swapped for one that ruled differently, and the rule would then be a
    property of the installed weights.

    An engine with this capability synthesizes **only** through a stored voice — `SpeechRequest`
    without a `voice_ref` is refused — and an engine without it refuses a request that carries one.
    Both directions are stated, because the failure they prevent is the same one: a take produced
    in a voice nobody asked for, reported as a success.
    """

    name: str
    revision: str
    supports_cloning: bool

    def make_voice(
        self,
        *,
        voice_id: str,
        reference: Path,
        reference_sha256: str,
        ref_text: str | None,
        consent_sha256: str,
        x_vector_only: bool,
    ) -> VoiceRef: ...


class CloningSpeechGenerator(SpeechGenerator, VoiceCloning, Protocol):
    """A speech engine that also clones — the two protocols at once, as a name a caller can use.

    Exists so the voices API and CLI are type-checked rather than typed `Any`: they call
    `make_voice` *and* `generate` on the same object, and without a name for that combination the
    only way to hold both was to give up on checking either.
    """


def supports_cloning(engine: object) -> bool:
    """Whether this engine offers the optional capability. One reading, so no caller guesses."""

    return bool(getattr(engine, "supports_cloning", False))
