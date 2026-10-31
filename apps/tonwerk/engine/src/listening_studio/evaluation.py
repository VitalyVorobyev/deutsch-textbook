"""Voice evaluation: candidate speech checkpoints compared on the roster, outside production.

`atlas-listening evaluate voices` speaks every roster character's lines through each candidate,
measures the takes, and leaves a blind listening page for the owner. The candidates:

- **`preset-0.6b`**, the preset engine existing scenes speak on: a preset speaker on the 0.6B
  CustomVoice checkpoint, which discards every style instruction.
- **`preset-1.7b`**, the same preset speaker and seed on the 1.7B CustomVoice checkpoint, which
  honours the character's style instruction.
- **`design-clone-0.6b`** and **`design-clone-1.7b`**: the VoiceDesign checkpoint reads one
  reference sentence in a voice described in `evaluation/voice-designs.yaml`, and the Base checkpoint of
  that size clones the reference for every line. The reference is a synthetic voice with a stable
  identity that belongs to no preset speaker. `design-clone-1.7b` is the production engine
  `qwen_tts_designed`'s checkpoint, and `voices adopt-designed` carries a run's accepted
  references into production (`adoption.py`).

**Nothing here is a production path** (`docs/authoring/product-protection.md`, the evaluation
paragraph). A run writes only into its own new directory under the studio's `evaluations/`, refuses
a directory that already exists, writes no store row and no render-cache entry, and is never read
by `scene publish`. A checkpoint only this runner loads is pinned in `models.lock.json` with
`"scope": "evaluation"` and is not an engine of `generative.registry`, so no scene can be cast on
it. Every prompt, seed, model revision and file hash is kept in the run's `run.json`.

**What it measures**, per take: Whisper's transcript scored by the scene QA's own line rule
(`qa.check_units`), speaking rate in words per second of voiced audio, and generation time. Per
candidate: the speaker-identity report of `speaker_qa` over all characters' takes at once, which
gives each character's worst line-to-character similarity and the similarity between different
characters. Every identity score is uncalibrated, so it ranks and never decides; the blind listen
decides.
"""

from __future__ import annotations

import gc
import html
import json
import random
import shutil
import statistics
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Literal, Mapping, Protocol, Sequence

import numpy as np
import yaml
from pydantic import BaseModel, Field, field_validator

from .catalogs import PRESET_ENGINE, CharacterCatalog
from .domain import normalized_words
from .dsp.audio import conform
from .generative.locks import locked_snapshot
from .graph.assets import sha256_file
from .qa import check_units
from .speaker_qa import EmbeddingBackend, check_unit_consistency, trimmed_audio

#: Phrases that turn a voice description into an imitation of somebody. Matched case-folded
#: anywhere in a description; one hit refuses the whole design file.
IMITATION_MARKERS = (
    "imitat",
    "impersonat",
    "sound like",
    "sounds like",
    "in the voice of",
    "in the style of",
    "voice of a famous",
    "celebrity",
    "klingt wie",
    "stimme von",
    "nachahm",
)

#: The VoiceDesign checkpoint. Its only use is making a reference for the clone candidates.
DESIGN_LOCK_KEY = "qwen_tts_voice_design"

#: How many seeds a designed reference may take before the character is recorded as failed. A
#: reference Whisper cannot transcribe is a reference whose transcript the clone would be
#: conditioned on falsely.
DESIGN_ATTEMPTS = 3

#: 33 seconds at the 12 Hz codec: the reference sentence takes about twelve.
DESIGN_MAX_NEW_TOKENS = 400

#: 20 seconds: the bound `qwen_clone` puts on production clone takes, for the same runaway.
CLONE_MAX_NEW_TOKENS = 240

DESIGNS_FILE = Path(__file__).resolve().parents[2] / "evaluation" / "voice-designs.yaml"


@dataclass(frozen=True)
class Candidate:
    id: str
    lock_key: str
    kind: Literal["preset", "design-clone"]
    #: Whether the character's style instruction is passed. Only a checkpoint that uses it gets it,
    #: so a candidate is never credited with an instruction its model threw away.
    style: bool = False


