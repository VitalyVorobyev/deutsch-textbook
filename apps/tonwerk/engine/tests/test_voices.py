"""Consent-gated voice cloning: the rules, the store, the identity, and what it costs a hash.

Nothing here loads a model. `FakeClone` has the capability and clones nothing, which is what lets
the whole consent path — validation, binding, revocation, node identity, the API and the CLI — run
in an environment that has never seen torch. That is CI.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from listening_studio.generative.fake import FakeClone, FakeSpeech
from listening_studio.generative.gateway import SpeechRequest, supports_cloning
from listening_studio.generative.qwen import QwenSpeech
from listening_studio.generative.qwen_clone import QwenBaseClone
from listening_studio.generative.voices import (
    CONSENT_RULES,
    ConsentViolation,
    clonable_of,
    delete_reference,
    parse_consent,
    reference_path,
    resolve_voices,
    revoke,
    rules_for,
    sha256_bytes,
    store_reference,
    voice_row,
)
from listening_studio.graph.nodes import synth_node
from listening_studio.storage import Store

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REFERENCE = b"RIFF....WAVEfake reference audio bytes"


def consent(**overrides: object) -> dict[str, object]:
    """A publication-scope adult consent that satisfies every rule, as a mutable dict.

    Written out rather than built by a helper chain: every test below is about one field of this
    document being wrong, and a fixture that hid the fields would make each of them a test about
    the fixture.
    """

    document: dict[str, object] = {
        "version": 1,
        "recorded_at": "2026-08-21",
        "scope": "publication",
        "subject": {"display_name": "Testperson", "is_minor": False},
        "authorized_purpose": (
            "Sprechrolle in den Hörtexten des Deutsch-Atlas-Kurses, gelesen aus dem Kursskript."
        ),
        "permitted_uses": ["Veröffentlichung im Deutsch-Atlas-Kurs (Hörtexte und Lesetexte)"],
        "prohibited_uses": ["Weitergabe außerhalb des Kurses", "Werbung", "Training anderer Modelle"],
        "retention": {
            "policy": "Referenzaufnahme wird bis zum Widerruf aufbewahrt und dann gelöscht.",
            "automatic_deletion": False,
        },
        "reference": {"sha256": sha256_bytes(REFERENCE)},
    }
    document.update(overrides)
    return document


def parse(**overrides: object) -> object:
    return parse_consent(json.dumps(consent(**overrides)))


def refused(**overrides: object) -> str:
    with pytest.raises(ConsentViolation) as error:
        parse(**overrides)
    return error.value.rule


# -- the rules ----------------------------------------------------------------


def test_a_publication_consent_that_satisfies_every_rule_is_accepted() -> None:
    document = parse()
    assert document.scope == "publication"  # type: ignore[attr-defined]
    assert document.subject.display_name == "Testperson"  # type: ignore[attr-defined]


def test_publication_needs_a_permitted_use_naming_this_course() -> None:
    """Permitting publication *in general* is a broader grant than this product asks for."""

    assert refused(permitted_uses=[]) == "publication-permits-course"
    assert refused(permitted_uses=["Veröffentlichung"]) == "publication-permits-course"
    assert refused(permitted_uses=["Nutzung im Kurs"]) == "publication-permits-course"
    # Either project language satisfies it, because the document is written by a person.
    assert parse(permitted_uses=["publication in the course"]) is not None


def test_publication_still_bars_redistribution_outside_the_course() -> None:
    assert refused(prohibited_uses=["Werbung"]) == "publication-bars-redistribution"


def test_evaluation_keeps_the_research_path_prohibitions() -> None:
    """The scope the `.private/` experiment ran under, unchanged: upload, publication, git."""

    assert parse(
        scope="evaluation",
        permitted_uses=[],
        prohibited_uses=["upload", "publication", "git"],
    ) is not None
    assert (
        refused(scope="evaluation", permitted_uses=[], prohibited_uses=["upload", "git"])
        == "evaluation-bars-publication"
    )


def test_a_minor_needs_guardian_consent_and_a_guardian_attested_assent() -> None:
    minor = {"display_name": "Kind", "is_minor": True}
    assert refused(subject=minor) == "minor-guardian"
    guardian = {
        "confirmed": True,
        "attestation": "Ich bin erziehungsberechtigt und willige ein.",
        "guardian": "Testperson",
    }
    assert refused(subject=minor, guardian_consent=guardian) == "minor-assent"
    assert (
        refused(
            subject=minor,
            guardian_consent=guardian,
            child_assent={
                "confirmed": True,
                "attestation": "Ich bin einverstanden.",
                "attested_by_guardian": False,
            },
        )
        == "minor-assent"
    )
    assert parse(
        subject=minor,
        guardian_consent=guardian,
        child_assent={
            "confirmed": True,
            "attestation": "Ich bin einverstanden.",
            "attested_by_guardian": True,
        },
    ) is not None


def test_an_adult_consent_needs_no_guardian_record() -> None:
    """The rules that exist because of a minor apply only to one."""

    assert [rule.id for rule in rules_for("publication", is_minor=False)].count("minor-guardian") == 0
    assert "minor-guardian" in [rule.id for rule in rules_for("publication", is_minor=True)]


def test_a_field_constraint_is_reported_under_the_rule_it_belongs_to() -> None:
    """One vocabulary. An editor should not learn "purpose" twice under two different names."""

    assert refused(authorized_purpose="zu kurz") == "purpose-stated"
    assert refused(retention={"policy": "kurz", "automatic_deletion": True}) == "retention-stated"


def test_every_published_rule_is_reachable() -> None:
    """A rule nobody can fail is documentation pretending to be enforcement."""

    ids = {rule.id for rule in CONSENT_RULES}
    assert ids == {
        "subject-named",
        "purpose-stated",
        "retention-stated",
        "reference-sha-binding",
        "minor-guardian",
        "minor-assent",
        "evaluation-bars-publication",
        "publication-permits-course",
        "publication-bars-redistribution",
    }


# -- the binding and the store ------------------------------------------------


def test_the_consent_is_bound_to_the_exact_reference_bytes(tmp_path: Path) -> None:
    """The one rule the whole design rests on: a permission slip with the name left blank."""

    document = parse()
    with pytest.raises(ConsentViolation) as error:
        store_reference(tmp_path, b"other audio entirely", document)  # type: ignore[arg-type]
    assert error.value.rule == "reference-sha-binding"
    assert not (tmp_path / "voices").exists()

    reference_sha, consent_sha = store_reference(tmp_path, REFERENCE, document)  # type: ignore[arg-type]
    assert reference_sha == sha256_bytes(REFERENCE)
    assert reference_path(tmp_path, reference_sha).read_bytes() == REFERENCE
    assert len(consent_sha) == 64


def test_revocation_deletes_the_recording_and_keeps_the_document(tmp_path: Path) -> None:
    store = Store(tmp_path / "studio.sqlite3")
    row = _register(store, tmp_path)
    (tmp_path / "voices" / row.id).mkdir(parents=True, exist_ok=True)
    (tmp_path / "voices" / row.id / "demo-1.wav").write_bytes(b"demo")

    record = revoke(store, tmp_path, row.id)
    assert record["reference_deleted"] is True
    assert record["demos_deleted"] == 1
    assert not reference_path(tmp_path, row.reference_sha256).exists()
    # The document stays: it is the evidence behind the consent hash in a published render's
    # provenance, and deleting it would leave that hash pointing at nothing.
    assert (tmp_path / "voices" / f"{row.reference_sha256}.consent.json").exists()

    stored = store.get_voice(row.id)
    assert stored is not None and stored.revoked_at is not None
    first = stored.revoked_at
    revoke(store, tmp_path, row.id)
    again = store.get_voice(row.id)
    # The first date stands. It is what a retirement decision is made against.
    assert again is not None and again.revoked_at == first


def test_a_revoked_or_unknown_voice_is_refused_by_name(tmp_path: Path) -> None:
    store = Store(tmp_path / "studio.sqlite3")
    row = _register(store, tmp_path)
    assert resolve_voices(store, tmp_path, [row.id]).refs[row.id].id == row.id

    with pytest.raises(ValueError, match="does not have"):
        resolve_voices(store, tmp_path, ["nie-erstellt"])

    revoke(store, tmp_path, row.id)
    with pytest.raises(ValueError, match="revoked"):
        resolve_voices(store, tmp_path, [row.id])


def test_a_row_without_its_bytes_is_reported_as_absent_not_as_revoked(tmp_path: Path) -> None:
    """A database that travelled without its app-data has the row and not the recording."""

    store = Store(tmp_path / "studio.sqlite3")
    row = _register(store, tmp_path)
    delete_reference(tmp_path, row.reference_sha256)
    rendered = voice_row(tmp_path, row)
    assert rendered["reference_present"] is False
    assert rendered["revoked_at"] is None
    with pytest.raises(ValueError, match="no reference recording"):
        resolve_voices(store, tmp_path, [row.id])


# -- the capability -----------------------------------------------------------


def test_only_the_cloning_engines_declare_the_capability() -> None:
    assert supports_cloning(FakeClone()) is True
    assert supports_cloning(QwenBaseClone()) is True
    assert supports_cloning(FakeSpeech()) is False
    assert supports_cloning(QwenSpeech()) is False


def test_an_engine_without_the_capability_refuses_a_voice_ref(tmp_path: Path) -> None:
    """The failure this whole path exists to prevent: a good take in the wrong person's voice."""

    request = SpeechRequest(text="Guten Tag.", voice="Vivian", voice_ref="testperson")
    with pytest.raises(ValueError, match="cannot synthesize through a voice reference"):
        FakeSpeech().generate(request, tmp_path / "out.wav")


