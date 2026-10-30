"""Scene QA reports keyed by variant: `scene_qa_reports(revision_id, variant)`.

A render is per variant (`renders/<scene sha>/<variant>/`) and QA measures one render, but
`scene_revisions.qa_json` had room for one report per revision. Whichever variant was checked first
held the slot, so a revision whose `challenging` mix was checked could never have its `natural` mix
checked — and `natural` is the only one approved and published.

Every existing report moves to the variant it names (the scene QA has always written `variant`
into the report), or to `natural` when it names none, which is the variant every render defaulted
to. Then the column goes. The downgrade puts one report per revision back, preferring `natural`.
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

#: The variant a report that names none was run on: the render default on every surface.
DEFAULT_VARIANT = "natural"


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {row["name"] for row in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade():
    bind = op.get_bind()
    # Read first and rebuild second: the column drop recreates `scene_revisions` (SQLite cannot
    # drop a column in place on every version this runs on), and the new table references it.
    rows: list[tuple[int, str, str]] = []
    if "qa_json" in _columns("scene_revisions"):
        rows = [
            (int(revision_id), str(qa_json), str(created_at))
            for revision_id, qa_json, created_at in bind.execute(
                sa.text(
                    "SELECT id, qa_json, created_at FROM scene_revisions WHERE qa_json IS NOT NULL"
                )
            ).all()
        ]
        with op.batch_alter_table("scene_revisions") as batch:
            batch.drop_column("qa_json")
    if "scene_qa_reports" not in _tables():
        op.create_table(
            "scene_qa_reports",
            sa.Column(
                "revision_id",
                sa.Integer(),
                sa.ForeignKey("scene_revisions.id"),
                primary_key=True,
            ),
            sa.Column("variant", sa.String(60), primary_key=True),
            sa.Column("qa_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.String(40), nullable=False),
        )
    reports = sa.table(
        "scene_qa_reports",
        sa.column("revision_id", sa.Integer()),
        sa.column("variant", sa.String()),
        sa.column("qa_json", sa.Text()),
        sa.column("created_at", sa.String()),
    )
    for revision_id, qa_json, created_at in rows:
        report = json.loads(qa_json)
        named = report.get("variant") if isinstance(report, dict) else None
        measured = report.get("created_at") if isinstance(report, dict) else None
        bind.execute(
            reports.insert().values(
                revision_id=revision_id,
                variant=str(named or DEFAULT_VARIANT),
                qa_json=qa_json,
                created_at=str(measured or created_at),
            )
        )


def downgrade():
    bind = op.get_bind()
    if "qa_json" not in _columns("scene_revisions"):
        with op.batch_alter_table("scene_revisions") as batch:
            batch.add_column(sa.Column("qa_json", sa.Text(), nullable=True))
    if "scene_qa_reports" not in _tables():
        return
    rows = bind.execute(
        sa.text("SELECT revision_id, variant, qa_json FROM scene_qa_reports")
    ).all()
    chosen: dict[int, tuple[str, str]] = {}
    for revision_id, variant, qa_json in rows:
        held = chosen.get(revision_id)
        if held is None or (variant == DEFAULT_VARIANT and held[0] != DEFAULT_VARIANT):
            chosen[revision_id] = (variant, qa_json)
    for revision_id, (_, qa_json) in chosen.items():
        bind.execute(
            sa.text("UPDATE scene_revisions SET qa_json = :qa WHERE id = :id"),
            {"qa": qa_json, "id": revision_id},
        )
    op.drop_table("scene_qa_reports")
