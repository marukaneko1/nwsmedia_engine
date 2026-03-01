"""add_segment_columns

Revision ID: a3f8b1c9d2e5
Revises: 52862832f4f4
Create Date: 2026-02-26 05:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f8b1c9d2e5'
down_revision: Union[str, None] = '52862832f4f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lead_scores", sa.Column("segment", sa.String(length=20), nullable=True))
    op.create_index("idx_lead_scores_segment", "lead_scores", ["segment"])

    op.add_column("outreach_log", sa.Column("segment", sa.String(length=20), nullable=True))
    op.create_index("idx_outreach_log_segment", "outreach_log", ["segment"])


def downgrade() -> None:
    op.drop_index("idx_outreach_log_segment", table_name="outreach_log")
    op.drop_column("outreach_log", "segment")

    op.drop_index("idx_lead_scores_segment", table_name="lead_scores")
    op.drop_column("lead_scores", "segment")