def test_a_cloning_engine_refuses_a_request_that_names_no_voice(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="only through a stored voice reference"):
        FakeClone().generate(
            SpeechRequest(text="Guten Tag.", voice="Testperson"), tmp_path / "out.wav"
        )


def test_a_cloning_engine_refuses_a_voice_it_was_not_given(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="was not given voice reference"):
        FakeClone().generate(
            SpeechRequest(text="Guten Tag.", voice="Testperson", voice_ref="fremd"),
            tmp_path / "out.wav",
        )


def test_make_voice_then_synthesize_writes_the_voice_into_the_provenance(tmp_path: Path) -> None:
    store = Store(tmp_path / "studio.sqlite3")
    row = _register(store, tmp_path)
    voice = clonable_of(tmp_path, row)
    engine = FakeClone({row.id: voice})

    bound = engine.make_voice(
        voice_id=row.id,
        reference=voice.reference_path,
        reference_sha256=row.reference_sha256,
        ref_text=row.reference_text,
        consent_sha256=row.consent_sha256,
        x_vector_only=False,
    )
    assert bound.reference_sha256 == row.reference_sha256
    assert bound.consent_sha256 == row.consent_sha256

    asset = engine.generate(
        SpeechRequest(text="Guten Tag.", voice="Testperson", voice_ref=row.id),
        tmp_path / "take.wav",
    )
    assert asset.provenance["voice"] == {
        "id": row.id,
        "engine": "fake_clone",
        "model_revision": FakeClone.revision,
        "reference_sha256": row.reference_sha256,
        "consent_sha256": row.consent_sha256,
    }


