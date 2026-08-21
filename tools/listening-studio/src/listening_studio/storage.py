from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from platformdirs import user_data_path
from sqlalchemy import ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

from .domain import RevisionPayload, Stage
from .reading_audio import ReadingProjectState, ReadingRevisionPayload


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    stage: Mapped[str] = mapped_column(String(40), default=Stage.DRAFT)
    current_revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("revisions.id"), nullable=True
    )
    created_at: Mapped[str] = mapped_column(String(40))
    revisions: Mapped[list[Revision]] = relationship(
        back_populates="project", foreign_keys="Revision.project_id"
    )


class Revision(Base):
    __tablename__ = "revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    number: Mapped[int] = mapped_column(Integer)
    payload_json: Mapped[str] = mapped_column(Text)
    payload_sha256: Mapped[str] = mapped_column(String(64))
    qa_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))
    project: Mapped[Project] = relationship(back_populates="revisions", foreign_keys=[project_id])


class ReadingProject(Base):
    __tablename__ = "reading_projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    reading_id: Mapped[str] = mapped_column(String(160), unique=True)
    stage: Mapped[str] = mapped_column(String(40), default=Stage.DRAFT)
    current_revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("reading_revisions.id"), nullable=True
    )
    created_at: Mapped[str] = mapped_column(String(40))


class ReadingRevision(Base):
    __tablename__ = "reading_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("reading_projects.id"))
    number: Mapped[int] = mapped_column(Integer)
    payload_json: Mapped[str] = mapped_column(Text)
    payload_sha256: Mapped[str] = mapped_column(String(64))
    qa_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


