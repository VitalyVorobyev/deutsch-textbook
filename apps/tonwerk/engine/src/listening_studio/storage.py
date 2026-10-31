from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from platformdirs import user_data_path
from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from .domain import Stage
from .scene import ExerciseAttachment, Scene


#: The one stage machine a scene project steps through, as the stages each one may step to. A
#: scene that passed automatic QA may be published straight away or first approved by a person
#: (ADR 0013); the approval is optional and the publisher checks it when it exists.
STAGE_TRANSITIONS: dict[Stage, tuple[Stage, ...]] = {
    Stage.DRAFT: (Stage.VALIDATED,),
    Stage.VALIDATED: (Stage.AUDIO_GENERATED,),
    Stage.AUDIO_GENERATED: (Stage.AUTOMATICALLY_CHECKED,),
    Stage.AUTOMATICALLY_CHECKED: (Stage.HUMAN_APPROVED, Stage.EXPORTED),
    Stage.HUMAN_APPROVED: (Stage.EXPORTED,),
}


class Base(DeclarativeBase):
    pass


class SceneProject(Base):
    """A scene under editorial work: one slug, one head revision, one stage."""

    __tablename__ = "scene_projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    kind: Mapped[str] = mapped_column(String(20))
    stage: Mapped[str] = mapped_column(String(40), default=Stage.DRAFT)
    current_revision_id: Mapped[int | None] = mapped_column(
        ForeignKey("scene_revisions.id"), nullable=True
    )
    created_at: Mapped[str] = mapped_column(String(40))
    #: Out of the library's default view and the review queue. Not a deletion: see `archive_scene`.
    archived_at: Mapped[str | None] = mapped_column(String(40), nullable=True, default=None)
    #: `<slug>@<revision>` of the take a fork was copied from, or None for an original.
    forked_from: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)


class SceneRevision(Base):
    """Immutable bytes. A scene is never edited in place; a new revision is appended.

    `exercise_json` is nullable and separately stored rather than folded into `scene_json`,
    because a question edit must not change `scene_sha256` — an approval vouches for audio, and
    audio does not change when a distractor is rewritten.
    """

    __tablename__ = "scene_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("scene_projects.id"))
    number: Mapped[int] = mapped_column(Integer)
    scene_json: Mapped[str] = mapped_column(Text)
    scene_sha256: Mapped[str] = mapped_column(String(64))
    exercise_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class SceneQAReport(Base):
    """The machine's report on one render: one revision, **one variant**.

    Keyed by variant because a render is: `renders/<scene sha>/<variant>/` holds one master per
    variant, and a report stored per revision would answer "did the challenging mix pass" with the
    natural mix's numbers, or lock the natural mix out of QA because another variant was checked
    first.
    """

    __tablename__ = "scene_qa_reports"
    revision_id: Mapped[int] = mapped_column(ForeignKey("scene_revisions.id"), primary_key=True)
    variant: Mapped[str] = mapped_column(String(60), primary_key=True)
    qa_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40))


class VoiceReference(Base):
    """One consented voice, as a row: who, at what scope, from which bytes, under which document.

    **The reference audio is not in here and never will be.** The row carries its SHA-256; the
    recording itself lives under app-data (`generative.voices.reference_path`), which is also why
    `reference_present` is measured on every read rather than inferred from this table — a database
    that travels without its app-data directory would otherwise report a voice it cannot speak in.

    `reference_text` is a column the brief for this table did not name, and it is load-bearing: the
    clone prompt conditions on what is *said* in the reference unless the voice is in
    `x_vector_only` mode, so a row without it is a voice that can be listed and not synthesized.

    Revocation is `revoked_at`, not a deletion. The row is what a published render's provenance
    points at, and a withdrawn consent has to leave a record saying it was withdrawn — a missing
    row would read as a voice that never existed, which is the opposite of the truth.
    """

    __tablename__ = "voice_references"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    reference_sha256: Mapped[str] = mapped_column(String(64))
    reference_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject_display_name: Mapped[str] = mapped_column(String(200))
    scope: Mapped[str] = mapped_column(String(20))
    consent_sha256: Mapped[str] = mapped_column(String(64))
    guardian_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    child_assent: Mapped[bool] = mapped_column(Boolean, default=False)
    retention: Mapped[str] = mapped_column(Text)
    engine: Mapped[str] = mapped_column(String(60))
    model_revision: Mapped[str] = mapped_column(String(80))
    x_vector_only: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String(40))
    revoked_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


