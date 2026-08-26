from sqlalchemy import String, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .chat import Message

class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    company_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    artifact_type: Mapped[str] = mapped_column(String(30), nullable=False) # "chart", "table", "excel", "pdf", "csv", "txt"
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True) # Storage path on disk if binary
    payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # Serialized JSON payload for charts/tables

    # Relationships
    message_links: Mapped[List["MessageArtifact"]] = relationship("MessageArtifact", back_populates="artifact", cascade="all, delete-orphan")

class MessageArtifact(Base):
    __tablename__ = "message_artifacts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    message_id: Mapped[str] = mapped_column(String(50), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_id: Mapped[str] = mapped_column(String(50), ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    message: Mapped["Message"] = relationship("Message", back_populates="artifacts")
    artifact: Mapped["Artifact"] = relationship("Artifact", back_populates="message_links")
