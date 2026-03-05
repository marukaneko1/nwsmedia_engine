from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id"), unique=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[str] = mapped_column(String(10), nullable=False)
    segment: Mapped[str | None] = mapped_column(String(20))
    score_breakdown: Mapped[dict | None] = mapped_column(JSONB)
    scored_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 100", name="ck_lead_scores_range"),
        Index("idx_lead_scores_segment", "segment"),
    )

    def __repr__(self) -> str:
        return f"<LeadScore(business_id={self.business_id}, score={self.score}, tier='{self.tier}', segment='{self.segment}')>"
