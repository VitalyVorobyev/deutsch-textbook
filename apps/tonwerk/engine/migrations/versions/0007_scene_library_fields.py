"""Two library fields on a scene project: `archived_at` and `forked_from`.

An archived project is out of the library's default view and out of the review queue, and is
still a project: its revisions, reports and signatures stay, because a scene is never deleted once
it has history. `forked_from` names the project and revision a fork was copied from, as
`<slug>@<revision>`, so a variant can always be traced to the take it started as.
"""

from alembic import op
import sqlalchemy as sa


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    return {row["name"] for row in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade():
    present = _columns("scene_projects")
    if "archived_at" not in present:
        op.add_column("scene_projects", sa.Column("archived_at", sa.String(40), nullable=True))
    if "forked_from" not in present:
        op.add_column("scene_projects", sa.Column("forked_from", sa.String(200), nullable=True))


def downgrade():
    with op.batch_alter_table("scene_projects") as batch:
        batch.drop_column("forked_from")
        batch.drop_column("archived_at")
