from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class LeadLifecycle(Base):
    __tablename__ = "lead_lifecycle"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("businesses.id"))
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str | None] = mapped_column(Text)

    def __repr__(self) -> str:
        return f"<LeadLifecycle(business_id={self.business_id}, status='{self.status}')>"
