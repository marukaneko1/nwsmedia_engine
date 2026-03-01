from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class OutreachLog(Base):
    __tablename__ = "outreach_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("businesses.id"))
    llc_filing_id: Mapped[int | None] = mapped_column(BigInteger)
    source_channel: Mapped[str] = mapped_column(String(20), nullable=False)
    outreach_type: Mapped[str] = mapped_column(String(20), nullable=False)
    segment: Mapped[str | None] = mapped_column(String(20))
    email_sent_to: Mapped[str | None] = mapped_column(String(255))
    campaign_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime)
    follow_up_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("idx_outreach_log_segment", "segment"),
    )

    def __repr__(self) -> str:
        return f"<OutreachLog(id={self.id}, channel='{self.source_channel}', segment='{self.segment}', status='{self.status}')>"
