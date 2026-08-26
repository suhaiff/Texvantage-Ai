from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List, TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .user import User
    from .financials import MonthlyFinancials
    from .product import ProductMetric
    from .dataset import Dataset

class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    specialization: Mapped[str] = mapped_column(String(150), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    founded_year: Mapped[int] = mapped_column(Integer, nullable=False)
    annual_capacity_description: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="company", cascade="all, delete-orphan")
    financials: Mapped[List["MonthlyFinancials"]] = relationship("MonthlyFinancials", back_populates="company", cascade="all, delete-orphan")
    products: Mapped[List["ProductMetric"]] = relationship("ProductMetric", back_populates="company", cascade="all, delete-orphan")
    datasets: Mapped[List["Dataset"]] = relationship("Dataset", back_populates="company", cascade="all, delete-orphan")
