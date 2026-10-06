from sqlalchemy import String, Integer, ForeignKey, Text, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, Optional, TYPE_CHECKING
from datetime import datetime, date, timezone
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .company import Company
    from .user import User
    from .financials import MonthlyFinancials
    from .product import ProductMetric

class Dataset(Base, TimestampMixin):
    __tablename__ = "ai_datasets"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("ai_companies.id"), nullable=False, index=True)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("ai_users.id"), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str] = mapped_column(String(20), nullable=False) # "XLSX", "XLS", "CSV", "JSON"
    file_type: Mapped[str] = mapped_column(String(20), nullable=False, default="CSV") # backward compat
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0) # in bytes
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="UPLOADED") # "UPLOADED", "PROCESSING", "COMPLETED", "FAILED"
    record_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    dataset_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    date_range_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_range_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    stored_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    mapping_config: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON config

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="datasets")
    uploader: Mapped[Optional["User"]] = relationship("User", back_populates="datasets")
    columns: Mapped[List["DatasetColumn"]] = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    financials: Mapped[List["MonthlyFinancials"]] = relationship("MonthlyFinancials", back_populates="dataset")
    products: Mapped[List["ProductMetric"]] = relationship("ProductMetric", back_populates="dataset")

class DatasetColumn(Base):
    __tablename__ = "ai_dataset_columns"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(50), ForeignKey("ai_datasets.id"), nullable=False, index=True)
    column_name: Mapped[str] = mapped_column(String(100), nullable=False)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False) # "string", "number", "date", "currency"
    suggested_field: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # "revenue", "cogs", "date", etc.
    sample_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="columns")
