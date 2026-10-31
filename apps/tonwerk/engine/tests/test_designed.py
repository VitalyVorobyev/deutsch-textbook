"""Designed synthetic voices: the store, the engine, the render record, the catalog and casting.

Nothing here loads a model. The engine's refusals are exercised without the speech runtime; its
call into the checkpoint is exercised against a stub model, and only where the runtime is
installed, because the engine imports it to seed and to write.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from listening_studio.catalogs import CatalogVoiceProfile, CharacterDefinition
from listening_studio.domain import Bilingual
from listening_studio.generative.designed import (
    DesignedRecord,
    ModelPin,
    designed_path,
    load_designed,
    record_path,
    resolve_designed,
    store_designed,
    stored_designed,
)
from listening_studio.generative.fake import FakeDesigned
from listening_studio.generative.gateway import SpeechRequest
from listening_studio.generative.qwen_clone import MAX_NEW_TOKENS
from listening_studio.generative.qwen_designed import QwenDesignedClone
from listening_studio.generative.registry import DESIGNED_ENGINES, ENGINES, engine_for
from listening_studio.graph.render import designed_digests, render_scene
from listening_studio.scene.casting import adopt_catalog_voice, catalog_pace, catalog_voice
from listening_studio.scene.model import (
    CastMember,
    CharacterRef,
    Scene,
    SceneAcoustics,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((PACKAGE_ROOT / "models.lock.json").read_text())["models"]

AUDIO = b"RIFF-designed-reference-bytes"
DIGEST = hashlib.sha256(AUDIO).hexdigest()


def record(**overrides: Any) -> DesignedRecord:
    base: dict[str, Any] = {
        "character": "lena",
        "instruct": "Eine junge Frau Mitte zwanzig, warm und aufmerksam.",
        "reference_text": "Hallo, schön, dass Sie da sind.",
        "seed": 100,
        "design_model": ModelPin(id="Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign", revision="d" * 40),
        "clone_model": ModelPin(id=QwenDesignedClone.model_id, revision=QwenDesignedClone.revision),
        "source_run": "voices-fixture",
        "transcript": "Hallo, schön, dass Sie da sind.",
        "wer": 0.0,
    }
    base.update(overrides)
    return DesignedRecord(**base)


# -- the pin ------------------------------------------------------------------


def test_the_designed_engine_is_the_production_lock_row_of_its_name() -> None:
    row = LOCK["qwen_tts_designed"]
    assert row["id"] == QwenDesignedClone.model_id
    assert row["revision"] == QwenDesignedClone.revision
    assert row["license"] == QwenDesignedClone.license
    assert row["adapter_code"] == QwenDesignedClone.adapter_code_revision
    assert "not independently verified" in row["training_data_provenance"]
    assert row.get("scope") != "evaluation"
    # The checkpoint that speaks a designed reference is production too: every manifest names it.
    assert LOCK["qwen_tts_voice_design"].get("scope") != "evaluation"
    assert QwenDesignedClone.supports_style is False
    assert ENGINES["qwen_tts_designed"] is QwenDesignedClone
    assert {"qwen_tts_designed", "fake_designed"} == DESIGNED_ENGINES


# -- the store ----------------------------------------------------------------


def test_a_designed_reference_is_stored_by_digest_once(tmp_path: Path) -> None:
    assert store_designed(tmp_path, AUDIO, DIGEST, record()) is True
    assert designed_path(tmp_path, DIGEST).read_bytes() == AUDIO
    sidecar = json.loads(record_path(tmp_path, DIGEST).read_text())
    assert sidecar["synthetic"] is True and sidecar["character"] == "lena"
    assert designed_path(tmp_path, DIGEST).parent == tmp_path / "voices" / "designed"
    # The same bytes and the same record a second time write nothing.
    assert store_designed(tmp_path, AUDIO, DIGEST, record()) is False
    assert sorted(path.name for path in (tmp_path / "voices" / "designed").iterdir()) == [
        f"{DIGEST}.json",
        f"{DIGEST}.wav",
    ]


def test_a_reference_whose_bytes_are_not_its_digest_is_refused_before_a_write(
    tmp_path: Path,
) -> None:
    with pytest.raises(ValueError, match="hashes to"):
        store_designed(tmp_path, AUDIO + b"!", DIGEST, record())
    assert not (tmp_path / "voices").exists()


def test_a_stored_record_is_never_rewritten(tmp_path: Path) -> None:
    store_designed(tmp_path, AUDIO, DIGEST, record())
    with pytest.raises(ValueError, match="different record"):
        store_designed(tmp_path, AUDIO, DIGEST, record(source_run="voices-other"))
    assert json.loads(record_path(tmp_path, DIGEST).read_text())["source_run"] == "voices-fixture"


def test_loading_refuses_a_missing_a_changed_and_a_malformed_reference(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="not in this studio's app data"):
        load_designed(tmp_path, DIGEST)
    with pytest.raises(ValueError, match="not a designed reference digest"):
        load_designed(tmp_path, "Vivian")
    store_designed(tmp_path, AUDIO, DIGEST, record())
    voice = load_designed(tmp_path, DIGEST)
    assert voice.reference_text == "Hallo, schön, dass Sie da sind."
    assert voice.record["instruct"].startswith("Eine junge Frau")
    designed_path(tmp_path, DIGEST).write_bytes(AUDIO + b"changed")
    with pytest.raises(ValueError, match="now hashes to"):
        resolve_designed(tmp_path, [DIGEST])
    with pytest.raises(ValueError, match="now hashes to"):
        stored_designed(tmp_path)


# -- the engine ---------------------------------------------------------------


def test_the_engine_refuses_a_digest_it_was_not_given(tmp_path: Path) -> None:
    store_designed(tmp_path, AUDIO, DIGEST, record())
    engine = QwenDesignedClone(resolve_designed(tmp_path, [DIGEST]))
    with pytest.raises(ValueError, match="was not given designed reference"):
        engine.voice_for(SpeechRequest(text="Guten Tag.", voice="e" * 64))
    with pytest.raises(ValueError, match="designed voices, not consented ones"):
        engine.voice_for(SpeechRequest(text="Guten Tag.", voice=DIGEST, voice_ref="testperson"))
    with pytest.raises(ValueError, match="accepts no engine parameters"):
        engine.voice_for(SpeechRequest(text="Guten Tag.", voice=DIGEST, params={"x": 1}))
    assert engine.voice_for(SpeechRequest(text="Guten Tag.", voice=DIGEST)).reference_sha256 == (
        DIGEST
    )
    # Refused before the runtime is reached, so the refusal holds where it is not installed.
    with pytest.raises(ValueError, match="was not given designed reference"):
        QwenDesignedClone({}).generate(
            SpeechRequest(text="Guten Tag.", voice=DIGEST), tmp_path / "out.wav"
        )


def test_the_registry_injects_the_designed_references(tmp_path: Path) -> None:
    store_designed(tmp_path, AUDIO, DIGEST, record())
    designed = resolve_designed(tmp_path, [DIGEST])
    engine = engine_for("fake_designed", designed=designed)
    asset = engine.generate(SpeechRequest(text="Guten Tag.", voice=DIGEST), tmp_path / "t.wav")
    assert asset.provenance["engine"] == "fake_designed"
    with pytest.raises(ValueError, match="was not given designed reference"):
        engine_for("fake_designed").generate(
            SpeechRequest(text="Guten Tag.", voice=DIGEST), tmp_path / "u.wav"
        )


class StubModel:
    """What `Qwen3TTSModel` is asked for, recorded rather than computed."""

    def __init__(self) -> None:
        self.prompts: list[dict[str, Any]] = []
        self.clones: list[dict[str, Any]] = []

    def create_voice_clone_prompt(self, **kwargs: Any) -> str:
        self.prompts.append(kwargs)
        return "prompt"

    def generate_voice_clone(self, **kwargs: Any) -> tuple[list[Any], int]:
        import numpy as np

        self.clones.append(kwargs)
        return [np.zeros(2400, dtype=np.float32)], 24000


def test_the_engine_clones_the_reference_with_its_transcript_and_the_token_cap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    pytest.importorskip("torch")
    qwen_tts = pytest.importorskip("qwen_tts")
    from listening_studio.generative import qwen_designed

    stub = StubModel()
    loads: list[str] = []

    def from_pretrained(path: str, **_kwargs: Any) -> StubModel:
        loads.append(path)
        return stub

    monkeypatch.setattr(qwen_tts.Qwen3TTSModel, "from_pretrained", staticmethod(from_pretrained))
    monkeypatch.setattr(qwen_designed, "locked_snapshot", lambda model_id, revision: model_id)
    store_designed(tmp_path, AUDIO, DIGEST, record())
    engine = QwenDesignedClone(resolve_designed(tmp_path, [DIGEST]))
    for index in range(2):
        asset = engine.generate(
            SpeechRequest(text="Guten Tag.", voice=DIGEST, seed=7), tmp_path / f"{index}.wav"
        )
    assert loads == [QwenDesignedClone.model_id]
    assert stub.prompts == [
        {
            "ref_audio": str(designed_path(tmp_path, DIGEST)),
            "ref_text": "Hallo, schön, dass Sie da sind.",
            "x_vector_only_mode": False,
        }
    ]
    assert [call["max_new_tokens"] for call in stub.clones] == [MAX_NEW_TOKENS] * 2 == [240, 240]
    assert asset.provenance["model_revision"] == QwenDesignedClone.revision


# -- the render ---------------------------------------------------------------


def designed_scene(digest: str = DIGEST) -> Scene:
    return Scene(
        slug="entworfen-probe",
        kind="dialogue",
        title=Bilingual(en="Designed", ru="Дизайн"),
        cast=[
            CastMember(
                role="Lena",
                character=CharacterRef(id="lena", version=2),
                voice=VoiceSpec(engine="fake_designed", voice=digest, seed=100),
            )
        ],
        script=[Utterance(id="line-1", role="Lena", display_text="Guten Tag.")],
        timeline=[SpeechEntry(utterance_id="line-1")],
        acoustics=SceneAcoustics(),
    )


def test_a_designed_render_records_its_reference_and_hashes_the_digest(tmp_path: Path) -> None:
    store_designed(tmp_path, AUDIO, DIGEST, record())
    scene = designed_scene()
    designed = resolve_designed(tmp_path, designed_digests(scene))
    result = render_scene(
        scene,
        tmp_path / "store",
        speech_engines={"fake_designed": engine_for("fake_designed", designed=designed)},
        designed=designed,
    )
    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["designed_voices"]["Lena"]["reference_sha256"] == DIGEST
    assert manifest["designed_voices"]["Lena"]["synthetic"] is True
    assert manifest["voices"] == {}
    synth = next(row for row in manifest["nodes"] if row["type"] == "synth")
    assert synth["params"]["request"]["voice"] == DIGEST


def test_a_render_refuses_a_designed_reference_it_was_not_given(tmp_path: Path) -> None:
    scene = designed_scene()
    with pytest.raises(ValueError, match="not in this studio's app data"):
        render_scene(
            scene,
            tmp_path / "store",
            speech_engines={"fake_designed": FakeDesigned({})},
            designed={},
        )


# -- the catalog and casting --------------------------------------------------


def character(**profile: Any) -> CharacterDefinition:
    return CharacterDefinition(
        id="lena",
        version=2,
        display_name="Lena",
        age_band="young-adult",
        persona="Fixture",
        registers=["neutral"],
        roles=["friend"],
        casting_tags=["warm"],
        status="draft-profile",
        voice_profile=CatalogVoiceProfile(
            **({"engine": "qwen_tts_designed", "voice": DIGEST, "seed": 100, "pace": 0.84} | profile)
        ),
        demo_phrases=["Eins.", "Zwei.", "Drei."],
    )


def test_a_designed_profile_names_a_digest_and_carries_no_style() -> None:
    assert character().voice_profile.style is None
    with pytest.raises(ValueError, match="SHA-256"):
        character(voice="Vivian")
    with pytest.raises(ValueError, match="no style"):
        character(style="Sprich warm.")
    with pytest.raises(ValueError, match="style sentence"):
        character(engine="qwen_tts", voice="Vivian")
    with pytest.raises(ValueError, match="unknown Qwen preset"):
        character(engine="qwen_tts", voice=DIGEST, style="Sprich warm.")


def test_adopting_a_catalog_voice_casts_the_role_and_paces_its_lines() -> None:
    lena = character()
    scene = Scene(
        slug="adoption",
        kind="dialogue",
        title=Bilingual(en="A", ru="А"),
        cast=[
            CastMember(role="Lena", voice=VoiceSpec(engine="qwen_tts", voice="Vivian", seed=1)),
            CastMember(role="Paul", voice=VoiceSpec(engine="qwen_tts", voice="Ryan", seed=2)),
        ],
        script=[
            Utterance(id="a", role="Lena", display_text="Hallo.", pace=0.95),
            Utterance(id="b", role="Paul", display_text="Hallo.", pace=0.95),
            Utterance(id="c", role="Lena", display_text="Tschüss."),
        ],
        timeline=[SpeechEntry(utterance_id=line) for line in ("a", "b", "c")],
        acoustics=SceneAcoustics(),
    )
    adopted = adopt_catalog_voice(scene, "Lena", lena)
    member = adopted.member("Lena")
    assert member.character == CharacterRef(id="lena", version=2)
    assert (member.voice.engine, member.voice.voice, member.voice.style) == (
        "qwen_tts_designed",
        DIGEST,
        None,
    )
    assert [row.pace for row in adopted.script] == [0.84, 0.95, 0.84]
    # Adopting the same profile twice is the same scene.
    assert adopt_catalog_voice(adopted, "Lena", lena).sha256() == adopted.sha256()
    with pytest.raises(KeyError):
        adopt_catalog_voice(scene, "Mara", lena)


def test_a_narration_composes_its_level_pace_with_the_characters() -> None:
    lena = character()
    assert catalog_pace(lena, 0.9) == round(0.9 * 0.84, 3)
    assert catalog_pace(lena, 0.5) == 0.7  # held inside the scene model's bounds
    # A reading instruction reaches only a preset voice.
    assert catalog_voice(lena, style="Lies ruhig.").style is None
    preset = character(engine="qwen_tts", voice="Vivian", style="Sprich warm.")
    assert catalog_voice(preset, style="Lies ruhig.").style == "Sprich warm. Lies ruhig."