CANDIDATES: dict[str, Candidate] = {
    candidate.id: candidate
    for candidate in (
        Candidate("preset-0.6b", "qwen_tts", "preset"),
        Candidate("preset-1.7b", "qwen_tts_1_7b", "preset", style=True),
        Candidate("design-clone-0.6b", "qwen_tts_base", "design-clone"),
        Candidate("design-clone-1.7b", "qwen_tts_designed", "design-clone"),
    )
}


class VoiceDesigns(BaseModel):
    version: int = Field(ge=1)
    reference_text: str = Field(min_length=20)
    shared_lines: list[str] = Field(default_factory=list)
    designs: dict[str, str] = Field(min_length=1)

    @field_validator("designs")
    @classmethod
    def no_imitation(cls, designs: dict[str, str]) -> dict[str, str]:
        for character, description in designs.items():
            folded = description.casefold()
            hits = [marker for marker in IMITATION_MARKERS if marker in folded]
            if hits:
                raise ValueError(
                    f"the design for {character} asks for an imitation ({', '.join(hits)}); "
                    "describe a fictional voice instead"
                )
        return designs


def load_designs(path: Path = DESIGNS_FILE) -> VoiceDesigns:
    return VoiceDesigns.model_validate(yaml.safe_load(path.read_text()))


class SpeechBackend(Protocol):
    """The three generation calls an evaluation makes. A test passes arithmetic; a run passes Qwen."""

    def preset(
        self, lock_key: str, text: str, speaker: str, style: str | None, seed: int, target: Path
    ) -> None: ...

    def design(self, text: str, instruct: str, seed: int, target: Path) -> None: ...

    def clone(
        self, lock_key: str, text: str, reference: Path, reference_text: str, seed: int, target: Path
    ) -> None: ...

    def release(self) -> None: ...


class QwenEvaluationBackend:
    """Qwen3-TTS checkpoints loaded by lock key, one at a time.

    One model in memory at once: the 1.7B checkpoints are about 7 GB each in float32, and float32
    is the only dtype measured clean on MPS (`docs/architecture/tts-reliability.md`).
    """

    def __init__(self, lock: Mapping[str, Mapping[str, Any]]) -> None:
        self._lock = lock
        self._key: str | None = None
        self._model: Any = None
        self._prompts: dict[Path, Any] = {}

    def _load(self, lock_key: str) -> Any:
        if self._key == lock_key:
            return self._model
        self.release()
        import torch
        from qwen_tts import Qwen3TTSModel

        spec = self._lock[lock_key]
        self._model = Qwen3TTSModel.from_pretrained(
            locked_snapshot(str(spec["id"]), str(spec["revision"])),
            device_map="mps" if torch.backends.mps.is_available() else "cpu",
            dtype=torch.float32,
        )
        self._key = lock_key
        return self._model

    @staticmethod
    def _write(target: Path, wavs: Any, rate: int) -> None:
        import soundfile as sf

        target.parent.mkdir(parents=True, exist_ok=True)
        sf.write(target, wavs[0], rate)

    def preset(
        self, lock_key: str, text: str, speaker: str, style: str | None, seed: int, target: Path
    ) -> None:
        import torch

        model = self._load(lock_key)
        torch.manual_seed(seed)
        extra = {"instruct": style} if style else {}
        wavs, rate = model.generate_custom_voice(
            text=text, language="German", speaker=speaker, **extra
        )
        self._write(target, wavs, rate)

    def design(self, text: str, instruct: str, seed: int, target: Path) -> None:
        import torch

        model = self._load(DESIGN_LOCK_KEY)
        torch.manual_seed(seed)
        wavs, rate = model.generate_voice_design(
            text=text,
            instruct=instruct,
            language="German",
            max_new_tokens=DESIGN_MAX_NEW_TOKENS,
        )
        self._write(target, wavs, rate)

    def clone(
        self, lock_key: str, text: str, reference: Path, reference_text: str, seed: int, target: Path
    ) -> None:
        import torch

        model = self._load(lock_key)
        prompt = self._prompts.get(reference)
        if prompt is None:
            prompt = model.create_voice_clone_prompt(
                ref_audio=str(reference), ref_text=reference_text, x_vector_only_mode=False
            )
            self._prompts[reference] = prompt
        torch.manual_seed(seed)
        wavs, rate = model.generate_voice_clone(
            text=text,
            language="German",
            voice_clone_prompt=prompt,
            max_new_tokens=CLONE_MAX_NEW_TOKENS,
        )
        self._write(target, wavs, rate)

    def release(self) -> None:
        if self._model is None:
            return
        self._model = None
        self._key = None
        self._prompts.clear()
        gc.collect()
        try:
            import torch

            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
        except ImportError:  # pragma: no cover - the runtime is what loaded the model
            pass


