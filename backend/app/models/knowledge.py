from sqlalchemy import String, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .company import Company

class CompanyKnowledge(Base, TimestampMixin):
    __tablename__ = "ai_company_knowledge"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("ai_companies.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # We do not strictly need a back_populates if it's only one way for now, 
    # but we can relate it back to Company.
    company: Mapped["Company"] = relationship("Company")
