"""Reading project and revision tables.

These two shipped without a migration: they were added to `Base.metadata` and created by
`Store.__init__`'s `create_all`, so every existing database already has them and no database
has a record of where they came from. This migration is that record.

Every create is therefore **guarded by an inspector**. On a fresh database it creates the
tables; on a database stamped at 0001 because it predates Alembic it finds them and does
nothing, so adopting Alembic does not require anyone to rebuild a local corpus.
"""

from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    existing = _tables()
    if "reading_projects" not in existing:
        op.create_table(
            "reading_projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("reading_id", sa.String(160), nullable=False, unique=True),
            sa.Column("stage", sa.String(40), nullable=False),
            sa.Column(
                "current_revision_id",
                sa.Integer(),
                sa.ForeignKey("reading_revisions.id"),
                nullable=True,
            ),
            sa.Column("created_at", sa.String(40), nullable=False),
        )
    if "reading_revisions" not in existing:
        op.create_table(
            "reading_revisions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "project_id", sa.Integer(), sa.ForeignKey("reading_projects.id"), nullable=False
            ),
            sa.Column("number", sa.Integer(), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("payload_sha256", sa.String(64), nullable=False),
            sa.Column("qa_json", sa.Text(), nullable=True),
            sa.Column("approval_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(40), nullable=False),
        )


def downgrade():
    existing = _tables()
    if "reading_revisions" in existing:
        op.drop_table("reading_revisions")
    if "reading_projects" in existing:
        op.drop_table("reading_projects")
