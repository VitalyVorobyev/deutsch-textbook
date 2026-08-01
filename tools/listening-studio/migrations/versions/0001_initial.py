"""Initial project and immutable revision tables."""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("stage", sa.String(40), nullable=False),
        sa.Column(
            "current_revision_id", sa.Integer(), sa.ForeignKey("revisions.id"), nullable=True
        ),
        sa.Column("created_at", sa.String(40), nullable=False),
    )
    op.create_table(
        "revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("payload_sha256", sa.String(64), nullable=False),
        sa.Column("qa_json", sa.Text(), nullable=True),
        sa.Column("approval_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(40), nullable=False),
    )


def downgrade():
    op.drop_table("revisions")
    op.drop_table("projects")
