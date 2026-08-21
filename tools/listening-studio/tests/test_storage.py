from pathlib import Path

from listening_studio.domain import Stage
from listening_studio.storage import Store
from test_domain import payload


def test_workflow_and_revision_invalidation(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    project = store.create("sample", payload())
    store.transition(project.id, Stage.DRAFT, Stage.VALIDATED)
    revised = payload().model_copy(deep=True)
    revised.lines[0].display_text = "Ein neuer Termin."
    store.revise(project.id, revised)
    current, revision, _ = store.get(project.id)
    assert current.stage == Stage.DRAFT and revision.number == 2 and revision.approval_json is None


def test_database_backup_is_complete_and_never_overwrites(tmp_path: Path) -> None:
    store = Store(tmp_path / "db.sqlite3")
    original = store.create("sample", payload())
    backup_path = store.backup_database(tmp_path / "backups" / "before.sqlite3")
    copy = Store(backup_path)
    copied, _, _ = copy.get(original.id)
    assert copied.slug == "sample"
    try:
        store.backup_database(backup_path)
    except FileExistsError:
        pass
    else:  # pragma: no cover - safety regression only
        raise AssertionError("backup unexpectedly overwrote an existing file")
