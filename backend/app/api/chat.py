from fastapi import APIRouter, Depends, status, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
import json
import logging

from ..core.dependencies import get_current_user, get_repository, require_admin
from ..core.exceptions import NotFoundError, ForbiddenError, UnauthorizedError
from ..repositories.base import IDataRepository
from ..schemas.auth import AuthenticatedUser
from ..schemas.chat import (
    ConversationResponse,
    ConversationDetailResponse,
    SendMessageRequest,
    MessageResponse
)
from ..services.ai.orchestrator import AIOrchestrator
from ..schemas.ai_events import AIStreamEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Chat & Intelligence"])

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Retrieve conversations for authenticated user."""
    convs = repository.get_conversations_for_user(current_user.id)
    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            user_id=c.user_id,
            company_id=c.company_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages) if c.messages else 0
        )
        for c in convs
    ]

@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation_detail(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Retrieve full conversation history."""
    conv = repository.get_conversation_by_id(conversation_id, current_user.id)
    if not conv:
        raise NotFoundError(f"Conversation '{conversation_id}' not found")
    
    return ConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        user_id=conv.user_id,
        company_id=conv.company_id,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(conv.messages),
        messages=[
            MessageResponse(
                id=m.id,
                sender_role=m.sender_role,
                content=m.content,
                thinking_steps=[],
                artifacts=[],
                created_at=m.created_at
            )
            for m in conv.messages
        ]
    )

@router.post("/message")
def send_message(
    req: SendMessageRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """
    Execute AI business consultation prompt synchronously.
    Runs tool-calling loop and returns response with execution event trail.
    """
    orchestrator = AIOrchestrator(repository=repository, user=current_user)
    result = orchestrator.run_conversation_turn(
        prompt=req.prompt,
        conversation_id=req.conversation_id
    )
    return result

@router.post("/stream")
def stream_message(
    req: SendMessageRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """
    Execute AI business consultation with Server-Sent Events (SSE).
    Streams real-time status, tool executions, structured artifacts, and answer tokens.
    """
    orchestrator = AIOrchestrator(repository=repository, user=current_user)

    def event_stream():
        try:
            for event in orchestrator.stream_conversation_turn(
                prompt=req.prompt,
                conversation_id=req.conversation_id
            ):
                payload = event.model_dump_json(exclude_none=True)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Error during event stream execution")
            err_event = AIStreamEvent(
                type="error",
                message="Unable to complete the analysis right now. Please try again."
            )
            yield f"data: {err_event.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Delete a conversation session."""
    deleted = repository.delete_conversation(conversation_id, current_user.id)
    if not deleted:
        raise NotFoundError(f"Conversation '{conversation_id}' not found")