def app_dir() -> Path:
    # The studio's pre-Tonwerk name. It is where every existing database lives, so renaming it
    # would strand the approvals in it.
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


#: The package root, where `alembic.ini` and `migrations/` live. Resolved from this file so the
#: migrations are found whatever directory the CLI was started in.
PACKAGE_ROOT = Path(__file__).resolve().parents[2]

#: The revision a database created by `Base.metadata.create_all` before Alembic corresponds to:
#: it has a `projects` table and no `alembic_version`. Running `upgrade head` against one would try
#: to `CREATE TABLE projects` and fail — so such a database is stamped at this revision first, and
#: the migrations after it are written to be safe on a database that already has their tables.
LEGACY_REVISION = "0001"


def alembic_config(database: Path) -> Config:
    config = Config(PACKAGE_ROOT / "alembic.ini")
    config.set_main_option("script_location", str(PACKAGE_ROOT / "migrations"))
    # Escaped: an absolute path can contain a `%`, and ConfigParser interpolates it.
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database}".replace("%", "%%"))
    return config


class Store:
    def __init__(self, database: Path | None = None, *, migrate: bool = True):
        self.root = database.parent if database else app_dir()
        self.root.mkdir(parents=True, exist_ok=True)
        self.database = database or self.root / "studio.sqlite3"
        self.engine = create_engine(f"sqlite:///{self.database}")
        if migrate:
            self.upgrade()
        else:
            # The one caller that may skip migrations is a throwaway in-memory or fixture
            # database whose only job is to hold rows for the length of one test. Anything that
            # a human will open again goes through Alembic, or the next schema change has no
            # record of what it is changing.
            Base.metadata.create_all(self.engine)

    def upgrade(self) -> None:
        """Bring this database to head, stamping a pre-Alembic one on the way."""

        tables = set(inspect(self.engine).get_table_names())
        config = alembic_config(self.database)
        if "projects" in tables and "alembic_version" not in tables:
            command.stamp(config, LEGACY_REVISION)
        command.upgrade(config, "head")

    # ------------------------------------------------------------------
    # Scene projects
    # ------------------------------------------------------------------

    def create_scene(
        self, scene: Scene, exercise: ExerciseAttachment | None = None
    ) -> SceneProject:
        now = datetime.now(UTC).isoformat()
        with Session(self.engine) as session:
            existing = session.scalar(select(SceneProject).where(SceneProject.slug == scene.slug))
            if existing:
                raise ValueError(f"scene project {scene.slug} already exists")
            project = SceneProject(
                slug=scene.slug, kind=scene.kind, stage=Stage.DRAFT, created_at=now
            )
            session.add(project)
            session.flush()
            revision = SceneRevision(
                project_id=project.id,
                number=1,
                scene_json=scene.canonical_json(),
                scene_sha256=scene.sha256(),
                exercise_json=exercise.canonical_json() if exercise else None,
                created_at=now,
            )
            session.add(revision)
            session.flush()
            project.current_revision_id = revision.id
            session.commit()
            session.refresh(project)
            session.expunge(project)
            return project

    def scene_projects(self) -> list[SceneProject]:
        with Session(self.engine) as session:
            projects = list(session.scalars(select(SceneProject).order_by(SceneProject.id)))
            for project in projects:
                session.expunge(project)
            return projects

    def get_scene(
        self, project_id: int
    ) -> tuple[SceneProject, SceneRevision, Scene, ExerciseAttachment | None]:
        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project or not project.current_revision_id:
                raise KeyError(project_id)
            revision = session.get(SceneRevision, project.current_revision_id)
            assert revision
            scene = Scene.model_validate_json(revision.scene_json)
            exercise = (
                ExerciseAttachment.model_validate_json(revision.exercise_json)
                if revision.exercise_json
                else None
            )
            session.expunge(project)
            session.expunge(revision)
            return project, revision, scene, exercise

    def get_scene_by_slug(
        self, slug: str
    ) -> tuple[SceneProject, SceneRevision, Scene, ExerciseAttachment | None] | None:
        with Session(self.engine) as session:
            project = session.scalar(select(SceneProject).where(SceneProject.slug == slug))
            project_id = project.id if project else None
        return self.get_scene(project_id) if project_id is not None else None

    def scene_rows(self) -> list[tuple[SceneProject, SceneRevision]]:
        """Every scene project with its head revision, in **one** query.

        One statement rather than `scene_projects()` and then `get_scene()` per row — one per project
        is invisible at eleven scenes and a hundred-and-thirty statements per page load once the
        corpus converts. The join is on
        `current_revision_id`, so a project whose head is missing is simply absent rather than
        raising: that state means a half-written creation, and a list view must render the other
        rows.

        The scene *document* is returned as stored bytes and deliberately not validated here. A
        list needs a title, a level and a narration profile; running `Scene.model_validate_json`
        over 130 documents to read three fields costs the other half of the same page load, and it
        makes one document written by a newer build fail the **whole** list rather than one row.
        """

        with Session(self.engine) as session:
            rows = list(
                session.execute(
                    select(SceneProject, SceneRevision)
                    .join(SceneRevision, SceneProject.current_revision_id == SceneRevision.id)
                    .order_by(SceneProject.id)
                ).all()
            )
            found: list[tuple[SceneProject, SceneRevision]] = []
            for project, revision in rows:
                session.expunge(project)
                session.expunge(revision)
                found.append((project, revision))
            return found

    def delete_scene(self, project_id: int) -> None:
        """Remove one scene project and its revisions. **The caller owns the policy.**

        Deliberately unconditional here and gated at both surfaces (`scene.publish`'s siblings in
        `scene/cli.py` and `DELETE /api/scenes/{slug}`), for the reason every other method in this
        class is written the same way: the store is the record, and a store that enforced "draft,
        revision 1, never published" would be a second place for that rule to be stated and a
        second place for it to drift from the first. What the store *does* guarantee is that a
        deletion is whole — the revisions and their QA reports go with the project, so nothing is
        left pointing at a row that is not there.

        Nothing outside the database is touched. Renders live under `renders/<scene sha>/` and are
        shared by every revision that hashes to those bytes, so deleting them here would remove
        audio another project may still be reviewing; `renders/` has its own reaper question.
        """

        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project:
                raise ValueError(f"scene project {project_id} does not exist")
            # The project's own pointer first: SQLite enforces the FK from `scene_projects` to
            # `scene_revisions`, so deleting the head revision under a live pointer fails.
            project.current_revision_id = None
            session.flush()
            for revision in session.scalars(
                select(SceneRevision).where(SceneRevision.project_id == project_id)
            ):
                for report in session.scalars(
                    select(SceneQAReport).where(SceneQAReport.revision_id == revision.id)
                ):
                    session.delete(report)
                session.delete(revision)
            session.delete(project)
            session.commit()

    def archive_scene(self, project_id: int, archived: bool) -> SceneProject:
        """Put a project out of sight, or back. Nothing else about it changes.

        Archiving is the library's answer to "I no longer want to see this", and deliberately
        not a deletion: a project with revisions has a history that a provenance manifest, an
        approval or a fork may point at, and only `delete_scene`'s narrow undo may remove one.
        """

        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project:
                raise ValueError(f"scene project {project_id} does not exist")
            project.archived_at = datetime.now(UTC).isoformat() if archived else None
            session.commit()
            session.refresh(project)
            session.expunge(project)
            return project

    def fork_scene(self, project_id: int, slug: str) -> SceneProject:
        """A new project at revision 1, from the head revision of another.

        The copy is a draft whatever stage its origin had reached: an approval vouches for one
        project's audio, and a fork is a different scene from the moment it has a different slug.
        The exercise attachment comes along, since a variant of a take is asked the same
        questions until someone edits them.
        """

        origin, revision, scene, exercise = self.get_scene(project_id)
        project = self.create_scene(scene.model_copy(update={"slug": slug}), exercise)
        with Session(self.engine) as session:
            stored = session.get(SceneProject, project.id)
            assert stored
            stored.forked_from = f"{origin.slug}@{revision.number}"
            session.commit()
            session.refresh(stored)
            session.expunge(stored)
            return stored

    def revise_scene(
        self, project_id: int, scene: Scene, exercise: ExerciseAttachment | None = None
    ) -> SceneRevision:
        project, current, _, _ = self.get_scene(project_id)
        if project.slug != scene.slug:
            raise ValueError("a scene revision cannot change its slug")
        now = datetime.now(UTC).isoformat()
        with Session(self.engine) as session:
            revision = SceneRevision(
                project_id=project_id,
                number=current.number + 1,
                scene_json=scene.canonical_json(),
                scene_sha256=scene.sha256(),
                exercise_json=exercise.canonical_json() if exercise else None,
                created_at=now,
            )
            session.add(revision)
            session.flush()
            stored = session.get(SceneProject, project_id)
            assert stored
            stored.current_revision_id = revision.id
            # New bytes, so any QA or approval attached to the previous revision describes other
            # audio. QA reports are keyed by revision, so the new one starts with none.
            stored.stage = Stage.DRAFT
            session.commit()
            session.refresh(revision)
            session.expunge(revision)
            return revision

    def revision_index(self) -> list[tuple[int, int, str, bool]]:
        """Every revision as `(project id, number, scene sha, signed)`, in one query.

        `signed` is a completed approval. What the render reaper needs to decide which render
        trees still describe a take someone may play, sign or publish.
        """

        with Session(self.engine) as session:
            return [
                (
                    row.project_id,
                    row.number,
                    row.scene_sha256,
                    row.approval_json is not None
                    and json.loads(row.approval_json).get("status") == "complete",
                )
                for row in session.scalars(select(SceneRevision))
            ]

    def scene_history(self, project_id: int) -> list[dict[str, object]]:
        with Session(self.engine) as session:
            revisions = list(
                session.scalars(
                    select(SceneRevision)
                    .where(SceneRevision.project_id == project_id)
                    .order_by(SceneRevision.number.desc())
                )
            )
            return [
                {
                    "number": row.number,
                    "scene_sha256": row.scene_sha256,
                    "created_at": row.created_at,
                    "has_exercise": row.exercise_json is not None,
                    "qa_variants": sorted(
                        session.scalars(
                            select(SceneQAReport.variant).where(
                                SceneQAReport.revision_id == row.id
                            )
                        )
                    ),
                    "has_approval": row.approval_json is not None,
                }
                for row in revisions
            ]

    def decline_scene(self, project_id: int, decline: dict[str, object]) -> None:
        """A human reviewer refusing a take: back to draft, with the reason written down.

        Two decisions worth stating, because neither is obvious.

        **The verdict goes in `approval_json`.** That column is not "the approval"; it is *the
        human verdict on this revision*, and `status` is what distinguishes them — `"complete"`
        for a sign-off, `"declined"` for a refusal. Everything that consumes an approval already
        keys on that value (`scripts/listening-inventory.ts` reads
        `approval.status === 'complete'`), so a declined revision cannot be mistaken for an
        approved one by any existing reader. A separate column would have been a migration and a
        second place for a future reader to forget to look.

        **The QA report stays.** A decline is a statement about the audio, not about the
        machine's measurement of it: the transcripts, the speaker check and the soundscape
        numbers still describe exactly these bytes, and throwing them away would make the
        reviewer's own evidence disappear the moment they acted on it.
        """

        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project:
                raise ValueError(f"scene project {project_id} does not exist")
            revision = session.get(SceneRevision, project.current_revision_id)
            assert revision
            revision.approval_json = json.dumps(decline, ensure_ascii=False, sort_keys=True)
            project.stage = Stage.DRAFT
            session.commit()

    # ------------------------------------------------------------------
    # Consented voice references
    # ------------------------------------------------------------------
    #
    # No revision history and no stage machine, deliberately. A voice reference is not a document
    # under editorial work — it is a **permission**, and a permission that could be revised would
    # be a permission whose current text nobody could name. It is created once from a consent that
    # was checked, and the only thing that ever happens to it afterwards is withdrawal.

    def create_voice(
        self,
        *,
        voice_id: str,
        reference_sha256: str,
        reference_text: str | None,
        subject_display_name: str,
        scope: str,
        consent_sha256: str,
        guardian_consent: bool,
        child_assent: bool,
        retention: str,
        engine: str,
        model_revision: str,
        x_vector_only: bool,
    ) -> VoiceReference:
        now = datetime.now(UTC).isoformat()
        with Session(self.engine) as session:
            if session.get(VoiceReference, voice_id) is not None:
                raise ValueError(f"voice reference {voice_id} already exists")
            row = VoiceReference(
                id=voice_id,
                reference_sha256=reference_sha256,
                reference_text=reference_text,
                subject_display_name=subject_display_name,
                scope=scope,
                consent_sha256=consent_sha256,
                guardian_consent=guardian_consent,
                child_assent=child_assent,
                retention=retention,
                engine=engine,
                model_revision=model_revision,
                x_vector_only=x_vector_only,
                created_at=now,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            session.expunge(row)
            return row

    def voice_references(self) -> list[VoiceReference]:
        with Session(self.engine) as session:
            rows = list(session.scalars(select(VoiceReference).order_by(VoiceReference.id)))
            for row in rows:
                session.expunge(row)
            return rows

    def get_voice(self, voice_id: str) -> VoiceReference | None:
        with Session(self.engine) as session:
            row = session.get(VoiceReference, voice_id)
            if row is None:
                return None
            session.expunge(row)
            return row

    def revoke_voice(self, voice_id: str, revoked_at: str) -> None:
        """Mark consent withdrawn. Idempotent: the **first** date is the one that stands.

        A second revocation moving the date would rewrite when consent was withdrawn, and that
        date is the one fact a retirement decision is made against.
        """

        with Session(self.engine) as session:
            row = session.get(VoiceReference, voice_id)
            if row is None:
                raise ValueError(f"voice reference {voice_id} does not exist")
            if row.revoked_at is None:
                row.revoked_at = revoked_at
                session.commit()

    def transition_scene(
        self,
        project_id: int,
        expected: Stage,
        target: Stage,
        *,
        approval: dict[str, object] | None = None,
    ) -> None:
        following = STAGE_TRANSITIONS.get(expected, ())
        if target not in following:
            raise ValueError(
                f"this scene is at {expected}; "
                + (
                    f"the next step is {' or '.join(following)}, not {target}"
                    if following
                    else f"{expected} is the final stage"
                )
            )
        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project:
                raise ValueError(f"scene project {project_id} does not exist")
            if Stage(project.stage) != expected:
                raise ValueError(
                    f"this scene moved to {Stage(project.stage)} while the action was running"
                )
            revision = session.get(SceneRevision, project.current_revision_id)
            assert revision
            if approval is not None:
                revision.approval_json = json.dumps(approval, ensure_ascii=False, sort_keys=True)
            project.stage = target
            session.commit()

    def record_scene_qa(self, project_id: int, variant: str, report: dict[str, object]) -> Stage:
        """Store one variant's QA report on the head revision; return the stage it leaves.

        The first report steps `audio_generated` → `automatically_checked`. A later one — another
        variant, or the same variant measured again — is stored at `automatically_checked` without
        a transition. Past that, a report is refused: a signature vouches for the bytes as they were
        measured when it was given, and replacing the measurement underneath it would let a
        failing report sit beside an approval nobody re-gave.
        """

        allowed = {Stage.AUDIO_GENERATED, Stage.AUTOMATICALLY_CHECKED}
        with Session(self.engine) as session:
            project = session.get(SceneProject, project_id)
            if not project or project.current_revision_id is None:
                raise ValueError(f"scene project {project_id} does not exist")
            stage = Stage(project.stage)
            if stage not in allowed:
                raise ValueError(
                    f"this scene is at {stage}; QA runs on {Stage.AUDIO_GENERATED} or "
                    f"{Stage.AUTOMATICALLY_CHECKED}"
                )
            body = json.dumps(report, ensure_ascii=False, sort_keys=True)
            now = datetime.now(UTC).isoformat()
            row = session.get(SceneQAReport, (project.current_revision_id, variant))
            if row is None:
                session.add(
                    SceneQAReport(
                        revision_id=project.current_revision_id,
                        variant=variant,
                        qa_json=body,
                        created_at=now,
                    )
                )
            else:
                row.qa_json = body
                row.created_at = now
            project.stage = Stage.AUTOMATICALLY_CHECKED
            session.commit()
            return Stage.AUTOMATICALLY_CHECKED

    def scene_qa_reports(self, revision_id: int) -> dict[str, dict[str, object]]:
        """Every stored QA report of one revision, by variant."""

        with Session(self.engine) as session:
            rows = session.scalars(
                select(SceneQAReport).where(SceneQAReport.revision_id == revision_id)
            )
            return {row.variant: json.loads(row.qa_json) for row in rows}

    def scene_qa_verdicts(self, variant: str) -> dict[int, bool | None]:
        """`passed` of every stored report on `variant`, by revision id, in one query."""

        with Session(self.engine) as session:
            rows = session.execute(
                select(SceneQAReport.revision_id, SceneQAReport.qa_json).where(
                    SceneQAReport.variant == variant
                )
            ).all()
        verdicts: dict[int, bool | None] = {}
        for revision_id, body in rows:
            passed = json.loads(body).get("passed")
            verdicts[int(revision_id)] = passed if isinstance(passed, bool) else None
        return verdicts

    def scene_qa_report(self, revision_id: int, variant: str) -> dict[str, object] | None:
        """The report on exactly this revision's render of exactly this variant, or None."""

        with Session(self.engine) as session:
            row = session.get(SceneQAReport, (revision_id, variant))
            return json.loads(row.qa_json) if row is not None else None
