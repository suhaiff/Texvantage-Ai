from sqlalchemy import String, Integer, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .company import Company
    from .dataset import Dataset

class ProductMetric(Base, TimestampMixin):
    __tablename__ = "ai_product_metrics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("ai_companies.id"), nullable=False, index=True)
    dataset_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("ai_datasets.id"), nullable=True, index=True)
    category_name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "Combed Cotton 40s", "Poly-Cotton Yarn", "Denim Weft"
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    sales_volume_units: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # kg or meters
    unit_of_measure: Mapped[str] = mapped_column(String(20), nullable=False, default="kg")
    revenue_lakh: Mapped[float] = mapped_column(Float, nullable=False)
    profit_margin_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    top_customer_segment: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. "Export Garment Brands", "Domestic Weavers"

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="products")
    dataset: Mapped[Optional["Dataset"]] = relationship("Dataset", back_populates="products")

    __table_args__ = (
        Index("idx_product_company_date", "company_id", "year", "month"),
    )