def app_dir() -> Path:
    path = Path(user_data_path("Deutsch-Atlas/Listening Studio", "Vitaly Vorobyev"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def remembered_editor(root: Path) -> str | None:
    """Who signs off here, asked once.

    Retyping a name before every approval is not identity checking — it is the part of the form
    a reviewer learns to type without reading, next to the boxes they learn to tick without
    listening. The name is the provenance record; the listening is the review. Keep them apart.
    """

    name = (root / "editor.txt")
    return name.read_text().strip() or None if name.exists() else None


def remember_editor(root: Path, editor: str) -> None:
    (root / "editor.txt").write_text(editor.strip())


class Store:
    def __init__(self, database: Path | None = None):
        self.root = database.parent if database else app_dir()
        self.root.mkdir(parents=True, exist_ok=True)
        self.database = database or self.root / "studio.sqlite3"
        self.engine = create_engine(f"sqlite:///{self.database}")
        Base.metadata.create_all(self.engine)

    def backup_database(self, target: Path) -> Path:
        """Create a consistent SQLite backup without copying a live WAL piecemeal."""

        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise FileExistsError(target)
        with sqlite3.connect(self.database) as source, sqlite3.connect(target) as destination:
            source.backup(destination)
        return target

    def create(self, slug: str, payload: RevisionPayload) -> Project:
        now = datetime.now(UTC).isoformat()
        with Session(self.engine) as session:
            project = Project(slug=slug, stage=Stage.DRAFT, created_at=now)
            session.add(project)
            session.flush()
            revision = Revision(
                project_id=project.id,
                number=1,
                payload_json=payload.canonical_json(),
                payload_sha256=payload.sha256(),
                created_at=now,
            )
            session.add(revision)
            session.flush()
            project.current_revision_id = revision.id
            session.commit()
            session.refresh(project)
            return project

    def create_reading(self, payload: ReadingRevisionPayload) -> ReadingProject:
        now = datetime.now(UTC).isoformat()
        canonical = payload.model_dump_json()
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        with Session(self.engine) as session:
            existing = session.scalar(
                select(ReadingProject).where(ReadingProject.reading_id == payload.reading_id)
            )
            if existing:
                raise ValueError(f"reading project {payload.reading_id} already exists")
            project = ReadingProject(
                reading_id=payload.reading_id, stage=Stage.DRAFT, created_at=now
            )
            session.add(project)
            session.flush()
            revision = ReadingRevision(
                project_id=project.id,
                number=1,
                payload_json=canonical,
                payload_sha256=digest,
                created_at=now,
            )
            session.add(revision)
            session.flush()
            project.current_revision_id = revision.id
            session.commit()
            session.refresh(project)
            session.expunge(project)
            return project

    def reading_projects(self) -> list[ReadingProject]:
        with Session(self.engine) as session:
            projects = list(session.scalars(select(ReadingProject).order_by(ReadingProject.id)))
            for project in projects:
                session.expunge(project)
            return projects

    def get_reading(
        self, project_id: int
    ) -> tuple[ReadingProject, ReadingRevision, ReadingRevisionPayload]:
        with Session(self.engine) as session:
            project = session.get(ReadingProject, project_id)
            if not project or not project.current_revision_id:
                raise KeyError(project_id)
            revision = session.get(ReadingRevision, project.current_revision_id)
            assert revision
            payload = ReadingRevisionPayload.model_validate_json(revision.payload_json)
            session.expunge(project)
            session.expunge(revision)
            return project, revision, payload

    def get_reading_by_source(
        self, reading_id: str
    ) -> tuple[ReadingProject, ReadingRevision, ReadingRevisionPayload] | None:
        with Session(self.engine) as session:
            project = session.scalar(
                select(ReadingProject).where(ReadingProject.reading_id == reading_id)
            )
            if not project or not project.current_revision_id:
                return None
            revision = session.get(ReadingRevision, project.current_revision_id)
            assert revision
            payload = ReadingRevisionPayload.model_validate_json(revision.payload_json)
            session.expunge(project)
            session.expunge(revision)
            return project, revision, payload

    def revise_reading(
        self, project_id: int, payload: ReadingRevisionPayload
    ) -> ReadingRevision:
        project, current, _ = self.get_reading(project_id)
        if project.reading_id != payload.reading_id:
            raise ValueError("a reading revision cannot change its source identity")
        now = datetime.now(UTC).isoformat()
        canonical = payload.model_dump_json()
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        with Session(self.engine) as session:
            revision = ReadingRevision(
                project_id=project_id,
                number=current.number + 1,
                payload_json=canonical,
                payload_sha256=digest,
                created_at=now,
            )
            session.add(revision)
            session.flush()
            stored = session.get(ReadingProject, project_id)
            assert stored
            stored.current_revision_id = revision.id
            stored.stage = Stage.DRAFT
            session.commit()
            session.refresh(revision)
            session.expunge(revision)
            return revision

    def reading_state(self, project_id: int) -> ReadingProjectState:
        project, revision, payload = self.get_reading(project_id)
        return ReadingProjectState(
            reading_id=project.reading_id,
            stage=Stage(project.stage),
            revision=revision.number,
            payload=payload,
            qa=json.loads(revision.qa_json) if revision.qa_json else None,
            approval=json.loads(revision.approval_json) if revision.approval_json else None,
        )

    def reading_history(self, project_id: int) -> list[dict[str, object]]:
        with Session(self.engine) as session:
            revisions = list(
                session.scalars(
                    select(ReadingRevision)
                    .where(ReadingRevision.project_id == project_id)
                    .order_by(ReadingRevision.number.desc())
                )
            )
            return [
                {
                    "number": row.number,
                    "payload_sha256": row.payload_sha256,
                    "created_at": row.created_at,
                    "has_qa": row.qa_json is not None,
                    "has_approval": row.approval_json is not None,
                }
                for row in revisions
            ]

    def update_reading_qa(self, project_id: int, qa: dict[str, object]) -> None:
        """Replace diagnostics for current bytes without manufacturing a workflow transition."""

        with Session(self.engine) as session:
            project = session.get(ReadingProject, project_id)
            if not project or Stage(project.stage) not in {
                Stage.AUTOMATICALLY_CHECKED,
                Stage.HUMAN_APPROVED,
            }:
                raise ValueError("only generated, checked reading bytes can be re-audited")
            revision = session.get(ReadingRevision, project.current_revision_id)
            assert revision
            revision.qa_json = json.dumps(qa, ensure_ascii=False, sort_keys=True)
            # A changed diagnostic cannot silently preserve an approval if the new report fails.
            if qa.get("passed") is not True and project.stage == Stage.HUMAN_APPROVED:
                revision.approval_json = None
                project.stage = Stage.AUTOMATICALLY_CHECKED
            session.commit()

    def transition_reading(
        self,
        project_id: int,
        expected: Stage,
        target: Stage,
        *,
        payload: ReadingRevisionPayload | None = None,
        qa: dict[str, object] | None = None,
        approval: dict[str, object] | None = None,
    ) -> None:
        allowed = {
            Stage.DRAFT: Stage.VALIDATED,
            Stage.VALIDATED: Stage.AUDIO_GENERATED,
            Stage.AUDIO_GENERATED: Stage.AUTOMATICALLY_CHECKED,
            Stage.AUTOMATICALLY_CHECKED: Stage.HUMAN_APPROVED,
            Stage.HUMAN_APPROVED: Stage.EXPORTED,
        }
        if allowed.get(expected) != target:
            raise ValueError(f"invalid reading transition {expected} → {target}")
        with Session(self.engine) as session:
            project = session.get(ReadingProject, project_id)
            if not project or Stage(project.stage) != expected:
                raise ValueError("reading project stage changed while the action was running")
            revision = session.get(ReadingRevision, project.current_revision_id)
            assert revision
            if payload is not None:
                canonical = payload.model_dump_json()
                revision.payload_json = canonical
                revision.payload_sha256 = hashlib.sha256(canonical.encode()).hexdigest()
            if qa is not None:
                revision.qa_json = json.dumps(qa, ensure_ascii=False, sort_keys=True)
            if approval is not None:
                revision.approval_json = json.dumps(approval, ensure_ascii=False, sort_keys=True)
            project.stage = target
            session.commit()

    def projects(self) -> list[Project]:
        with Session(self.engine) as session:
            return list(session.scalars(select(Project).order_by(Project.id.desc())))

    def get(self, project_id: int) -> tuple[Project, Revision, RevisionPayload]:
        with Session(self.engine) as session:
            project = session.get(Project, project_id)
            if not project or not project.current_revision_id:
                raise KeyError(project_id)
            revision = session.get(Revision, project.current_revision_id)
            assert revision
            session.expunge(project)
            session.expunge(revision)
            return project, revision, RevisionPayload.model_validate_json(revision.payload_json)

    def revision_history(self, project_id: int) -> list[dict[str, object]]:
        with Session(self.engine) as session:
            revisions = list(
                session.scalars(
                    select(Revision)
                    .where(Revision.project_id == project_id)
                    .order_by(Revision.number.desc())
                )
            )
            return [
                {
                    "number": row.number,
                    "payload_sha256": row.payload_sha256,
                    "created_at": row.created_at,
                    "has_qa": row.qa_json is not None,
                    "has_approval": row.approval_json is not None,
                }
                for row in revisions
            ]

    def revise(self, project_id: int, payload: RevisionPayload) -> Revision:
        project, current, _ = self.get(project_id)
        now = datetime.now(UTC).isoformat()
        with Session(self.engine) as session:
            revision = Revision(
                project_id=project_id,
                number=current.number + 1,
                payload_json=payload.canonical_json(),
                payload_sha256=payload.sha256(),
                created_at=now,
            )
            session.add(revision)
            session.flush()
            stored = session.get(Project, project_id)
            assert stored
            stored.current_revision_id = revision.id
            stored.stage = Stage.DRAFT
            session.commit()
            session.refresh(revision)
            session.expunge(revision)
            return revision

    def reset_to(self, project_id: int, target: Stage) -> None:
        """Move a project *back* to an earlier stage so a take can be produced again.

        `transition` only ever steps forward, which left a generated take with nothing to do:
        approval refuses a failed QA, and every earlier step is an illegal transition, so the
        only escape was editing the script — which is not what a bad *voice* needs. The
        revision is untouched, so the line cache still covers everything unchanged, and any QA
        or approval attached to the old take is cleared because it described other audio.
        """

        order = list(Stage)
        with Session(self.engine) as session:
            project = session.get(Project, project_id)
            if not project:
                raise ValueError(f"project {project_id} does not exist")
            if order.index(target) >= order.index(Stage(project.stage)):
                raise ValueError(f"{target} is not earlier than {project.stage}")
            revision = session.get(Revision, project.current_revision_id)
            assert revision
            revision.qa_json = None
            revision.approval_json = None
            project.stage = target
            session.commit()

    def transition(
        self,
        project_id: int,
        expected: Stage,
        target: Stage,
        *,
        qa: dict[str, object] | None = None,
        approval: dict[str, object] | None = None,
    ) -> None:
        allowed = {
            Stage.DRAFT: Stage.VALIDATED,
            Stage.VALIDATED: Stage.AUDIO_GENERATED,
            Stage.AUDIO_GENERATED: Stage.AUTOMATICALLY_CHECKED,
            Stage.AUTOMATICALLY_CHECKED: Stage.HUMAN_APPROVED,
            Stage.HUMAN_APPROVED: Stage.EXPORTED,
        }
        # Say what the stage actually is and what may follow it. The old message named only
        # the rejected pair, which in the UI meant a bare 500 on every button that was not the
        # one legal next step — and the legal step is exactly what the editor needed told.
        if allowed.get(expected) != target:
            following = allowed.get(expected)
            raise ValueError(
                f"this project is at {expected}; "
                + (f"the next step is {following}, not {target}" if following else f"{expected} is the final stage")
            )
        with Session(self.engine) as session:
            project = session.get(Project, project_id)
            if not project:
                raise ValueError(f"project {project_id} does not exist")
            if Stage(project.stage) != expected:
                raise ValueError(
                    f"this project moved to {Stage(project.stage)} while the page was open; reload it"
                )
            revision = session.get(Revision, project.current_revision_id)
            assert revision
            if qa is not None:
                revision.qa_json = json.dumps(qa, ensure_ascii=False, sort_keys=True)
            if approval is not None:
                revision.approval_json = json.dumps(approval, ensure_ascii=False, sort_keys=True)
            project.stage = target
            session.commit()
