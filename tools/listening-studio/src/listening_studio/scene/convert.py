"""Converters from the shipped corpus into Scene v1.

Both directions are **total**: every one of the 40 published listening artifacts and every one
of the 85 Lesetexte must convert, or the model is wrong rather than the artifact. That is the
point of running them over the real corpus in `tests/test_scene_convert.py` instead of over
fixtures — a hand-written fixture proves the mechanism, and only the corpus gives the shapes
that were actually authored.

Nothing here writes to `content/` or `data/`. A conversion is a reading of published bytes.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Sequence, cast

import yaml
from pydantic import BaseModel, Field

from ..catalogs import CharacterDefinition, NarrationProfile
from ..domain import Bilingual, Question, SingleChoice
from ..reading_audio import ReadingSource
from .exercise import ExerciseAttachment
from .model import (
    AmbienceEntry,
    AssetRef,
    CastMember,
    CharacterRef,
    Level,
    PronunciationOverride,
    Scene,
    SceneAcoustics,
    SceneBrief,
    SpeechEntry,
    TimelineEntry,
    Utterance,
    VoiceSpec,
    SfxEntry,
)


#: Published provenance manifests predate the `role` field on a context sound entirely — the
#: legacy mixer had one behaviour and no name for it — so bed and event have to be read off the
#: numbers. The corpus is cleanly bimodal about it: every one-shot (a dial tone, a door, a
#: bottle in a bottle bank, a landline ring) is 1.6–2.5 s, and every room tone is 12–110 s.
#: Anything under this threshold is an event; the gap either side of it is a factor of five.
EVENT_MAX_DURATION_MS = 5_000

#: The narration engine. `ReadingRevisionPayload` stores no adapter name — it was written when
#: there was exactly one — so the value is stated here rather than guessed per reading.
NARRATION_ENGINE = "qwen_tts"

#: The single role a narration scene casts. Not the character's display name: an utterance names
#: a *part*, and the part a Lesetext has is the narrator, whoever is reading it this month.
NARRATOR_ROLE = "narrator"


@lru_cache(maxsize=None)
def _parsed(path: str, mtime_ns: int) -> dict[str, Any]:
    """Cache-keyed on the file's own mtime, so an edit invalidates the entry rather than hiding.

    Converting the whole dialogue corpus reads every exercise set of a level once per artifact:
    40 artifacts against 200 A2 sets is 100 MB of YAML and half a minute, for 40 conversions.
    The returned document is shared and nothing here mutates it.
    """

    return cast(dict[str, Any], yaml.safe_load(Path(path).read_text()))


def load_yaml(path: Path) -> dict[str, Any]:
    return _parsed(str(path), path.stat().st_mtime_ns)


class DialoguePlanEntry(BaseModel):
    """One commissioned dialogue, as `data/listening-plan.yaml` states it.

    The published artifact records what was made; the plan records what was asked for. Only the
    plan has the vocabulary, the grammar target and the duration *window* — the artifact carries
    a single measured duration, which is the answer, not the question.
    """

    id: str
    level: Level
    scenario: str
    outcomes: list[str] = Field(default_factory=list)
    required_vocabulary: list[str] = Field(default_factory=list)
    grammar_target: str = ""
    duration_seconds: tuple[int, int]


def load_dialogue_plan(repo: Path) -> dict[str, DialoguePlanEntry]:
    plan = load_yaml(repo / "data" / "listening-plan.yaml")
    entries: dict[str, DialoguePlanEntry] = {}
    for unit in plan["units"]:
        for artifact in unit["artifacts"]:
            window = artifact["duration_seconds"]
            entries[artifact["id"]] = DialoguePlanEntry(
                id=artifact["id"],
                level=unit["level"],
                scenario=artifact["scenario"],
                outcomes=list(artifact.get("outcomes", [])),
                required_vocabulary=list(artifact.get("required_vocabulary", [])),
                grammar_target=str(artifact.get("grammar_target", "")),
                duration_seconds=(int(window["min"]), int(window["max"])),
            )
    return entries


def _bilingual(raw: dict[str, Any]) -> Bilingual:
    return Bilingual(en=raw["en"], ru=raw["ru"], uk=raw.get("uk"))


def _audio_items(
    exercise_sets: Sequence[Path], recording: str
) -> list[tuple[Path, dict[str, Any]]]:
    """Every `audio-comprehension` item naming this recording, in file then item order."""

    found: list[tuple[Path, dict[str, Any]]] = []
    for path in exercise_sets:
        raw = load_yaml(path)
        for item in raw.get("items") or []:
            if item.get("type") == "audio-comprehension" and item.get("recording") == recording:
                found.append((path, item))
    return found


def _question(item: dict[str, Any]) -> Question:
    """One published `audio-comprehension` item as the studio's question shape.

    `audio-comprehension` is single-choice and nothing else, which is why the legacy response
    union is not reachable from here: those five shapes are readable history, never new input.
    """

    return Question(
        id=item["id"],
        instruction=_bilingual(item["instruction"]),
        response=SingleChoice(
            kind="single-choice",
            prompt=item["question"],
            options=list(item["options"]),
            correct=int(item["correct"]),
        ),
        explain=_bilingual(item["explain"]),
        focus=item.get("focus"),
    )


def _context_entry(sound: dict[str, Any]) -> TimelineEntry:
    """One published context sound as either an event or a bed, without losing a number.

    Four values are recorded and all four survive: `start_ms` is an offset *into the source
    file* and becomes `source_start_ms`; `delay_ms` is a position in the *scene* and becomes
    `at_ms`/`start_ms`; `duration_ms` is how much is used; `gain_db` is unchanged. Conflating
    the first two is the mistake this comment exists to prevent — one is 10 000 into a room
    tone, the other is 0 in the mix, and they appear in the same object.
    """

    digest = str(sound["source_sha256"])
    start = int(sound["start_ms"])
    delay = int(sound["delay_ms"])
    duration = int(sound["duration_ms"])
    gain = float(sound["gain_db"])
    if duration <= EVENT_MAX_DURATION_MS:
        return SfxEntry(
            sound=AssetRef(ref=digest, source_start_ms=start, source_duration_ms=duration),
            at_ms=delay,
            gain_db=gain,
        )
    # A bed states its window on the timeline instead of on the asset: the legacy mixer looped
    # the source and trimmed it to the length of the whole mix, so the manifest's `duration_ms`
    # is an editorial intent about the *scene*, not about how much of the file is used.
    return AmbienceEntry(
        sound=AssetRef(ref=digest, source_start_ms=start),
        start_ms=delay,
        end_ms=delay + duration,
        gain_db=gain,
    )


def scene_from_dialogue(
    artifact_yaml: Path,
    provenance_json: Path,
    exercise_sets: Sequence[Path],
    *,
    plan: DialoguePlanEntry | None = None,
) -> tuple[Scene, ExerciseAttachment]:
    """A published listening artifact and its provenance manifest, as one scene.

    The script comes from the **manifest**, not from the published transcript: the manifest's
    `settings.lines` is the resolved adapter input — voice, seed, style, pace, pause — and the
    transcript is a rendering of it. (They are identical for all 40; the manifest is still the
    source, because only it carries the synthesis fields.)
    """

    artifact = load_yaml(artifact_yaml)
    # A JSON document is a YAML document; one loader keeps one cache.
    provenance = load_yaml(provenance_json)
    settings = provenance["settings"]
    lines = cast(list[dict[str, Any]], settings["lines"])
    engine = str(settings["adapter"])

    # One cast member per declared speaker, in the order the artifact declares them. Voice and
    # style are constant per speaker across all 40; the seed is not (see `Utterance.seed_override`),
    # so the member takes the speaker's first seed and every line that differs says so.
    cast_members: list[CastMember] = []
    for speaker in artifact["speakers"]:
        spoken = [line for line in lines if line["speaker"] == speaker]
        if not spoken:
            raise ValueError(f"{artifact['id']} declares {speaker}, who says nothing")
        first = spoken[0]
        cast_members.append(
            CastMember(
                role=speaker,
                # The published dialogues predate the character roster, and their manifests
                # record no cast mapping. None is the truth here.
                character=None,
                voice=VoiceSpec(
                    engine=engine,
                    voice=first["voice"],
                    seed=int(first["seed"]),
                    style=first["style"],
                ),
            )
        )
    seed_by_role = {member.role: member.voice.seed for member in cast_members}

    script: list[Utterance] = []
    for line in lines:
        seed = int(line["seed"])
        script.append(
            Utterance(
                id=line["id"],
                role=line["speaker"],
                display_text=line["display_text"],
                synthesis_text=line.get("synthesis_text"),
                pronunciation_overrides=[
                    PronunciationOverride(display=row["display"], synthesis=row["synthesis"])
                    for row in line.get("pronunciation_overrides") or []
                ],
                pace=float(line["pace"]),
                pause_after_ms=int(line["pause_after_ms"]),
                seed_override=None if seed == seed_by_role[line["speaker"]] else seed,
            )
        )

    timeline: list[TimelineEntry] = [
        SpeechEntry(utterance_id=utterance.id) for utterance in script
    ]
    timeline.extend(_context_entry(sound) for sound in settings.get("context_sounds") or [])

    items = _audio_items(exercise_sets, artifact["id"])
    if not items:
        raise ValueError(f"no audio-comprehension item references {artifact['id']}")
    topics = {str(load_yaml(path)["topic"]) for path, _ in items}
    outcomes: list[str] = []
    for _, item in items:
        for outcome in item.get("outcomes") or []:
            if outcome not in outcomes:
                outcomes.append(outcome)

    level = cast(Level, artifact["level"])
    brief = SceneBrief(
        level=level,
        scenario=artifact["scenario"],
        # One topic in every case; sorted so two sets in a different order cannot change the hash.
        topic=sorted(topics)[0],
        # The plan is the reviewed statement of what the artifact had to achieve. Without it the
        # outcomes the items actually measure are the honest answer, and the two fields only the
        # plan holds stay empty rather than being reconstructed from the finished script.
        outcomes=plan.outcomes if plan else outcomes,
        vocabulary=plan.required_vocabulary if plan else [],
        grammar_target=(plan.grammar_target or None) if plan else None,
        duration_seconds=plan.duration_seconds if plan else None,
    )

    scene = Scene(
        slug=artifact["id"],
        kind="dialogue",
        title=_bilingual(artifact["title"]),
        brief=brief,
        cast=cast_members,
        script=script,
        timeline=timeline,
        acoustics=SceneAcoustics(lead_in_ms=int(settings["assembly"]["lead_in_ms"])),
        # Every manifest names and hashes a generation brief, so a model drafted the script and
        # `generated` is earned. `generation_prompt` stays None on purpose: the brief document is
        # not the prompt string, and rebuilding one from the published payload is exactly the
        # "provenance that states a generation history which did not happen" failure recorded on
        # `RevisionPayload.authoring`.
        authoring="generated",
        generation_prompt=None,
    )
    attachment = ExerciseAttachment(
        questions=[_question(item) for _, item in items],
        max_replays=max(int(item.get("max_replays", 3)) for _, item in items),
    )
    return scene, attachment


def reading_slug(reading_id: str) -> str:
    """`a1/erste-schritte` → `a1-erste-schritte`.

    A reading id is level-scoped and carries a slash; a scene slug is one flat kebab token, and
    the store's slug column is unique across kinds. Flattening keeps the level in the name, so
    `a1-akkusativ-2` and `a2-akkusativ-2` stay two scenes rather than one collision.
    """

    return reading_id.replace("/", "-")


def scene_from_reading(
    source: ReadingSource,
    profile: NarrationProfile,
    character: CharacterDefinition,
) -> Scene:
    """One Lesetext as a single-voice narration scene.

    The paragraph texts arrive already gloss-stripped: `load_reading_sources` applies
    `spoken_paragraph` when it reads `content/reading/`, so `[[Wort::word::слово]]` is `Wort`
    before it gets here. That makes display and synthesis text the same string, and
    `synthesis_text` stays None rather than repeating it — the field exists for a genuine
    difference, and filling it with a copy would make every reading look like it had one.
    """

    style = f"{character.voice_profile.style} {profile.instruction}"
    member = CastMember(
        role=NARRATOR_ROLE,
        character=CharacterRef(id=character.id, version=character.version),
        voice=VoiceSpec(
            engine=NARRATION_ENGINE,
            voice=character.voice_profile.voice,
            seed=character.voice_profile.seed,
            style=style,
        ),
    )
    pace = profile.pace_by_level[source.level]
    script = [
        Utterance(
            id=f"p{index + 1}",
            role=NARRATOR_ROLE,
            display_text=text,
            pace=pace,
            pause_after_ms=profile.paragraph_pause_ms,
        )
        for index, text in enumerate(source.paragraphs)
    ]
    return Scene(
        slug=reading_slug(source.id),
        kind="narration",
        # A Lesetext publishes exactly one title and it is German. Both halves carry it rather
        # than an invented English and Russian rendering: repeating the authored German is
        # visibly a placeholder, while a manufactured translation reads as an editorial fact.
        title=Bilingual(en=source.title_de, ru=source.title_de),
        brief=SceneBrief(
            level=source.level,
            scenario=f"Narration des Lesetexts „{source.title_de}“",
            topic=source.topic,
            # A reading's outcomes live on its comprehension questions, which are part of the
            # reading artifact and not of the narration. Empty is the truth, not a gap.
            outcomes=[],
        ),
        cast=[member],
        script=script,
        timeline=[SpeechEntry(utterance_id=utterance.id) for utterance in script],
        acoustics=SceneAcoustics(),
        # Matches `ReadingRevisionPayload.authoring`, whose default is the same value for the
        # same corpus. Changing the answer on the way through a converter would make the two
        # models disagree about the identical text.
        authoring="generated",
    )


# ---------------------------------------------------------------------------
# Repository-level resolution
# ---------------------------------------------------------------------------


def published_dialogue_ids(repo: Path) -> list[str]:
    """`a1/ls-erste-schritte-01` for every published listening artifact, level dir included."""

    root = repo / "content" / "listening"
    return [str(path.relative_to(root).with_suffix("")) for path in sorted(root.glob("*/*.yaml"))]


def exercise_sets_for(repo: Path, level: str) -> list[Path]:
    return sorted((repo / "content" / "exercises" / level).glob("*.yaml"))


def dialogue_scene(repo: Path, artifact_id: str) -> tuple[Scene, ExerciseAttachment]:
    """Resolve `<level>/<id>` against the repository and convert it.

    The provenance path is taken from the artifact's own `provenance:` field rather than
    rebuilt from the id: the artifact is what says where its manifest is, and a rebuilt path
    that happens to be right is a rule nobody wrote down.
    """

    level, _, slug = artifact_id.partition("/")
    artifact_yaml = repo / "content" / "listening" / level / f"{slug}.yaml"
    if not artifact_yaml.exists():
        raise FileNotFoundError(f"no published listening artifact {artifact_id}")
    artifact = load_yaml(artifact_yaml)
    return scene_from_dialogue(
        artifact_yaml,
        repo / str(artifact["provenance"]),
        exercise_sets_for(repo, level),
        plan=load_dialogue_plan(repo).get(slug),
    )


def reading_scene(
    source: ReadingSource,
    profiles: Iterable[NarrationProfile],
    characters: Iterable[CharacterDefinition],
    profile_id: str,
) -> Scene:
    """Resolve a narration profile and its character by id, then convert."""

    profile = next((row for row in profiles if row.id == profile_id), None)
    if profile is None:
        raise KeyError(f"unknown narration profile {profile_id}")
    if source.kind not in profile.allowed_kinds:
        raise ValueError(f"profile {profile.id} is not allowed for a {source.kind} reading")
    character = next((row for row in characters if row.id == profile.character_id), None)
    if character is None:
        raise KeyError(f"narration profile {profile.id} names an unknown character")
    return scene_from_reading(source, profile, character)
