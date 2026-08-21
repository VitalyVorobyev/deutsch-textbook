"""The one contract every generative model is reached through.

Two request shapes, one asset shape, two protocols. Deliberately no streaming, no registry and
no base class with behaviour: an engine is whatever satisfies the protocol, and the gateway is
the reason a caller never has to know which one it got.

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
    params: dict[str, Any] = Field(default_factory=dict)

    def canonical_json(self) -> str:
        return _canonical_json(self.model_dump(mode="json"))

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
            },
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
