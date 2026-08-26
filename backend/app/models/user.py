from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .company import Company
    from .chat import Conversation
    from .dataset import Dataset
    from .audit import AuditLog

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="OWNER")  # "OWNER" or "ADMIN"
    company_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    job_title: Mapped[str] = mapped_column(String(100), nullable=False, default="Executive")

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="users")
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    datasets: Mapped[List["Dataset"]] = relationship("Dataset", back_populates="uploader")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")
