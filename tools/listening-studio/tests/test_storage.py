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
