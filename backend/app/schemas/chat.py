from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class ArtifactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    artifact_type: str # "chart", "table", "excel", "pdf", "csv", "txt"
    title: str
    description: Optional[str] = None
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: int = 0
    payload: Optional[Dict[str, Any]] = None
    download_url: Optional[str] = None
    created_at: datetime

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_role: str
    content: str
    thinking_steps: Optional[List[str]] = None
    artifacts: List[ArtifactResponse] = []
    created_at: datetime

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    user_id: str
    company_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []

class SendMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    prompt: str
