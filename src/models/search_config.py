from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class SearchConfig(Base):
    __tablename__ = "search_configs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    niche: Mapped[str] = mapped_column(String(255), nullable=False)
    locations: Mapped[dict] = mapped_column(JSONB, nullable=False)
    radius_miles: Mapped[int] = mapped_column(Integer, default=25)
    max_results: Mapped[int] = mapped_column(Integer, default=200)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<SearchConfig(id={self.id}, niche='{self.niche}')>"
