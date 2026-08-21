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
    assert not tables & {"scene_projects", "scene_revisions", "reading_projects"}
    with engine.connect() as connection:
        assert connection.execute(text("select version_num from alembic_version")).scalar() == "0001"
