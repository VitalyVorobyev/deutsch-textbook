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
