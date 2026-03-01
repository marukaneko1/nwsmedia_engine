"""add_businesses_email

Revision ID: 52862832f4f4
Revises: ec9230cc677a
Create Date: 2026-02-26 04:07:39.964056
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '52862832f4f4'
down_revision: Union[str, None] = 'ec9230cc677a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("businesses", "email")
