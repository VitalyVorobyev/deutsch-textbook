"""Scene projects in the store, and the Alembic adoption that made room for them."""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from listening_studio.domain import Bilingual, Question, SingleChoice, Stage
from listening_studio.scene import (
    CastMember,
    ExerciseAttachment,
    Scene,
    SpeechEntry,
    Utterance,
    VoiceSpec,
)
from listening_studio.storage import Store


def a_scene(slug: str = "kiosk-am-morgen") -> Scene:
    return Scene(
        slug=slug,
        kind="dialogue",
        title=Bilingual(en="At the kiosk", ru="У киоска"),
        cast=[
            CastMember(
                role="Mara", voice=VoiceSpec(engine="qwen_tts", voice="Vivian", seed=100)
            )
        ],
        script=[Utterance(id="u1", role="Mara", display_text="Guten Morgen.")],
        timeline=[SpeechEntry(utterance_id="u1")],
    )


def an_attachment() -> ExerciseAttachment:
    return ExerciseAttachment(
        questions=[
            Question(
                id="q1",
                instruction=Bilingual(en="Listen.", ru="Слушайте."),
                response=SingleChoice(
                    kind="single-choice",
                    prompt="Was sagt Mara?",
                    options=["Guten Morgen.", "Gute Nacht."],
                    correct=0,
                ),
                explain=Bilingual(en="She greets.", ru="Она здоровается."),
            )
        ],
        max_replays=2,
    )


