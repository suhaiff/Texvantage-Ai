from sqlalchemy import String, Integer, Float, Date, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from typing import Optional, TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .company import Company
    from .dataset import Dataset

class MonthlyFinancials(Base, TimestampMixin):
    __tablename__ = "monthly_financials"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False) # 1 to 12
    period_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    month_name: Mapped[str] = mapped_column(String(20), nullable=False) # e.g. "Jan 2026", "Feb 2026"
    
    # Financial metrics (Values stored in INR Lakh for precision, e.g. 29.50 = 29.5 Lakhs)
    revenue_lakh: Mapped[float] = mapped_column(Float, nullable=False)
    cogs_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    gross_profit_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    profit_margin_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # Gross profit / Revenue * 100
    operating_expenses_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    net_profit_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Operational metrics
    units_produced: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    units_sold: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    orders_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    avg_order_value_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    capacity_utilization_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_material_cost_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    energy_cost_lakh: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="financials")
    dataset: Mapped[Optional["Dataset"]] = relationship("Dataset", back_populates="financials")

    __table_args__ = (
        UniqueConstraint("company_id", "year", "month", name="uq_company_year_month"),
        Index("idx_company_period", "company_id", "period_date"),
    )