# -- identity -----------------------------------------------------------------


def test_a_preset_request_hashes_exactly_as_it_did_before_voice_ref_existed() -> None:
    """The cache-invalidation guard. Every take in the store keeps the hash it has.

    `voice_ref` is dropped from the identity payload when it is None, so the canonical JSON of an
    ordinary request is byte-identical to what it was — and the four literal keys below are what
    that means, written out rather than compared against a re-derivation of themselves.
    """

    request = SpeechRequest(text="Guten Tag.", voice="Vivian", seed=100)
    assert json.loads(request.canonical_json()) == {
        "language": "German",
        "params": {},
        "seed": 100,
        "style": None,
        "text": "Guten Tag.",
        "voice": "Vivian",
    }
    assert synth_node(request, FakeSpeech()).node_hash() == (
        synth_node(SpeechRequest(text="Guten Tag.", voice="Vivian", seed=100), FakeSpeech())
        .node_hash()
    )


def test_two_casts_differing_only_in_voice_ref_are_different_synth_nodes(tmp_path: Path) -> None:
    """Node identity is the whole reason the reference and consent digests are in the params."""

    store = Store(tmp_path / "studio.sqlite3")
    _register(store, tmp_path, voice_id="stimme-eins")
    _register(store, tmp_path, voice_id="stimme-zwei", audio=b"RIFF....WAVEa second recording")
    engine = FakeClone()

    def node(voice_id: str) -> str:
        row = store.get_voice(voice_id)
        assert row is not None
        request = SpeechRequest(text="Guten Tag.", voice="Testperson", voice_ref=voice_id)
        return synth_node(request, engine, clonable_of(tmp_path, row).ref).node_hash()

    assert node("stimme-eins") != node("stimme-zwei")
    # And different from the same line on a preset voice, which is the other direction of the
    # same claim: a cloned take must never land in a preset take's cache slot.
    assert node("stimme-eins") != synth_node(
        SpeechRequest(text="Guten Tag.", voice="Testperson"), FakeSpeech()
    ).node_hash()


