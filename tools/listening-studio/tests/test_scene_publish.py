"""Publishing an approved scene into a course repository: the gates, the bytes, the rollback.

Everything here runs on `FakeSpeech`/`FakeClone`, `FakeSound` and ffmpeg — the property the CI
engine job keeps. The repository is a fixture built by this file, so every check states its own
inputs: pointed at the real checkout, half the assertions below would be about content somebody
else committed.

**The artifact record is checked against `listeningArtifactSchema`'s requirements written out by
hand** (`ARTIFACT_KEYS` and the assertions under it). Mirroring the Zod shape in Python is a second
implementation and would normally be the wrong move — but the alternative is a pytest that shells
out to `bun`, which is the one thing the engine's CI environment does not have. The real validator
runs once, from the repository root, as its own gate.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient

from listening_studio.api.registry import registry
from listening_studio.domain import Bilingual, Stage
from listening_studio.generative.fake import FakeClone
from listening_studio.generative.voices import reference_path
from listening_studio.scene.model import (
    CastMember,
    Scene,
    SceneAcoustics,
    SceneBrief,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)
from listening_studio.scene.publish import (
    PublishRefusal,
    plan_publish,
    publish_scene,
    write_publish,
)
from listening_studio.storage import Store
from listening_studio.web import app

REPO = Path(__file__).resolve().parents[3]
AUTH = {"Authorization": "Bearer test"}

#: Every key `listeningArtifactSchema` requires, and none it forbids. Held here so that a field
#: dropped from `listening_record` fails a test rather than a build in another language.
ARTIFACT_KEYS = {
    "id",
    "level",
    "title",
    "scenario",
    "duration_seconds",
    "speakers",
    "transcript",
    "provenance",
}

#: The consent digest the fixture voice is registered under. Never parsed here — `test_voices.py`
#: owns the consent rules, and this file owns what the *publisher* does with a row that already
#: exists.
CONSENT_SHA = "c" * 64


def fixture_repo(tmp_path: Path) -> Path:
    """A course repo holding exactly what a render, a publish and the registry read.

    Six files, and each one is read by something under test: the two acoustic catalogs by the
    renderer, the listening plan by the registry, and `data/prompts/` by the registry's `brief`
    derivation. `content/exercises/` stays empty on purpose — the `exercise-turns` gate has its own
    test, which writes the set it needs.
    """

    repo = tmp_path / "repo"
    (repo / "data").mkdir(parents=True)
    for name in ("acoustic-profiles.yaml", "acoustic-difficulty.yaml"):
        (repo / "data" / name).write_bytes((REPO / "data" / name).read_bytes())
    (repo / "data" / "prompts").mkdir()
    (repo / "content" / "exercises" / "a2").mkdir(parents=True)
    (repo / "data" / "listening-plan.yaml").write_text(
        "version: 1\n"
        "units:\n"
        "  - unit: fixture-unit\n"
        "    level: A2\n"
        "    artifacts:\n"
        "      - id: fixture-cafe\n"
        "        scenario: Im Café etwas bestellen\n"
    )
    return repo


def fixture_scene(**overrides: Any) -> Scene:
    """Two roles, three turns, no sound. Speech only, so no asset store has to be seeded."""

    base: dict[str, Any] = {
        "slug": "fixture-cafe",
        "kind": "dialogue",
        "title": Bilingual(en="At the café", ru="В кафе"),
        "brief": SceneBrief(level="A2", scenario="Im Café etwas bestellen", topic="essen-trinken"),
        "cast": [
            CastMember(role="Mara", voice=VoiceSpec(engine="fake", voice="Vivian", seed=101)),
            CastMember(role="Jonas", voice=VoiceSpec(engine="fake", voice="Eric", seed=102)),
        ],
        "script": [
            Utterance(id="line-1", role="Mara", display_text="Guten Tag, einen Kaffee bitte."),
            Utterance(id="line-2", role="Jonas", display_text="Gern. Mit Milch oder ohne?"),
            Utterance(id="line-3", role="Mara", display_text="Mit Milch, bitte."),
        ],
        "timeline": [
            SpeechEntry(utterance_id="line-1"),
            SpeechEntry(utterance_id="line-2"),
            SpeechEntry(utterance_id="line-3"),
        ],
        "acoustics": SceneAcoustics(),
    }
    base.update(overrides)
    return Scene.model_validate(base)


def transcript_of(scene: Scene) -> Any:
    """A transcriber that hears exactly what the script says. `test_api_scenes.py`'s, verbatim."""

    def transcribe(path: Path) -> str:
        if path.stem == "qa":
            return " ".join(utterance.spoken_text() for utterance in scene.script)
        return scene.utterance(path.stem).spoken_text()

    return transcribe


