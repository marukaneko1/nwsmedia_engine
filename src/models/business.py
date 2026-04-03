from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    place_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    source_channel: Mapped[str] = mapped_column(String(20), default="google_maps")
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(255))
    state: Mapped[str | None] = mapped_column(String(50))
    zip_code: Mapped[str | None] = mapped_column(String(20))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(Text)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    photos_count: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7))
    hours: Mapped[dict | None] = mapped_column(JSONB)
    maps_url: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    listing_description: Mapped[str | None] = mapped_column(Text)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Yelp-specific fields
    is_claimed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    price_tier: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Secretary of State filing fields
    filing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    registered_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    officer_names: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("idx_businesses_place_id", "place_id"),
        Index("idx_businesses_category", "category"),
        Index("idx_businesses_city", "city"),
        Index("idx_businesses_filing_date", "filing_date"),
        Index("idx_businesses_is_claimed", "is_claimed"),
    )

    def __repr__(self) -> str:
        return f"<Business(id={self.id}, name='{self.name}', city='{self.city}')>"
