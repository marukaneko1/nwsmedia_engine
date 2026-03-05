from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.utils.time import utcnow


class WebsiteAudit(Base):
    __tablename__ = "website_audits"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("businesses.id"), unique=True)
    url_audited: Mapped[str] = mapped_column(Text, nullable=False)

    # PageSpeed scores
    performance_score: Mapped[int | None] = mapped_column(Integer)
    seo_score: Mapped[int | None] = mapped_column(Integer)
    accessibility_score: Mapped[int | None] = mapped_column(Integer)
    best_practices_score: Mapped[int | None] = mapped_column(Integer)

    # Core Web Vitals
    lcp_seconds: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    fid_ms: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    cls_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 3))
    fcp_seconds: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    speed_index_seconds: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    total_blocking_ms: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))

    # SSL
    has_ssl: Mapped[bool | None] = mapped_column(Boolean)
    ssl_valid: Mapped[bool | None] = mapped_column(Boolean)
    ssl_expires: Mapped[datetime | None] = mapped_column(DateTime)

    # Mobile
    is_mobile_friendly: Mapped[bool | None] = mapped_column(Boolean)
    has_viewport_meta: Mapped[bool | None] = mapped_column(Boolean)
    has_horizontal_scroll: Mapped[bool | None] = mapped_column(Boolean)
    small_tap_targets: Mapped[int | None] = mapped_column(Integer)

    # Technology
    technologies: Mapped[dict | None] = mapped_column(JSONB)
    is_page_builder: Mapped[bool | None] = mapped_column(Boolean)
    is_wordpress: Mapped[bool | None] = mapped_column(Boolean)

    # Freshness
    copyright_year: Mapped[int | None] = mapped_column(Integer)
    is_outdated: Mapped[bool | None] = mapped_column(Boolean)

    # Raw data
    raw_lighthouse: Mapped[dict | None] = mapped_column(JSONB)

    audited_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    def __repr__(self) -> str:
        return f"<WebsiteAudit(business_id={self.business_id}, perf={self.performance_score})>"
