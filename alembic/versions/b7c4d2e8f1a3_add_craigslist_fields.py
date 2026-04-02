"""add_craigslist_fields

Revision ID: b7c4d2e8f1a3
Revises: a3f8b1c9d2e5
Create Date: 2026-03-06 03:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c4d2e8f1a3'
down_revision: Union[str, None] = 'a3f8b1c9d2e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("businesses", sa.Column("listing_description", sa.Text(), nullable=True))
    op.create_index("idx_businesses_source_channel", "businesses", ["source_channel"])


def downgrade() -> None:
    op.drop_index("idx_businesses_source_channel", table_name="businesses")
    op.drop_column("businesses", "listing_description")
    op.drop_column("businesses", "source_url")
