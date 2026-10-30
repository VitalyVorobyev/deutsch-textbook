"""Drop the pre-scene dialogue and reading project tables — only when nothing is in them.

`projects`/`revisions` held `RevisionPayload` dialogues and `reading_projects`/`reading_revisions`
held `ReadingRevisionPayload` narrations. A scene project is now the only thing the engine renders,
checks, approves and publishes, and no code reads these four tables.

**A row is a refusal, not a casualty.** The upgrade counts every table first and drops nothing if
any of them holds a row: an immutable revision is authored German and an approval is a person's
signature, and neither may disappear because a schema moved on. Convert what is there to a scene
(`scene from-dialogue`, `scene from-reading --import`) or archive the database, then run the
upgrade again.

The downgrade recreates the four tables empty, with the columns 0001 and 0002 gave them.
"""

from alembic import op
import sqlalchemy as sa


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

#: Children before parents, so a database that enforces foreign keys can drop them in this order.
TABLES = ("revisions", "projects", "reading_revisions", "reading_projects")


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    bind = op.get_bind()
    present = [name for name in TABLES if name in _tables()]
    occupied = {
        name: int(bind.execute(sa.text(f'SELECT COUNT(*) FROM "{name}"')).scalar() or 0)
        for name in present
    }
    held = {name: count for name, count in occupied.items() if count}
    if held:
        rows = ", ".join(f"{name}: {count}" for name, count in sorted(held.items()))
        raise RuntimeError(
            "refusing to drop the pre-scene project tables because they still hold rows "
            f"({rows}). Convert those projects to scenes or archive this database, then upgrade "
            "again; nothing was changed."
        )
    for name in present:
        op.drop_table(name)


def downgrade():
    existing = _tables()
    if "projects" not in existing:
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
    if "revisions" not in existing:
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