def test_the_same_voice_at_a_different_consent_is_a_different_node(tmp_path: Path) -> None:
    """The id alone is not the identity: a re-signed consent is a different permission."""

    from listening_studio.generative.gateway import VoiceRef

    request = SpeechRequest(text="Guten Tag.", voice="Testperson", voice_ref="stimme")
    engine = FakeClone()
    base = VoiceRef(
        id="stimme",
        engine="fake_clone",
        model_revision=FakeClone.revision,
        reference_sha256="a" * 64,
        consent_sha256="b" * 64,
    )
    other = VoiceRef(**{**base.as_json(), "consent_sha256": "c" * 64})
    assert synth_node(request, engine, base).node_hash() != synth_node(
        request, engine, other
    ).node_hash()


# -- the pin ------------------------------------------------------------------


def test_the_cloning_checkpoint_is_pinned_in_the_production_lock() -> None:
    """It moved out of the benchmark lock when cloning stopped being research-only.

    Two claims, and the second is the one a reader of a published manifest depends on: the engine's
    own constants and the lock row are the same pin, and the benchmark lock no longer carries a
    second copy of it to drift from.
    """

    lock = json.loads((PACKAGE_ROOT / "models.lock.json").read_text())["models"]["qwen_tts_base"]
    assert lock["id"] == QwenBaseClone.model_id
    assert lock["revision"] == QwenBaseClone.revision
    assert lock["license"] == QwenBaseClone.license
    assert lock["adapter_code"] == QwenBaseClone.adapter_code_revision
    assert "not independently verified" in lock["training_data_provenance"]

    benchmark = json.loads((PACKAGE_ROOT / "benchmark-models.lock.json").read_text())["models"]
    assert set(benchmark) == {"voice_design"}


def _register(
    store: Store,
    root: Path,
    *,
    voice_id: str = "testperson",
    audio: bytes = REFERENCE,
) -> object:
    """One consented voice in the store, bytes and all. The setup every test above shares."""

    document = parse_consent(
        json.dumps(consent(reference={"sha256": sha256_bytes(audio)}))
    )
    reference_sha, consent_sha = store_reference(root, audio, document)
    return store.create_voice(
        voice_id=voice_id,
        reference_sha256=reference_sha,
        reference_text="Guten Tag, ich lese diesen Satz als Referenz.",
        subject_display_name=document.subject.display_name,
        scope=document.scope,
        consent_sha256=consent_sha,
        guardian_consent=False,
        child_assent=False,
        retention=document.retention.policy,
        engine="fake_clone",
        model_revision=FakeClone.revision,
        x_vector_only=False,
    )
