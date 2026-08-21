"""The Scene v1 shapes.

Three rules hold the whole file together, and each one has a failure behind it:

* **`extra="forbid"` everywhere.** A scene is a published contract read by a renderer, an editor
  and a JSON Schema in another language. A field silently dropped on load is a rendering
  decision that disappears without a diagnostic.
* **Identity is in the cast, delivery is in the utterance, DSP is nowhere near the engine.**
  `VoiceSpec` carries no `pace` because pace is `atempo` in ffmpeg (`adapters.conform`), not a
  generation parameter — asking a speech model for it regenerates a take for every variant it
  appears in.
* **Nothing here names an engine for sound.** A `SoundSpec` says what should be heard; which
  generator produces it is the renderer's business, so a scene does not go stale when the
  model behind it is replaced.
"""

from __future__ import annotations

import hashlib
import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..domain import Bilingual


#: One kebab-case ASCII identifier. Same shape the corpus already uses for topic and artifact
#: ids, so a converted scene keeps the id it was published under.
KEBAB = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"

SceneKind = Literal["dialogue", "narration", "custom"]
Level = Literal["A1", "A2", "B1", "B2"]

#: The synthesis identity fields, and the DSP that follows them, both moved once already when
#: profiles replaced per-line settings. The bounds below are the ones the shipped corpus and the
#: two legacy payloads agree on, widened only where the spec for v1 widened them.
PACE_MIN, PACE_MAX = 0.7, 1.3


class Strict(BaseModel):
    """Every model in this file refuses unknown keys. Stated once rather than eleven times."""

    model_config = ConfigDict(extra="forbid")


class PronunciationOverride(Strict):
    """A display spelling and what the engine should be given instead.

    Ported rather than imported from `domain`: the domain model permits extra keys, and the
    published JSON Schema for a scene must say that it does not.
    """

    display: str = Field(min_length=1)
    synthesis: str = Field(min_length=1)


class CharacterRef(Strict):
    """A row of `data/listening-characters.yaml`, pinned to the version that was cast.

    Version, not just id: the catalog advances, and a scene that stored only the id would
    quietly change voice when it did.
    """

    id: str = Field(pattern=KEBAB)
    version: int = Field(ge=1)


class VoiceSpec(Strict):
    """How this role is synthesized. Engine-neutral by name, engine-specific by value."""

    engine: str = Field(min_length=1)
    voice: str = Field(min_length=1)
    seed: int = Field(ge=0)
    style: str | None = None


class CastMember(Strict):
    """One voice in the scene, and the name the script calls it by."""

    #: The name utterances use — "Mara", "Mitarbeiterin", "narrator". Free text, because it is
    #: the author's word for the part and appears in the published transcript.
    role: str = Field(min_length=1)
    #: None is legal and means *no catalog character was recorded*, which is the truth for every
    #: dialogue published before the roster existed. Inventing a plausible character id for
    #: those would be provenance nobody wrote down.
    character: CharacterRef | None = None
    voice: VoiceSpec


class Utterance(Strict):
    """One turn of speech, with the delivery that is applied after the engine returns."""

    id: str = Field(min_length=1)
    role: str = Field(min_length=1)
    display_text: str = Field(min_length=1)
    #: What the engine is given, when it must differ from what the learner reads.
    synthesis_text: str | None = None
    pronunciation_overrides: list[PronunciationOverride] = Field(default_factory=list)
    #: DSP, not generation: `atempo` after the take exists.
    pace: float = Field(default=1.0, ge=PACE_MIN, le=PACE_MAX)
    pause_after_ms: int = Field(default=600, ge=0, le=5000)
    #: Legacy fidelity only, and empty in anything authored from now on. 25 of the 40 published
    #: dialogues predate voice profiles and carry a *different seed on every line of the same
    #: speaker* — the line-index randomness that `domain.lock_voice_profiles` exists to remove.
    #: Converting those with one seed per cast member would silently change the identity of 25
    #: shipped artifacts, so the per-turn value is kept where it can be seen and retired.
    seed_override: int | None = Field(default=None, ge=0)

    def spoken_text(self) -> str:
        text = self.synthesis_text or self.display_text
        for override in self.pronunciation_overrides:
            text = text.replace(override.display, override.synthesis)
        return text


class Placement(Strict):
    """Where a sound sits in the stereo field and how far away it is.

    `device` names a row of `data/acoustic-profiles.yaml` — "telephone", "pa", "next-room" — and
    is resolved against it **at render time**, not here. `distance` is resolved the same way: 1.0
    is at the reference position and larger is further off, turned into a gain drop, a gentle
    lowpass and a larger send into the room by `listening_studio.dsp.chains`. An unknown device id
    is refused by the renderer with the path of the file that would have to define it.

    Deliberately not validated on load. A scene is a published document that other tools read, and
    holding it to a catalog it does not ship with would make a valid scene invalid on any machine
    whose checkout of that catalog is older. `scene validate --repo` offers the check as a
    *warning* for exactly that reason.
    """

    pan: float = Field(default=0.0, ge=-1.0, le=1.0)
    distance: float = Field(default=1.0, ge=0.0)
    device: str | None = None