def approve(http: TestClient, store: Store, scene: Scene) -> str:
    """Render, QA and sign, exactly as a reviewer would. Returns the approved master's sha."""

    created = http.post(
        "/api/scenes", json={"scene": scene.model_dump(mode="json")}, headers=AUTH
    )
    assert created.status_code == 201, created.text
    rendered = http.post(f"/api/scenes/{scene.slug}/render", json={}, headers=AUTH)
    assert rendered.status_code == 200, rendered.text
    checked = http.post(f"/api/scenes/{scene.slug}/qa", json={}, headers=AUTH)
    assert checked.status_code == 200, checked.text
    master = store.root / "renders" / scene.sha256() / "natural" / "master.wav"
    digest = hashlib.sha256(master.read_bytes()).hexdigest()
    signed = http.post(
        f"/api/scenes/{scene.slug}/approve",
        json={
            "editor": "Vitaly Vorobyev",
            "master_sha256": digest,
            # No ambience and no sfx, so `context` is not required; no exercise, so neither is
            # `questions`. `_required_checks` is the rule and this is what it asks for.
            "checklist": [
                "accent",
                "naturalness",
                "intelligibility",
                "identity",
                "speakers",
                "pace",
            ],
        },
        headers=AUTH,
    )
    assert signed.status_code == 200, signed.text
    return digest


@pytest.fixture
def approved(tmp_path: Path) -> Any:
    """A store, a repository and one scene signed off at `human_approved`."""

    store = Store(tmp_path / "db.sqlite3")
    repo = fixture_repo(tmp_path)
    scene = fixture_scene()
    http = TestClient(
        app(
            store,
            repo,
            token="test",
            allow_test_adapters=True,
            transcribe_fn=transcript_of(scene),
        ),
        raise_server_exceptions=False,
    )
    digest = approve(http, store, scene)
    return http, store, repo, scene, digest


# -- what a publish writes ----------------------------------------------------


def test_a_published_scene_writes_a_valid_artifact_its_audio_and_a_scene_manifest(
    approved: Any,
) -> None:
    http, store, repo, scene, digest = approved

    plan, written = publish_scene(store, repo, scene.slug)
    assert [path.relative_to(repo).as_posix() for path in written] == [
        "content/listening/a2/fixture-cafe.yaml",
        "content/listening/a2/fixture-cafe.mp3",
        "data/audio-provenance/a2/fixture-cafe.json",
        f"data/prompts/{str(plan.manifest['created_at'])[:10]}-fixture-cafe-listening.md",
    ]
    for path in written:
        assert path.exists(), path

    record = yaml.safe_load((repo / "content/listening/a2/fixture-cafe.yaml").read_text())
    # Every field `listeningArtifactSchema` requires, and nothing it does not declare.
    assert set(record) == ARTIFACT_KEYS
    assert record["id"] == "fixture-cafe"
    assert record["level"] == "A2"
    assert set(record["title"]) <= {"en", "ru", "uk", "de"} and record["title"]["en"]
    assert record["scenario"] == "Im Café etwas bestellen"
    assert isinstance(record["duration_seconds"], int) and record["duration_seconds"] > 0
    assert 1 <= len(record["speakers"]) <= 4
    assert record["speakers"] == ["Mara", "Jonas"]
    assert record["transcript"] == [
        {"speaker": "Mara", "text": "Guten Tag, einen Kaffee bitte."},
        {"speaker": "Jonas", "text": "Gern. Mit Milch oder ohne?"},
        {"speaker": "Mara", "text": "Mit Milch, bitte."},
    ]
    assert record["provenance"] == "data/audio-provenance/a2/fixture-cafe.json"

    # The duration is the render's, never the brief's: the artifact record has to describe the
    # MP3 beside it, and a brief states a window somebody asked for.
    manifest = json.loads((repo / "data/audio-provenance/a2/fixture-cafe.json").read_text())
    assert record["duration_seconds"] == max(1, round(manifest["render"]["duration_ms"] / 1000))

    assert manifest["version"] == 2
    assert manifest["id"] == "fixture-cafe"
    assert manifest["scene_sha256"] == scene.sha256()
    # The embedded document is what makes that sha checkable outside the studio's own SQLite.
    assert Scene.model_validate(manifest["scene"]).sha256() == scene.sha256()
    assert manifest["master_audio_sha256"] == digest
    assert manifest["approval"]["status"] == "complete"
    assert manifest["qa"]["passed"] is True
    assert manifest["dependency_lock_sha256"] and manifest["model_lock_sha256"]
    # `scripts/validate.ts` hashes the committed MP3 against this field and fails the corpus on a
    # mismatch, so it is checked here rather than left to a build in another language.
    assert manifest["published_audio_sha256"] == hashlib.sha256(
        (repo / "content/listening/a2/fixture-cafe.mp3").read_bytes()
    ).hexdigest()
    assert manifest["render"]["nodes"] and manifest["render"]["timing"]
    assert manifest["generation_brief"]["sha256"] == hashlib.sha256(
        (repo / manifest["generation_brief"]["path"]).read_bytes()
    ).hexdigest()

    # A preset-voice scene: no cloning, no consent, and the claims say so as facts computed from
    # the render's voices map rather than as constants.
    assert manifest["voices"] == {}
    assert manifest["claims"] == {
        "model_license_is_training_data_provenance": False,
        "voice_cloning_used": False,
        "reference_audio_used": False,
        "consent_sha256": [],
    }

    stored = store.get_scene_by_slug(scene.slug)
    assert stored is not None and stored[0].stage == Stage.EXPORTED


