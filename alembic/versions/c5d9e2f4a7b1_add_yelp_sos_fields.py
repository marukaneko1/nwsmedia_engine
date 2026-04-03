"""add_yelp_sos_fields

Revision ID: c5d9e2f4a7b1
Revises: b7c4d2e8f1a3
Create Date: 2026-03-29 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'c5d9e2f4a7b1'
down_revision: Union[str, None] = 'b7c4d2e8f1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("is_claimed", sa.Boolean(), nullable=True))
    op.add_column("businesses", sa.Column("price_tier", sa.String(10), nullable=True))
    op.add_column("businesses", sa.Column("filing_date", sa.Date(), nullable=True))
    op.add_column("businesses", sa.Column("entity_type", sa.String(50), nullable=True))
    op.add_column("businesses", sa.Column("registered_agent", sa.String(500), nullable=True))
    op.add_column("businesses", sa.Column("officer_names", JSONB(), nullable=True))
    op.create_index("idx_businesses_filing_date", "businesses", ["filing_date"])
    op.create_index("idx_businesses_is_claimed", "businesses", ["is_claimed"])


def downgrade() -> None:
    op.drop_index("idx_businesses_is_claimed", table_name="businesses")
    op.drop_index("idx_businesses_filing_date", table_name="businesses")
    op.drop_column("businesses", "officer_names")
    op.drop_column("businesses", "registered_agent")
    op.drop_column("businesses", "entity_type")
    op.drop_column("businesses", "filing_date")
    op.drop_column("businesses", "price_tier")
    op.drop_column("businesses", "is_claimed")