class AssetRef(Strict):
    """A content-addressed sound already in the library, and the excerpt of it that is used.

    The trim lives on the reference rather than on the timeline entry because it describes the
    *asset*, not the scene: `start_ms`/`end_ms` on an ambience entry say when the bed is
    audible, while `source_start_ms` says which ten seconds of a ninety-second room tone the
    editor chose. Both numbers exist in every published manifest and they are not the same
    number.
    """

    ref: str = Field(pattern=r"^[0-9a-f]{64}$")
    source_start_ms: int = Field(default=0, ge=0)
    #: None means "to the end of the asset" — and, for a bed, "loop it as long as it is needed".
    source_duration_ms: int | None = Field(default=None, gt=0)


class SoundSpec(Strict):
    """A sound that does not exist yet, described so a generator can be asked for it.

    Resolved to an `AssetRef` at render time. Deliberately no engine name: see the module
    docstring. `params` is the one opaque dict, the `generative.gateway` rule.
    """

    prompt: str = Field(min_length=1)
    negative_prompt: str | None = None
    seed: int = Field(default=0, ge=0)
    duration_seconds: float | None = Field(default=None, gt=0)
    params: dict[str, float | int | str | bool] = Field(default_factory=dict)


Sound = AssetRef | SoundSpec


class SpeechEntry(Strict):
    """One utterance, placed."""

    type: Literal["speech"] = "speech"
    utterance_id: str = Field(min_length=1)
    #: None means sequential: this turn begins when the previous speech entry has finished and
    #: its `pause_after_ms` has elapsed. Every converted scene is sequential; explicit times are
    #: for overlap, interruption and simultaneous speech, which no shipped artifact has.
    at_ms: int | None = Field(default=None, ge=0)
    placement: Placement | None = None


class SfxEntry(Strict):
    """One non-speech event at one moment.

    `at_ms` is absolute scene time, measured from the start of the mix — *not* from the first
    word. `SceneAcoustics.lead_in_ms` delays the speech, so a ring placed at 0 is heard before
    anyone talks, which is the whole reason lead-in exists.
    """

    type: Literal["sfx"] = "sfx"
    sound: Sound
    at_ms: int = Field(ge=0)
    gain_db: float = Field(default=-18.0, ge=-40.0, le=0.0)
    placement: Placement | None = None


class AmbienceEntry(Strict):
    """A continuous bed under some or all of the scene.

    The fade defaults are the numbers today's mixer hard-codes (`adapters.mix_context`:
    `afade=t=in:d=0.35` and `afade=t=out:d=0.45`), so a converted scene renders as it always
    did rather than as someone's idea of a good fade.

    The gain ceiling is -6 dB rather than 0: a bed at speech level is not a bed. Events may go
    to 0 because a door slam is allowed to be the loudest thing in the room.
    """

    type: Literal["ambience"] = "ambience"
    sound: Sound
    start_ms: int = Field(default=0, ge=0)
    #: None means "until the scene ends", which is what a bed usually wants and what the legacy
    #: mixer did unconditionally.
    end_ms: int | None = Field(default=None, ge=0)
    gain_db: float = Field(default=-24.0, ge=-40.0, le=-6.0)
    fade_in_ms: int = Field(default=350, ge=0, le=10_000)
    fade_out_ms: int = Field(default=450, ge=0, le=10_000)

    @model_validator(mode="after")
    def ordered(self) -> AmbienceEntry:
        if self.end_ms is not None and self.end_ms <= self.start_ms:
            raise ValueError("an ambience bed must end after it starts")
        return self


TimelineEntry = Annotated[
    SpeechEntry | SfxEntry | AmbienceEntry, Field(discriminator="type")
]


class SceneAcoustics(Strict):
    """Scene-wide acoustic treatment.

    `room` names a room profile in `data/acoustic-profiles.yaml` — "cafe", "station-hall" — and is
    resolved against it at render time, where it becomes one synthetic impulse response convolved
    on a send from the dialogue and sfx buses. The ambience bus is never sent: a recorded room
    tone already is a room. Unvalidated on load for the reason given on `Placement.device`.
    """

    room: str | None = None
    #: Silence prepended to the speech so a scene-opening sound can be heard before anyone
    #: talks. Capped at 5 s: this buys a ring or a beep, not a musical introduction.
    lead_in_ms: int = Field(default=0, ge=0, le=5000)


class DifficultyVariant(Strict):
    """One rendering of the same script at a different listening difficulty.

    `preset` names a row of `data/acoustic-difficulty.yaml` — "clean", "natural", "challenging" —
    and `overrides` replaces individual deltas of that preset by the same key names. Both are
    resolved at render time; the override vocabulary is `dsp.profiles.DELTA_KEYS`, and a key
    outside it is refused with the vocabulary named rather than silently doing nothing.

    `overrides` stays `dict[str, float | str]` rather than a typed model. The vocabulary is data
    that ships in the repository, so freezing it into the published JSON Schema would mean a new
    difficulty parameter is a schema version — and scene documents written before it existed are
    still valid documents.
    """

    id: str = Field(pattern=KEBAB)
    preset: str | None = None
    overrides: dict[str, float | str] = Field(default_factory=dict)