def test_the_mp3_is_the_renders_own_publish_derivative(approved: Any) -> None:
    """Not re-encoded on the way out: the bytes a learner downloads are the bytes QA measured."""

    _http, store, repo, scene, _digest = approved
    publish_scene(store, repo, scene.slug)
    rendered = store.root / "renders" / scene.sha256() / "natural" / "publish.mp3"
    assert (repo / "content/listening/a2/fixture-cafe.mp3").read_bytes() == rendered.read_bytes()


def test_a_dry_run_reports_exactly_what_a_publish_would_write_and_writes_nothing(
    approved: Any,
) -> None:
    http, _store, repo, scene, _digest = approved

    dry = http.post(f"/api/scenes/{scene.slug}/publish", json={"dry_run": True}, headers=AUTH)
    assert dry.status_code == 200, dry.text
    answer = dry.json()
    assert answer["dry_run"] is True
    assert set(answer["files"]) == set(answer["staged"])
    assert answer["level"] == "A2"
    assert not (repo / "content" / "listening").exists()
    assert not (repo / "data" / "audio-provenance").exists()
    # …and the scene has not moved: a dry run is a reading.
    assert http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()["stage"] == str(
        Stage.HUMAN_APPROVED
    )


# -- the gate matrix ----------------------------------------------------------


def refusal(store: Store, repo: Path, slug: str, **kwargs: Any) -> str:
    with pytest.raises(PublishRefusal) as error:
        plan_publish(store, repo, slug, **kwargs)
    return error.value.gate


