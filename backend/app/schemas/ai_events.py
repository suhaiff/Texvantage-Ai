from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class AIStreamEvent(BaseModel):
    """Safe structured event for execution status and SSE streaming."""
    type: str # "status", "tool_start", "tool_complete", "token", "artifact", "answer", "done", "complete", "error"
    message: Optional[str] = None
    tool: Optional[str] = None
    arguments: Optional[Dict[str, Any]] = None
    content: Optional[str] = None
    text: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    resultSummary: Optional[str] = None
    artifact: Optional[Dict[str, Any]] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
