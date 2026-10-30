import json
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
    tables = set(inspect(create_engine(f"sqlite:///{database}")).get_table_names())
    assert tables >= {"scene_projects", "scene_revisions", "scene_qa_reports", "voice_references"}
    assert not tables & {"projects", "revisions", "reading_projects", "reading_revisions"}


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
        "scene_qa_reports",
        "reading_projects",
        "voice_references",
    }
    with engine.connect() as connection:
        assert connection.execute(text("select version_num from alembic_version")).scalar() == "0001"


def test_a_scene_qa_report_moves_to_the_variant_it_names(tmp_path: Path) -> None:
    """0006 keeps every stored report readable, under the variant it was run on.

    A report naming no variant goes to `natural`, the render default every surface used. The
    downgrade puts one report per revision back, preferring `natural`.
    """

    database = tmp_path / "qa.sqlite3"
    config = _config(database)
    command.upgrade(config, "0005")
    engine = create_engine(f"sqlite:///{database}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "insert into scene_projects (id, slug, kind, stage, created_at) values "
                "(1, 'a', 'dialogue', 'automatically_checked', 't'), "
                "(2, 'b', 'dialogue', 'automatically_checked', 't'), "
                "(3, 'c', 'dialogue', 'draft', 't')"
            )
        )
        connection.execute(
            text(
                "insert into scene_revisions "
                "(id, project_id, number, scene_json, scene_sha256, qa_json, created_at) values "
                "(1, 1, 1, '{}', 'x', :challenging, 'r1'), "
                "(2, 2, 1, '{}', 'y', :unnamed, 'r2'), "
                "(3, 3, 1, '{}', 'z', NULL, 'r3')"
            ),
            {
                "challenging": json.dumps({"passed": False, "variant": "challenging"}),
                "unnamed": json.dumps({"passed": True}),
            },
        )

    command.upgrade(config, "0006")
    inspector = inspect(create_engine(f"sqlite:///{database}"))
    assert "qa_json" not in {row["name"] for row in inspector.get_columns("scene_revisions")}
    with create_engine(f"sqlite:///{database}").connect() as connection:
        rows = connection.execute(
            text("select revision_id, variant, qa_json from scene_qa_reports order by revision_id")
        ).all()
    assert [(row[0], row[1], json.loads(row[2])["passed"]) for row in rows] == [
        (1, "challenging", False),
        (2, "natural", True),
    ]

    command.downgrade(config, "0005")
    with create_engine(f"sqlite:///{database}").connect() as connection:
        restored = connection.execute(
            text("select id, qa_json from scene_revisions order by id")
        ).all()
    assert [(row[0], json.loads(row[1]) if row[1] else None) for row in restored] == [
        (1, {"passed": False, "variant": "challenging"}),
        (2, {"passed": True}),
        (3, None),
    ]


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
