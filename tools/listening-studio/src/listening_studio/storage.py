from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from platformdirs import user_data_path
from sqlalchemy import ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

from .domain import RevisionPayload, Stage


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


def app_dir() -> Path:
    path = Path(user_data_path("Deutsch-Atlas/Listening Studio", "Vitaly Vorobyev"))
    path.mkdir(parents=True, exist_ok=True)
    return path


class Store:
    def __init__(self, database: Path | None = None):
        self.root = database.parent if database else app_dir()
        self.root.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(f"sqlite:///{database or self.root / 'studio.sqlite3'}")
        Base.metadata.create_all(self.engine)

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
        if allowed.get(expected) != target:
            raise ValueError(f"invalid workflow transition {expected} -> {target}")
        with Session(self.engine) as session:
            project = session.get(Project, project_id)
            if not project or Stage(project.stage) != expected:
                raise ValueError(f"expected {expected}")
            revision = session.get(Revision, project.current_revision_id)
            assert revision
            if qa is not None:
                revision.qa_json = json.dumps(qa, ensure_ascii=False, sort_keys=True)
            if approval is not None:
                revision.approval_json = json.dumps(approval, ensure_ascii=False, sort_keys=True)
            project.stage = target
            session.commit()