def test_an_unapproved_scene_is_refused_at_the_stage_gate(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    repo = fixture_repo(tmp_path)
    scene = fixture_scene()
    store.create_scene(scene, None)
    assert refusal(store, repo, scene.slug) == "stage"
    assert refusal(store, repo, "nicht-vorhanden") == "scene"


def test_only_the_natural_variant_is_published(approved: Any) -> None:
    """A difficulty rendering shipped as *the* recording is not a mistake anyone sees in a diff."""

    _http, store, repo, scene, _digest = approved
    assert refusal(store, repo, scene.slug, variant="challenging") == "variant"


def test_an_approval_that_no_longer_names_this_master_is_refused(approved: Any) -> None:
    """The render was rebuilt after the signature. Both halves are put back in agreement first.

    Rewriting `render.json`'s declared master sha alongside the file is what makes this the
    `approval-master-sha` case rather than the `render-drift` one: a render whose manifest and
    files disagree is a *different* failure with a different fix, and a test that tripped the wrong
    gate would prove neither.
    """

    _http, store, repo, scene, _digest = approved
    directory = store.root / "renders" / scene.sha256() / "natural"
    master = directory / "master.wav"
    master.write_bytes(master.read_bytes() + b"\0\0")
    fresh = hashlib.sha256(master.read_bytes()).hexdigest()
    manifest = json.loads((directory / "render.json").read_text())
    for row in manifest["artifacts"]:
        if row["kind"] == "master":
            row["sha256"] = fresh
    (directory / "render.json").write_text(json.dumps(manifest))

    assert refusal(store, repo, scene.slug) == "approval-master-sha"


def test_a_render_whose_files_no_longer_match_its_manifest_is_refused(approved: Any) -> None:
    _http, store, repo, scene, _digest = approved
    master = store.root / "renders" / scene.sha256() / "natural" / "master.wav"
    master.write_bytes(master.read_bytes() + b"\0\0")
    assert refusal(store, repo, scene.slug) == "render-drift"


def test_a_level_that_cannot_be_derived_is_refused_and_an_explicit_one_is_accepted(
    tmp_path: Path,
) -> None:
    """The one gate that names its own escape hatch, and the order that keeps it reachable.

    A scene with no brief lacks both a level and a scenario. The level is asked for first, because
    `--level` is something the caller can actually supply — telling them to add a brief when they
    could have passed a flag is a refusal that does not help.
    """

    store = Store(tmp_path / "db.sqlite3")
    repo = fixture_repo(tmp_path)
    scene = fixture_scene(brief=None)
    project = store.create_scene(scene, None)
    for expected, target in (
        (Stage.DRAFT, Stage.VALIDATED),
        (Stage.VALIDATED, Stage.AUDIO_GENERATED),
        (Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED),
    ):
        store.transition_scene(project.id, expected, target, qa={"passed": True})
    store.transition_scene(
        project.id,
        Stage.AUTOMATICALLY_CHECKED,
        Stage.HUMAN_APPROVED,
        approval={"status": "complete", "editor": "Fixture", "reviewed_at": "2026-08-21"},
    )

    assert refusal(store, repo, scene.slug) == "level"
    # With the level supplied the run gets past it and stops at the next thing a brief carries.
    assert refusal(store, repo, scene.slug, level="A2") == "brief"
    assert refusal(store, repo, scene.slug, level="C1") == "level"


def test_a_narration_scene_is_not_published_down_the_dialogue_path(approved: Any) -> None:
    _http, store, repo, scene, _digest = approved
    store.delete_scene(store.get_scene_by_slug(scene.slug)[0].id)  # type: ignore[index]
    narration = fixture_scene(
        kind="narration",
        cast=[CastMember(role="narrator", voice=VoiceSpec(engine="fake", voice="Vivian", seed=1))],
        script=[Utterance(id="p1", role="narrator", display_text="Ein kurzer Text.")],
        timeline=[SpeechEntry(utterance_id="p1")],
    )
    store.create_scene(narration, None)
    assert refusal(store, repo, narration.slug) == "kind"


def test_a_transcript_that_contradicts_a_committed_exercise_item_is_refused(approved: Any) -> None:
    """`bun run validate` holds an item's `source.turns` equal to its recording's transcript.

    Broken here rather than there: publishing a scene whose script moved after the exercise was
    written leaves a corpus that no longer validates, and the artifact record is the half that
    moved. Refused rather than fixed, because rewriting a committed item to match a new take is an
    editorial decision no publisher may make silently.
    """

    _http, store, repo, scene, _digest = approved
    (repo / "content" / "exercises" / "a2" / "fixture-hoeren.yaml").write_text(
        "topic: essen-trinken\n"
        "role: practice\n"
        "items:\n"
        "  - id: fixture-1\n"
        "    type: audio-comprehension\n"
        "    recording: fixture-cafe\n"
        "    source:\n"
        "      kind: tts\n"
        "      turns:\n"
        "        - speaker: Mara\n"
        "          text: Ein ganz anderer Satz.\n"
    )
    assert refusal(store, repo, scene.slug) == "exercise-turns"


# -- P28-7: the consent scope gate --------------------------------------------


def cloned_fixture(tmp_path: Path, *, scope: str) -> Any:
    """A scene approved on a consented clone, and the store row behind it.

    The consent *document* is not parsed here — `test_voices.py` owns those rules. What this file
    owns is what the publisher does with a row that already exists, so the row is created directly
    and its reference bytes are written where `resolve_voices` looks for them.
    """

    store = Store(tmp_path / "db.sqlite3")
    repo = fixture_repo(tmp_path)
    audio = b"RIFF-not-really-a-wav-but-content-addressed"
    reference_sha = hashlib.sha256(audio).hexdigest()
    reference_path(store.root, reference_sha).parent.mkdir(parents=True, exist_ok=True)
    reference_path(store.root, reference_sha).write_bytes(audio)
    store.create_voice(
        voice_id="testperson",
        reference_sha256=reference_sha,
        reference_text="Guten Tag, ich lese diesen Satz als Referenz.",
        subject_display_name="Testperson",
        scope=scope,
        consent_sha256=CONSENT_SHA,
        guardian_consent=False,
        child_assent=False,
        retention="bis zum Widerruf",
        engine="fake_clone",
        model_revision=FakeClone.revision,
        x_vector_only=False,
    )
    scene = fixture_scene(
        cast=[
            CastMember(
                role="Mara",
                voice=VoiceSpec(
                    engine="fake_clone", voice="Testperson", seed=101, voice_ref="testperson"
                ),
            ),
            CastMember(
                role="Jonas",
                voice=VoiceSpec(
                    engine="fake_clone", voice="Testperson", seed=102, voice_ref="testperson"
                ),
            ),
        ]
    )
    http = TestClient(
        app(
            store,
            repo,
            token="test",
            allow_test_adapters=True,
            transcribe_fn=transcript_of(scene),
        ),
        raise_server_exceptions=False,
    )
    approve(http, store, scene)
    return store, repo, scene


def test_a_publication_scope_clone_publishes_and_states_its_consent(tmp_path: Path) -> None:
    """The claims are `bool(render.voices)` and its consent digests — not a constant, not a flag."""

    store, repo, scene = cloned_fixture(tmp_path, scope="publication")
    plan, _written = publish_scene(store, repo, scene.slug)
    assert plan.manifest["claims"] == {
        "model_license_is_training_data_provenance": False,
        "voice_cloning_used": True,
        "reference_audio_used": True,
        # Sorted and de-duplicated: two roles on one voice is one consent, asked once.
        "consent_sha256": [CONSENT_SHA],
    }
    assert set(plan.manifest["voices"]) == {"Mara", "Jonas"}


def test_an_evaluation_scope_voice_cannot_be_published(tmp_path: Path) -> None:
    """Backlog P28-7. Casting one stays legal; publishing in one does not.

    The scope is read from the **live store row**, not from the render's voices map, so a consent
    downgraded between render and publish refuses — which is also what makes this test possible
    without re-rendering.
    """

    store, repo, scene = cloned_fixture(tmp_path, scope="publication")
    with sqlite3.connect(store.database) as connection:
        connection.execute("UPDATE voice_references SET scope = 'evaluation' WHERE id = 'testperson'")

    gate = refusal(store, repo, scene.slug)
    assert gate == "voice-scope"
    with pytest.raises(PublishRefusal) as error:
        plan_publish(store, repo, scene.slug)
    # The voice and its scope are both named: an editor reading this has to know which row to fix.
    assert "testperson" in error.value.detail and "evaluation" in error.value.detail


def test_a_revoked_voice_cannot_be_published(tmp_path: Path) -> None:
    store, repo, scene = cloned_fixture(tmp_path, scope="publication")
    store.revoke_voice("testperson", "2026-08-21T10:00:00+00:00")
    assert refusal(store, repo, scene.slug) == "voice-revoked"


def test_a_voice_this_studio_does_not_have_cannot_be_published(tmp_path: Path) -> None:
    store, repo, scene = cloned_fixture(tmp_path, scope="publication")
    with sqlite3.connect(store.database) as connection:
        connection.execute("DELETE FROM voice_references WHERE id = 'testperson'")
    assert refusal(store, repo, scene.slug) == "voice-unknown"


# -- atomicity ----------------------------------------------------------------


def test_a_failed_write_leaves_the_repository_exactly_as_it_was(
    approved: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Stage all, then rename; roll back on the way out. Watched failing rather than assumed.

    Two runs, because the rollback has two branches and only one of them is the interesting one. A
    first publish rolls back to *nothing*; a replacement rolls back to the **previous bytes**, which
    is the branch that needs the backup directory to have been written first.
    """

    _http, store, repo, scene, _digest = approved
    plan = plan_publish(store, repo, scene.slug)
    real_replace = Path.replace
    calls = {"n": 0}

    def flaky(self: Path, target: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 4:
            raise OSError("no space left on device")
        return real_replace(self, target)

    monkeypatch.setattr(Path, "replace", flaky)
    with pytest.raises(OSError):
        write_publish(plan, repo)
    # No **file** survives. The empty level directory does, and deliberately: git tracks files,
    # `bun run validate` walks for `*.yaml`, and removing a directory the publisher may not have
    # created is a way to delete somebody else's empty folder.
    for target in plan.targets.all():
        assert not (repo / target).exists(), target
    assert list((repo / "data" / "prompts").iterdir()) == []
    # And the staging directory is not left behind for the next `bun run validate` to trip over.
    assert not (repo / ".atlas-publish-staging").exists()

    # Now with something already there: the previous bytes must come back.
    monkeypatch.setattr(Path, "replace", real_replace)
    write_publish(plan, repo)
    before = {
        path: (repo / path).read_bytes() for path in plan.targets.all()
    }
    (repo / plan.targets.artifact).write_text("id: von-hand-geaendert\n")
    calls["n"] = 0
    monkeypatch.setattr(Path, "replace", flaky)
    with pytest.raises(OSError):
        write_publish(plan, repo, backup_root=store.root / "replaced" / "one")
    monkeypatch.setattr(Path, "replace", real_replace)
    assert (repo / plan.targets.artifact).read_text() == "id: von-hand-geaendert\n"
    for path, body in before.items():
        if path != plan.targets.artifact:
            assert (repo / path).read_bytes() == body


def test_replacing_a_published_artifact_needs_somewhere_to_put_the_old_one(approved: Any) -> None:
    _http, store, repo, scene, _digest = approved
    plan = plan_publish(store, repo, scene.slug)
    write_publish(plan, repo)
    (repo / plan.targets.artifact).write_text("id: von-hand-geaendert\n")
    replacement = plan_publish(store, repo, scene.slug)
    assert plan.targets.artifact in replacement.replaces
    with pytest.raises(PublishRefusal) as error:
        write_publish(replacement, repo)
    assert error.value.gate == "backup"
    backup = store.root / "replaced" / "two"
    write_publish(replacement, repo, backup_root=backup)
    assert (backup / plan.targets.artifact).read_text() == "id: von-hand-geaendert\n"


# -- the registry's stale signal ----------------------------------------------


def test_stale_lights_up_once_the_manifest_carries_a_scene_sha(approved: Any) -> None:
    """`api.registry._published_revision` starts comparing when a manifest names a scene.

    Before this publisher existed the comparison was unreachable for a scene project: every
    manifest in the corpus was written by the dialogue publisher and carries `revision_sha256`, a
    hash of a different document, so the registry deliberately compared nothing. `scene_sha256` is
    what turns it on — and turning it on is only correct if a *just published* scene reads
    `published`, which is the first half of this test.
    """

    http, store, repo, scene, _digest = approved
    publish_scene(store, repo, scene.slug)

    row = next(row for row in registry(store, repo)["rows"] if row["id"] == "fixture-cafe")
    assert row["status"] == "published"
    assert row["project"]["kind"] == "scene"

    # One edit to the script — new bytes, new sha, and the published manifest still names the old
    # one. That disagreement is invisible to any file-only derivation: both files are there and
    # both are internally consistent.
    revised = scene.model_copy(
        update={
            "script": [
                scene.script[0].model_copy(update={"display_text": "Guten Tag, einen Tee bitte."}),
                *scene.script[1:],
            ]
        }
    )
    stored = store.get_scene_by_slug(scene.slug)
    assert stored is not None
    store.revise_scene(stored[0].id, revised)

    row = next(row for row in registry(store, repo)["rows"] if row["id"] == "fixture-cafe")
    assert row["status"] == "stale"
    assert http.get(f"/api/scenes/{scene.slug}", headers=AUTH).json()["stage"] == str(Stage.DRAFT)