@dataclass
class Take:
    candidate: str
    character: str
    line: str
    text: str
    seed: int
    style: str | None
    path: Path | None = None
    model_sha256: str | None = None
    sha256: str | None = None
    generation_seconds: float | None = None
    duration_seconds: float | None = None
    voiced_seconds: float | None = None
    words_per_second: float | None = None
    transcript: str | None = None
    wer: float | None = None
    passed: bool | None = None
    reference_similarity: float | None = None
    error: str | None = None


@dataclass
class Reference:
    character: str
    instruct: str
    attempts: list[dict[str, Any]] = field(default_factory=list)
    model_path: Path | None = None
    path: Path | None = None

    @property
    def accepted(self) -> bool:
        return self.model_path is not None


Transcriber = Callable[[Path], str]
Conformer = Callable[[Path, Path, float], None]


def _rel(path: Path | None, root: Path) -> str | None:
    return str(path.relative_to(root)) if path is not None else None


def _voiced(path: Path, text: str) -> tuple[float, float, float | None]:
    """`(duration, voiced seconds, words per second of voiced audio)` of a 16 kHz take."""

    import soundfile as sf

    duration = float(sf.info(str(path)).duration)
    audio, rate = trimmed_audio(path)
    voiced = len(audio) / rate
    words = len(normalized_words(text))
    return duration, voiced, (words / voiced if voiced > 0 else None)