def test_create_and_read_back(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    project = store.create_scene(a_scene(), an_attachment())
    found = store.get_scene_by_slug("kiosk-am-morgen")
    assert found is not None
    stored_project, revision, scene, exercise = found
    assert stored_project.id == project.id
    assert stored_project.kind == "dialogue" and stored_project.stage == Stage.DRAFT
    assert revision.number == 1 and revision.scene_sha256 == scene.sha256()
    assert exercise is not None and exercise.max_replays == 2


def test_a_scene_without_questions_is_a_complete_artifact(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    store.create_scene(a_scene())
    found = store.get_scene_by_slug("kiosk-am-morgen")
    assert found is not None and found[3] is None


def test_one_slug_only(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    store.create_scene(a_scene())
    with pytest.raises(ValueError, match="already exists"):
        store.create_scene(a_scene())


def test_revising_appends_and_returns_to_draft(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    project = store.create_scene(a_scene())
    store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
    revised = a_scene().model_copy(
        update={"script": [Utterance(id="u1", role="Mara", display_text="Guten Abend.")]}
    )
    revision = store.revise_scene(project.id, revised)
    assert revision.number == 2
    stored, head, scene, _ = store.get_scene(project.id)
    assert stored.stage == Stage.DRAFT and head.number == 2
    assert scene.script[0].display_text == "Guten Abend."
    assert [row["number"] for row in store.scene_history(project.id)] == [2, 1]


def test_a_revision_may_not_rename_the_project(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    project = store.create_scene(a_scene())
    with pytest.raises(ValueError, match="cannot change its slug"):
        store.revise_scene(project.id, a_scene("anderer-kiosk"))


def test_transitions_follow_the_one_stage_machine(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    project = store.create_scene(a_scene())
    with pytest.raises(ValueError, match="the next step is validated"):
        store.transition_scene(project.id, Stage.DRAFT, Stage.HUMAN_APPROVED)
    store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
    store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
    stored, _, _, _ = store.get_scene(project.id)
    assert stored.stage == Stage.AUDIO_GENERATED


def test_a_qa_report_belongs_to_the_variant_it_measured(tmp_path: Path) -> None:
    """One report per (revision, variant): checking one variant never hides or blocks another.

    Watched failing with every report stored under one key: the `challenging` report answered for
    `natural`.
    """

    store = Store(tmp_path / "db.sqlite3")
    project = store.create_scene(a_scene())
    with pytest.raises(ValueError, match="QA runs on audio_generated"):
        store.record_scene_qa(project.id, "natural", {"passed": True})
    store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
    store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)

    assert store.record_scene_qa(project.id, "challenging", {"passed": False, "variant": "challenging"}) == Stage.AUTOMATICALLY_CHECKED
    # A second variant is checked at `automatically_checked`, without a transition.
    store.record_scene_qa(project.id, "natural", {"passed": True, "variant": "natural"})
    _, revision, _, _ = store.get_scene(project.id)
    assert store.scene_qa_report(revision.id, "natural") == {"passed": True, "variant": "natural"}
    assert store.scene_qa_report(revision.id, "challenging") == {
        "passed": False,
        "variant": "challenging",
    }
    assert store.scene_qa_report(revision.id, "clean") is None
    assert store.scene_qa_verdicts("natural") == {revision.id: True}
    assert store.scene_history(project.id)[0]["qa_variants"] == ["challenging", "natural"]

    # Measuring the same variant again replaces its report and nothing else.
    store.record_scene_qa(project.id, "natural", {"passed": False, "variant": "natural"})
    assert set(store.scene_qa_reports(revision.id)) == {"challenging", "natural"}
    assert store.scene_qa_verdicts("natural") == {revision.id: False}

    # A new revision is new bytes and starts with no report at all.
    revised = store.revise_scene(project.id, a_scene())
    assert store.scene_qa_reports(revised.id) == {}

    # Past `automatically_checked` a report would sit under a signature nobody re-gave.
    store.transition_scene(project.id, Stage.DRAFT, Stage.VALIDATED)
    store.transition_scene(project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED)
    store.record_scene_qa(project.id, "natural", {"passed": True})
    store.transition_scene(project.id, Stage.AUTOMATICALLY_CHECKED, Stage.HUMAN_APPROVED)
    with pytest.raises(ValueError, match="human_approved"):
        store.record_scene_qa(project.id, "natural", {"passed": True})


def test_a_new_store_is_at_alembic_head(tmp_path: Path) -> None:
    database = tmp_path / "db.sqlite3"
    Store(database)
    engine = create_engine(f"sqlite:///{database}")
    tables = set(inspect(engine).get_table_names())
    assert {"scene_projects", "scene_revisions", "scene_qa_reports", "voice_references"} <= tables
    assert not tables & {"projects", "revisions", "reading_projects", "reading_revisions"}
    with engine.connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar() == "0006"


#: What `Base.metadata.create_all` left behind before Alembic: the pre-scene project tables and no
#: `alembic_version`. Written out, because the ORM no longer declares them.
PRE_ALEMBIC_SCHEMA = (
    "create table revisions (id integer primary key, project_id integer not null, "
    "number integer not null, payload_json text not null, payload_sha256 varchar(64) not null, "
    "qa_json text, approval_json text, created_at varchar(40) not null)",
    "create table projects (id integer primary key, slug varchar(120) not null unique, "
    "stage varchar(40) not null, current_revision_id integer references revisions(id), "
    "created_at varchar(40) not null)",
    "create table reading_revisions (id integer primary key, project_id integer not null, "
    "number integer not null, payload_json text not null, payload_sha256 varchar(64) not null, "
    "qa_json text, approval_json text, created_at varchar(40) not null)",
    "create table reading_projects (id integer primary key, reading_id varchar(160) not null "
    "unique, stage varchar(40) not null, current_revision_id integer, "
    "created_at varchar(40) not null)",
)


def _pre_alembic(database: Path) -> None:
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        for statement in PRE_ALEMBIC_SCHEMA:
            connection.execute(text(statement))


def test_an_empty_pre_alembic_database_is_stamped_and_brought_to_head(tmp_path: Path) -> None:
    database = tmp_path / "legacy.sqlite3"
    _pre_alembic(database)

    upgraded = Store(database)
    tables = set(inspect(upgraded.engine).get_table_names())
    assert {"scene_projects", "scene_qa_reports", "voice_references"} <= tables
    assert "projects" not in tables and "reading_projects" not in tables
    with upgraded.engine.connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar() == "0006"


def test_a_pre_scene_project_row_stops_the_upgrade_and_survives_it(tmp_path: Path) -> None:
    """An immutable revision is authored German; a schema change may not be what deletes it."""

    database = tmp_path / "legacy.sqlite3"
    _pre_alembic(database)
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "insert into projects (slug, stage, created_at) "
                "values ('ls-alt-01', 'draft', '2026-01-01T00:00:00+00:00')"
            )
        )

    with pytest.raises(RuntimeError, match=r"still hold rows \(projects: 1\)"):
        Store(database)
    with engine.connect() as connection:
        assert connection.execute(text("select slug from projects")).scalars().all() == [
            "ls-alt-01"
        ]
