"""Scene v1 project and revision tables.

Additive only. The dialogue and reading tables are untouched: Scene v1 runs beside them until
later PRs reach parity on rendering, QA and export, and only then does anything move.

Guarded like 0002 — not because a database can already have these (none can), but because the
guard is what makes re-running a migration on a partially applied SQLite file recoverable, and
SQLite has no transactional DDL rollback to fall back on.
"""

from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    existing = _tables()
    if "scene_projects" not in existing:
        op.create_table(
            "scene_projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("slug", sa.String(160), nullable=False, unique=True),
            sa.Column("kind", sa.String(20), nullable=False),
            sa.Column("stage", sa.String(40), nullable=False),
            sa.Column(
                "current_revision_id",
                sa.Integer(),
                sa.ForeignKey("scene_revisions.id"),
                nullable=True,
            ),
            sa.Column("created_at", sa.String(40), nullable=False),
        )
    if "scene_revisions" not in existing:
        op.create_table(
            "scene_revisions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "project_id", sa.Integer(), sa.ForeignKey("scene_projects.id"), nullable=False
            ),
            sa.Column("number", sa.Integer(), nullable=False),
            sa.Column("scene_json", sa.Text(), nullable=False),
            sa.Column("scene_sha256", sa.String(64), nullable=False),
            # Nullable: a scene is audio, and a scene with no comprehension questions attached
            # to it is a complete artifact, not an unfinished one.
            sa.Column("exercise_json", sa.Text(), nullable=True),
            sa.Column("qa_json", sa.Text(), nullable=True),
            sa.Column("approval_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(40), nullable=False),
        )


def downgrade():
    existing = _tables()
    if "scene_revisions" in existing:
        op.drop_table("scene_revisions")
    if "scene_projects" in existing:
        op.drop_table("scene_projects")
