from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_migrate_empty_database(tmp_path: Path) -> None:
    root = Path(__file__).parents[1]
    database = tmp_path / "migrated.sqlite3"
    config = Config(root / "alembic.ini")
    config.set_main_option("script_location", str(root / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}")
    command.upgrade(config, "head")
    assert set(inspect(create_engine(f"sqlite:///{database}")).get_table_names()) >= {
        "projects",
        "revisions",
    }
