from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class TriageResult(Base):
    __tablename__ = "triage_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id"), unique=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    http_status: Mapped[int | None] = mapped_column(Integer)
    redirect_url: Mapped[str | None] = mapped_column(Text)
    is_free_subdomain: Mapped[bool] = mapped_column(Boolean, default=False)
    triaged_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    def __repr__(self) -> str:
        return f"<TriageResult(business_id={self.business_id}, status='{self.status}')>"
