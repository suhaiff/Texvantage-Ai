from sqlalchemy import String, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .user import User

class AuditLog(Base, TimestampMixin):
    __tablename__ = "ai_audit_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("ai_users.id"), nullable=True, index=True)
    company_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "AUTH_LOGIN", "DATA_QUERY", "REPORT_GENERATE", "UPLOAD"
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
