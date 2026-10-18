from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def _config(database: Path) -> Config:
    root = Path(__file__).parents[1]
    config = Config(root / "alembic.ini")
    config.set_main_option("script_location", str(root / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}")
    return config


def test_migrate_empty_database(tmp_path: Path) -> None:
    database = tmp_path / "migrated.sqlite3"
    command.upgrade(_config(database), "head")
    assert set(inspect(create_engine(f"sqlite:///{database}")).get_table_names()) >= {
        "projects",
        "revisions",
        "reading_projects",
        "reading_revisions",
        "scene_projects",
        "scene_revisions",
        "voice_references",
    }


def test_downgrade_returns_to_the_pre_scene_schema(tmp_path: Path) -> None:
    """A migration that cannot be undone is a migration nobody dares to run twice."""

    database = tmp_path / "reversible.sqlite3"
    config = _config(database)
    command.upgrade(config, "head")
    command.downgrade(config, "0001")
    engine = create_engine(f"sqlite:///{database}")
    tables = set(inspect(engine).get_table_names())
    assert {"projects", "revisions"} <= tables
    assert not tables & {
        "scene_projects",
        "scene_revisions",
        "reading_projects",
        "voice_references",
    }
    with engine.connect() as connection:
        assert connection.execute(text("select version_num from alembic_version")).scalar() == "0001"


def test_the_voice_reference_table_is_additive_and_reversible(tmp_path: Path) -> None:
    """0004 touches nothing that already exists, and 0003 is a place you can get back to.

    The columns are asserted by name because two of them carry a policy rather than a value:
    `revoked_at` is why a withdrawal is a date and not a delete, and `reference_text` is what a
    clone conditions on — a table missing either is a table that compiles and cannot do the job.
    """

    database = tmp_path / "voices.sqlite3"
    config = _config(database)
    command.upgrade(config, "0003")
    engine = create_engine(f"sqlite:///{database}")
    assert "voice_references" not in set(inspect(engine).get_table_names())

    command.upgrade(config, "0004")
    inspector = inspect(create_engine(f"sqlite:///{database}"))
    columns = {row["name"] for row in inspector.get_columns("voice_references")}
    assert columns == {
        "id",
        "reference_sha256",
        "reference_text",
        "subject_display_name",
        "scope",
        "consent_sha256",
        "guardian_consent",
        "child_assent",
        "retention",
        "engine",
        "model_revision",
        "x_vector_only",
        "created_at",
        "revoked_at",
    }
    # The reference audio is not a column and must never become one.
    assert not any(name.endswith(("_audio", "_bytes", "_blob")) for name in columns)

    command.downgrade(config, "0003")
    assert "voice_references" not in set(
        inspect(create_engine(f"sqlite:///{database}")).get_table_names()
    )
