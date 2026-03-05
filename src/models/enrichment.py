from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class EnrichmentData(Base):
    __tablename__ = "enrichment_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id"), unique=True)
    best_email: Mapped[str | None] = mapped_column(String(255))
    all_emails: Mapped[list | dict | None] = mapped_column(JSONB)
    owner_name: Mapped[str | None] = mapped_column(String(255))
    owner_position: Mapped[str | None] = mapped_column(String(255))
    social_profiles: Mapped[dict | None] = mapped_column(JSONB)
    enrichment_source: Mapped[str | None] = mapped_column(String(50))
    enriched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    def __repr__(self) -> str:
        return f"<EnrichmentData(business_id={self.business_id}, email='{self.best_email}')>"
