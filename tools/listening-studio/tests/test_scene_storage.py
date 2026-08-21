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
    store.transition_scene(
        project.id, Stage.VALIDATED, Stage.AUDIO_GENERATED, qa={"passed": True}
    )
    stored, revision, _, _ = store.get_scene(project.id)
    assert stored.stage == Stage.AUDIO_GENERATED and revision.qa_json is not None


def test_a_new_store_is_at_alembic_head(tmp_path: Path) -> None:
    database = tmp_path / "db.sqlite3"
    Store(database)
    engine = create_engine(f"sqlite:///{database}")
    assert {"projects", "revisions", "reading_projects", "reading_revisions",
            "scene_projects", "scene_revisions"} <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar() == "0004"


def test_a_pre_alembic_database_is_stamped_rather_than_rebuilt(tmp_path: Path) -> None:
    """The deployed database has the old tables and no `alembic_version`; its rows must survive."""

    database = tmp_path / "legacy.sqlite3"
    legacy = Store(database, migrate=False)  # exactly what `create_all` used to leave behind
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(text("drop table scene_revisions"))
        connection.execute(text("drop table scene_projects"))
        connection.execute(
            text(
                "insert into projects (slug, stage, created_at) "
                "values ('ls-alt-01', 'draft', '2026-01-01T00:00:00+00:00')"
            )
        )
    assert "alembic_version" not in set(inspect(engine).get_table_names())

    upgraded = Store(database)
    assert [project.slug for project in upgraded.projects()] == ["ls-alt-01"]
    assert "scene_projects" in set(inspect(upgraded.engine).get_table_names())
    with upgraded.engine.connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar() == "0004"
    assert legacy.database == upgraded.database