class SceneBrief(Strict):
    """What the scene is *for* — the generalization of `domain.Brief` that fits narration too.

    Two deliberate differences from `Brief`. There is no `speaker_count`: it is `len(cast)`, and
    keeping both is how `RevisionPayload.consistent` came to need a rule holding them equal.
    And `duration_seconds` is a range rather than a point, because the plan that commissions a
    scene states a min and a max, and the single number the old brief stored was their midpoint
    — a target nobody set, checked against a window nobody kept.
    """

    level: Level = "A2"
    scenario: str = Field(min_length=1)
    topic: str | None = None
    outcomes: list[str] = Field(default_factory=list)
    vocabulary: list[str] = Field(default_factory=list)
    grammar_target: str | None = None
    duration_seconds: tuple[int, int] | None = None

    @model_validator(mode="after")
    def sane_window(self) -> SceneBrief:
        if self.duration_seconds is not None:
            low, high = self.duration_seconds
            if low <= 0 or high < low:
                raise ValueError("duration_seconds must be a non-empty positive range")
        return self


def _natural_variant() -> list[DifficultyVariant]:
    """The variant every scene has: the scene as authored, with nothing done to it."""

    return [DifficultyVariant(id="natural")]


class Scene(Strict):
    """A cast, a script, and one time axis that both speech and sound are placed on."""

    schema_version: Literal[1] = 1
    slug: str = Field(pattern=KEBAB)
    kind: SceneKind
    title: Bilingual
    brief: SceneBrief | None = None
    cast: list[CastMember] = Field(min_length=1)
    script: list[Utterance] = Field(min_length=1)
    timeline: list[TimelineEntry] = Field(min_length=1)
    acoustics: SceneAcoustics = Field(default_factory=SceneAcoustics)
    variants: list[DifficultyVariant] = Field(default_factory=_natural_variant)
    authoring: Literal["manual", "generated"] = "manual"
    #: The exact prompt submitted, when a model drafted this and the prompt was recorded. Never
    #: reconstructed from the finished script: after the editorial revision every draft receives,
    #: a rebuilt prompt is a generation history that did not happen.
    generation_prompt: str | None = None

    @model_validator(mode="after")
    def consistent(self) -> Scene:
        roles = [member.role for member in self.cast]
        if len(set(roles)) != len(roles):
            raise ValueError("cast roles must be unique")
        known_roles = set(roles)
        for utterance in self.script:
            if utterance.role not in known_roles:
                raise ValueError(f"utterance {utterance.id} names an uncast role {utterance.role}")
        ids = [utterance.id for utterance in self.script]
        if len(set(ids)) != len(ids):
            raise ValueError("utterance ids must be unique")

        # Each utterance is placed exactly once. Twice is not a repeat of the line — it is one
        # take mixed over itself, which no author means and no renderer could disambiguate.
        placed = [entry.utterance_id for entry in self.timeline if isinstance(entry, SpeechEntry)]
        if sorted(placed) != sorted(ids):
            missing = sorted(set(ids) - set(placed))
            unknown = sorted(set(placed) - set(ids))
            duplicated = sorted({value for value in placed if placed.count(value) > 1})
            raise ValueError(
                "every utterance must appear exactly once in the timeline "
                f"(unplaced: {missing}, unknown: {unknown}, repeated: {duplicated})"
            )

        # Only the explicit times are ordered. A None is "after the previous one", which cannot
        # go backwards, so mixing the two is legal and only the pinned values are compared.
        explicit = [
            entry.at_ms
            for entry in self.timeline
            if isinstance(entry, SpeechEntry) and entry.at_ms is not None
        ]
        if any(later < earlier for earlier, later in zip(explicit, explicit[1:], strict=False)):
            raise ValueError("explicit speech times must not move backwards")

        variant_ids = [variant.id for variant in self.variants]
        if len(set(variant_ids)) != len(variant_ids):
            raise ValueError("variant ids must be unique")
        return self

    def utterance(self, utterance_id: str) -> Utterance:
        return next(row for row in self.script if row.id == utterance_id)

    def member(self, role: str) -> CastMember:
        return next(row for row in self.cast if row.role == role)

    def seed_for(self, utterance: Utterance) -> int:
        """The seed this turn is actually synthesized with, legacy override included."""

        if utterance.seed_override is not None:
            return utterance.seed_override
        return self.member(utterance.role).voice.seed

    def canonical_json(self) -> str:
        """Sorted keys, no whitespace, UTF-8 as itself.

        `RevisionPayload.canonical_json()`'s rule, and for the same reason: two documents that
        differ only in key order are the same scene and must hash the same.
        """

        return json.dumps(
            self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )

    def sha256(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()