def _median(values: Sequence[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    return float(statistics.median(present)) if present else None


def run_voice_evaluation(
    *,
    workspace: Path,
    catalog: CharacterCatalog,
    designs: VoiceDesigns,
    lock: Mapping[str, Mapping[str, Any]],
    candidates: Sequence[str],
    characters: Sequence[str] | None = None,
    backend: SpeechBackend,
    transcribe: Transcriber,
    embedder: EmbeddingBackend | None = None,
    conformer: Conformer = conform,
    clock: Callable[[], float] = time.perf_counter,
    shuffle_seed: str | None = None,
) -> dict[str, Any]:
    """Run one evaluation into `workspace`, which must not exist yet, and return its manifest."""

    unknown = [name for name in candidates if name not in CANDIDATES]
    if unknown:
        raise ValueError(f"unknown candidate(s) {unknown}; known: {sorted(CANDIDATES)}")
    if not candidates:
        raise ValueError("an evaluation needs at least one candidate")
    chosen = [CANDIDATES[name] for name in candidates]
    roster = [
        character
        for character in catalog.characters
        if characters is None or character.id in characters
    ]
    missing = sorted(set(characters or ()) - {character.id for character in roster})
    if missing:
        raise ValueError(f"unknown character(s) {missing}")
    if any(candidate.kind == "preset" for candidate in chosen):
        designed = [c.id for c in roster if c.voice_profile.engine != PRESET_ENGINE]
        if designed:
            raise ValueError(
                f"a preset candidate speaks a character's preset speaker, and {designed} have "
                "designed profiles; compare the design-clone candidates, or name characters with "
                "preset profiles"
            )
    if any(candidate.kind == "design-clone" for candidate in chosen):
        undesigned = [c.id for c in roster if c.id not in designs.designs]
        if undesigned:
            raise ValueError(f"no voice design for {undesigned} in the design file")
    needed = {candidate.lock_key for candidate in chosen}
    if any(candidate.kind == "design-clone" for candidate in chosen):
        needed.add(DESIGN_LOCK_KEY)
    unpinned = sorted(needed - set(lock))
    if unpinned:
        raise ValueError(f"models.lock.json pins no {unpinned}")

    try:
        workspace.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise FileExistsError(
            f"{workspace} already holds an evaluation; a run never overwrites an earlier one"
        ) from exc

    lines = {
        character.id: [*character.demo_phrases, *designs.shared_lines] for character in roster
    }

    # 1. Designed references, only when a clone candidate needs them.
    references: dict[str, Reference] = {}
    if any(candidate.kind == "design-clone" for candidate in chosen):
        for character in roster:
            reference = Reference(character.id, designs.designs[character.id])
            for attempt in range(DESIGN_ATTEMPTS):
                seed = character.voice_profile.seed + attempt
                raw = workspace / "references" / f"{character.id}.seed{seed}.model.wav"
                record: dict[str, Any] = {"seed": seed}
                try:
                    backend.design(designs.reference_text, reference.instruct, seed, raw)
                    conformed = raw.with_name(f"{character.id}.seed{seed}.wav")
                    conformer(raw, conformed, 1.0)
                    transcript = transcribe(conformed)
                    report = check_units(
                        [("reference", designs.reference_text)], {"reference": transcript}
                    )
                    record.update(
                        model_sha256=sha256_file(raw),
                        sha256=sha256_file(conformed),
                        transcript=transcript,
                        wer=report.full_wer,
                        passed=report.passed,
                    )
                    reference.attempts.append(record)
                    if report.passed:
                        reference.model_path, reference.path = raw, conformed
                        break
                except Exception as error:  # noqa: BLE001 - a failed take is a measured outcome
                    record["error"] = f"{type(error).__name__}: {error}"
                    reference.attempts.append(record)
            references[character.id] = reference
        backend.release()

    # 2. Takes, one candidate (one model) at a time.
    takes: list[Take] = []
    for candidate in chosen:
        for character in roster:
            profile = character.voice_profile
            style = profile.style if candidate.style else None
            for index, text in enumerate(lines[character.id], 1):
                take = Take(
                    candidate=candidate.id,
                    character=character.id,
                    line=f"{index:02d}",
                    text=text,
                    seed=profile.seed,
                    style=style,
                )
                takes.append(take)
                base = workspace / "takes" / candidate.id / character.id / take.line
                raw = base.with_suffix(".model.wav")
                try:
                    started = clock()
                    if candidate.kind == "preset":
                        backend.preset(
                            candidate.lock_key, text, profile.voice, style, profile.seed, raw
                        )
                    else:
                        reference = references[character.id]
                        if not reference.accepted or reference.model_path is None:
                            raise RuntimeError("no designed reference passed transcription")
                        backend.clone(
                            candidate.lock_key,
                            text,
                            reference.model_path,
                            designs.reference_text,
                            profile.seed,
                            raw,
                        )
                    take.generation_seconds = clock() - started
                    take.path = base.with_suffix(".wav")
                    conformer(raw, take.path, profile.pace)
                    take.model_sha256 = sha256_file(raw)
                    take.sha256 = sha256_file(take.path)
                except Exception as error:  # noqa: BLE001 - a failed take is a measured outcome
                    take.error = f"{type(error).__name__}: {error}"
                    take.path = None
        backend.release()

    # 3. Measures.
    for take in takes:
        if take.path is None:
            continue
        take.duration_seconds, take.voiced_seconds, take.words_per_second = _voiced(
            take.path, take.text
        )
        take.transcript = transcribe(take.path)
        line = check_units([(take.line, take.text)], {take.line: take.transcript}).lines[0]
        take.wer, take.passed = line.wer, line.passed

    identity: dict[str, Any] = {}
    reference_vectors: dict[str, Any] = {}
    if embedder is not None:
        for name, reference in references.items():
            if reference.path is not None:
                audio, rate = trimmed_audio(reference.path)
                vector = embedder.embed(audio, rate)
                reference_vectors[name] = vector / np.linalg.norm(vector)
        for candidate in chosen:
            measured = [
                take for take in takes if take.candidate == candidate.id and take.path is not None
            ]
            if not measured:
                continue
            consistency = check_unit_consistency(
                [(f"{take.character}/{take.line}", take.character) for take in measured],
                [character.id for character in roster],
                {f"{take.character}/{take.line}": take.path for take in measured if take.path},
                backend=embedder,
            )
            identity[candidate.id] = consistency.model_dump(mode="json")
            if candidate.kind == "design-clone":
                for take in measured:
                    target = reference_vectors.get(take.character)
                    if target is None or take.path is None:
                        continue
                    audio, rate = trimmed_audio(take.path)
                    own = embedder.embed(audio, rate)
                    take.reference_similarity = float(np.dot(own / np.linalg.norm(own), target))

    summary = {
        candidate.id: _summarise(candidate, takes, identity.get(candidate.id)) for candidate in chosen
    }

    # 4. The blind listening page, and the key it is blind to.
    key = write_listening_page(
        workspace, roster_ids=[c.id for c in roster], takes=takes, catalog=catalog,
        shuffle_seed=shuffle_seed or workspace.name,
    )

    manifest: dict[str, Any] = {
        "kind": "voice-evaluation",
        "run": workspace.name,
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "publishable": False,
        "policy": "docs/authoring/product-protection.md — evaluation runs outside the production path",
        "synthetic_references": bool(references),
        "candidates": [
            {"id": c.id, "kind": c.kind, "lock_key": c.lock_key, "style": c.style} for c in chosen
        ],
        "models": {
            name: {"id": lock[name]["id"], "revision": lock[name]["revision"]}
            for name in sorted(needed)
        },
        "designs": {
            "version": designs.version,
            "reference_text": designs.reference_text,
            "references": {
                name: {
                    "origin": "voice-design",
                    "instruct": reference.instruct,
                    "accepted": reference.accepted,
                    "path": _rel(reference.path, workspace),
                    "model_path": _rel(reference.model_path, workspace),
                    "attempts": reference.attempts,
                }
                for name, reference in references.items()
            },
        },
        "characters": [
            {
                "id": c.id,
                "version": c.version,
                "voice": c.voice_profile.voice,
                "seed": c.voice_profile.seed,
                "style": c.voice_profile.style,
                "pace": c.voice_profile.pace,
            }
            for c in roster
        ],
        "takes": [
            {
                **{k: v for k, v in take.__dict__.items() if k != "path"},
                "path": _rel(take.path, workspace),
            }
            for take in takes
        ],
        "summary": summary,
        "identity": identity,
        "blind_key": key,
    }
    (workspace / "run.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    return manifest


def _summarise(
    candidate: Candidate, takes: Sequence[Take], identity: Mapping[str, Any] | None
) -> dict[str, Any]:
    own = [take for take in takes if take.candidate == candidate.id]
    made = [take for take in own if take.path is not None]
    within = [
        row["minimum_similarity"]
        for row in (identity or {}).get("characters", [])
        if row.get("minimum_similarity") is not None
    ]
    between = [row["similarity"] for row in (identity or {}).get("different_characters", [])]
    realtime = [
        take.generation_seconds / take.duration_seconds
        for take in made
        if take.generation_seconds is not None and take.duration_seconds
    ]
    return {
        "takes": len(own),
        "failed_generation": len(own) - len(made),
        "failed_transcription": sum(1 for take in made if take.passed is False),
        "wer_mean": (
            statistics.fmean(take.wer for take in made if take.wer is not None)
            if any(take.wer is not None for take in made)
            else None
        ),
        "words_per_second_median": _median([take.words_per_second for take in made]),
        "realtime_factor_median": _median(realtime),
        "within_character_min_median": _median(within),
        "within_character_min_worst": min(within) if within else None,
        "different_character_max": max(between) if between else None,
        "different_character_median": _median(between),
        "reference_similarity_median": _median([take.reference_similarity for take in made]),
    }


LETTERS = "ABCDEFGH"


def write_listening_page(
    workspace: Path,
    *,
    roster_ids: Sequence[str],
    takes: Sequence[Take],
    catalog: CharacterCatalog,
    shuffle_seed: str,
) -> dict[str, dict[str, str]]:
    """`listen/index.html`, with every take copied under a name that does not say who made it.

    The letter-to-candidate assignment is shuffled **per character** and held for all of that
    character's lines, so the listener can judge one voice across lines; it is returned (and kept
    in `run.json`), never written into the page. Choices stay in the browser and leave it as a
    downloaded `choices.json`, which `evaluate reveal` reads.
    """

    listen = workspace / "listen"
    audio = listen / "audio"
    audio.mkdir(parents=True, exist_ok=True)
    rng = random.Random(shuffle_seed)
    names = {take.candidate for take in takes}
    key: dict[str, dict[str, str]] = {}
    by_id = {character.id: character for character in catalog.characters}
    sections: list[str] = []
    for character_id in roster_ids:
        order = sorted(names)
        rng.shuffle(order)
        assignment = {LETTERS[i]: name for i, name in enumerate(order)}
        key[character_id] = assignment
        character = by_id[character_id]
        rows: list[str] = []
        own = [take for take in takes if take.character == character_id]
        for line in sorted({take.line for take in own}):
            row_id = f"{character_id}/{line}"
            text = next(take.text for take in own if take.line == line)
            cells: list[str] = []
            for letter in sorted(assignment):
                take = next(
                    (
                        t
                        for t in own
                        if t.line == line and t.candidate == assignment[letter]
                    ),
                    None,
                )
                if take is None or take.path is None:
                    player = '<span class="leer">fehlt</span>'
                else:
                    blind = audio / f"{character_id}-{line}-{letter}.wav"
                    shutil.copyfile(take.path, blind)
                    player = (
                        f'<audio controls preload="none" '
                        f'src="audio/{html.escape(blind.name)}"></audio>'
                    )
                cells.append(
                    f'<div class="zelle"><b>{letter}</b>{player}'
                    f'<label><input type="radio" name="{row_id}" value="{letter}"> beste</label>'
                    f'<label><input type="checkbox" data-row="{row_id}" value="{letter}"> '
                    "unbrauchbar</label></div>"
                )
            rows.append(
                f'<div class="zeile"><p>{html.escape(text)}</p>'
                f'<div class="zellen">{"".join(cells)}</div></div>'
            )
        voice_row = "".join(
            f'<label><input type="radio" name="{character_id}/stimme" value="{letter}"> '
            f"{letter}</label>"
            for letter in sorted(assignment)
        )
        sections.append(
            f"<section><h2>{html.escape(character.display_name)}</h2>"
            f'<p class="persona">{html.escape(character.persona)} · {character.age_band}</p>'
            f"{''.join(rows)}"
            f'<div class="zeile stimme"><p>Welche Stimme passt über alle Zeilen am besten zu '
            f"{html.escape(character.display_name)}?</p><div>{voice_row}</div></div></section>"
        )
    (listen / "index.html").write_text(
        LISTEN_PAGE.replace("__RUN__", html.escape(workspace.name)).replace(
            "__SECTIONS__", "\n".join(sections)
        )
    )
    return key


LISTEN_PAGE = """<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stimmen blind vergleichen</title>
<style>
:root { --grund: #f6f4ef; --text: #1d1d1b; --leise: #6b675f; --linie: #d8d3c8; }
@media (prefers-color-scheme: dark) {
  :root { --grund: #1b1a18; --text: #ece8df; --leise: #a39e93; --linie: #3a3732; }
}
body { background: var(--grund); color: var(--text); font: 16px/1.5 system-ui, sans-serif;
  margin: 0 auto; max-width: 1100px; padding: 16px; }
h1 { font-size: 1.4rem; } h2 { margin: 2rem 0 0.25rem; }
.persona, .leise, .leer { color: var(--leise); }
.zeile { border-top: 1px solid var(--linie); padding: 0.75rem 0; }
.zeile p { margin: 0 0 0.5rem; font-weight: 600; }
.zellen { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; }
.zelle { display: flex; flex-direction: column; gap: 0.25rem; }
.zelle audio { width: 100%; }
.stimme label { margin-right: 1rem; }
.leiste { position: sticky; top: 0; background: var(--grund); padding: 0.5rem 0;
  border-bottom: 1px solid var(--linie); display: flex; gap: 1rem; align-items: center; }
button { font: inherit; padding: 0.3rem 0.8rem; }
</style></head><body>
<h1>Stimmen blind vergleichen · __RUN__</h1>
<p class="leise">Jede Figur hat ihre eigene Zuordnung der Buchstaben, die für alle ihre Zeilen gilt.
Wähle pro Zeile die beste Aufnahme, markiere unbrauchbare, und am Ende die Stimme, die am besten zur
Figur passt. Die Auswahl bleibt in diesem Browser; „Auswahl speichern“ lädt <code>choices.json</code>
herunter, das <code>atlas-listening evaluate reveal</code> liest.</p>
<div class="leiste"><button id="speichern" type="button">Auswahl speichern</button>
<span id="stand" class="leise"></span></div>
__SECTIONS__
<script>
const RUN = document.title + "|" + "__RUN__";
const ablage = () => { try { return JSON.parse(localStorage.getItem(RUN) || "{}"); } catch { return {}; } };
const sichern = (wert) => { try { localStorage.setItem(RUN, JSON.stringify(wert)); } catch {} };
function lesen() {
  const auswahl = {};
  document.querySelectorAll('input[type=radio]:checked').forEach((el) => {
    (auswahl[el.name] ||= {}).best = el.value;
  });
  document.querySelectorAll('input[type=checkbox]:checked').forEach((el) => {
    ((auswahl[el.dataset.row] ||= {}).rejected ||= []).push(el.value);
  });
  return auswahl;
}
function stand() {
  const zeilen = new Set([...document.querySelectorAll('input[type=radio]')].map((el) => el.name));
  const gewaehlt = new Set([...document.querySelectorAll('input[type=radio]:checked')].map((el) => el.name));
  document.getElementById('stand').textContent = gewaehlt.size + " von " + zeilen.size + " entschieden";
}
const gespeichert = ablage();
for (const [zeile, wahl] of Object.entries(gespeichert)) {
  if (wahl.best) {
    const el = document.querySelector(`input[type=radio][name="${zeile}"][value="${wahl.best}"]`);
    if (el) el.checked = true;
  }
  for (const b of wahl.rejected || []) {
    const el = document.querySelector(`input[type=checkbox][data-row="${zeile}"][value="${b}"]`);
    if (el) el.checked = true;
  }
}
document.addEventListener('change', () => { sichern(lesen()); stand(); });
document.addEventListener('play', (e) => {
  document.querySelectorAll('audio').forEach((a) => { if (a !== e.target) a.pause(); });
}, true);
document.getElementById('speichern').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ run: "__RUN__", choices: lesen() }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'choices.json'; a.click();
});
stand();
</script></body></html>
"""


def reveal(run_manifest: Mapping[str, Any], choices: Mapping[str, Any]) -> dict[str, Any]:
    """Tally a listener's blind choices per candidate, through the run's key."""

    if choices.get("run") != run_manifest.get("run"):
        raise ValueError(
            f"these choices are for run {choices.get('run')!r}, not {run_manifest.get('run')!r}"
        )
    key: Mapping[str, Mapping[str, str]] = run_manifest["blind_key"]
    names = sorted({name for assignment in key.values() for name in assignment.values()})
    tally = {name: {"best_lines": 0, "best_voice": 0, "rejected_lines": 0} for name in names}
    voices: dict[str, str] = {}
    for row, picked in choices.get("choices", {}).items():
        character, _, line = row.partition("/")
        assignment = key.get(character)
        if assignment is None:
            raise ValueError(f"choice {row!r} names a character this run did not evaluate")
        best = picked.get("best")
        if best is not None:
            if best not in assignment:
                raise ValueError(f"choice {row!r} picks {best!r}, which this character never had")
            if line == "stimme":
                tally[assignment[best]]["best_voice"] += 1
                voices[character] = assignment[best]
            else:
                tally[assignment[best]]["best_lines"] += 1
        for letter in picked.get("rejected", []):
            if letter not in assignment:
                raise ValueError(f"choice {row!r} rejects {letter!r}, which this character never had")
            tally[assignment[letter]]["rejected_lines"] += 1
    return {"run": run_manifest["run"], "tally": tally, "voice_per_character": voices}
