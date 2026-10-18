"""Consented voice references.

Additive, and one table. Nothing else moves: a scene's `voice_ref` lives inside the scene JSON that
`scene_revisions` already stores as opaque text, so casting a cloned voice needs no column anywhere
but here.

Guarded like 0002 and 0003 — not because a database can already have this one, but because the
guard is what makes re-running a migration on a partially applied SQLite file recoverable, and
SQLite has no transactional DDL rollback to fall back on.

**The reference audio is not in this table and must never be.** The row carries the recording's
SHA-256; the bytes live under the studio's app-data root (`generative.voices`), outside the
repository and outside any backup this file describes.
"""

from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade():
    if "voice_references" in _tables():
        return
    op.create_table(
        "voice_references",
        # The slug an author casts, and the primary key: a voice reference is named, not numbered,
        # because the name is what appears in a scene document on another machine.
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("reference_sha256", sa.String(64), nullable=False),
        # Nullable: an x-vector-only voice conditions on the speaker embedding alone and needs no
        # transcript. Any other voice does, and the engine refuses one that is missing it.
        sa.Column("reference_text", sa.Text(), nullable=True),
        sa.Column("subject_display_name", sa.String(200), nullable=False),
        # "evaluation" | "publication". A string rather than a CHECK constraint: the vocabulary is
        # enforced by the consent model, which is also where a new scope would have to earn its
        # rules, and SQLite would need a table rebuild to widen a constraint.
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("consent_sha256", sa.String(64), nullable=False),
        sa.Column("guardian_consent", sa.Boolean(), nullable=False),
        sa.Column("child_assent", sa.Boolean(), nullable=False),
        sa.Column("retention", sa.Text(), nullable=False),
        sa.Column("engine", sa.String(60), nullable=False),
        sa.Column("model_revision", sa.String(80), nullable=False),
        sa.Column("x_vector_only", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.String(40), nullable=False),
        # Withdrawal, as a date rather than as a deletion: a published render's provenance points
        # at this row, and a missing row would read as a voice that never existed.
        sa.Column("revoked_at", sa.String(40), nullable=True),
    )


def downgrade():
    if "voice_references" in _tables():
        op.drop_table("voice_references")
