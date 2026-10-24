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
    RenameConversationRequest,
    MessageResponse,
    ArtifactResponse
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
    conv = repository.get_conversation_by_id(
        conversation_id,
        current_user.id,
        is_admin=current_user.is_admin()
    )
    if not conv:
        raise NotFoundError(f"Conversation '{conversation_id}' not found")
    
    messages_res = []
    for m in conv.messages:
        thinking_steps = []
        if m.thinking_steps_json:
            try:
                thinking_steps = json.loads(m.thinking_steps_json)
            except Exception:
                thinking_steps = []
        
        artifacts_res = []
        if m.artifacts:
            for ma in m.artifacts:
                art = ma.artifact
                if art:
                    payload = {}
                    if art.payload_json:
                        try:
                            payload = json.loads(art.payload_json)
                        except Exception:
                            payload = {}
                    artifacts_res.append(
                        ArtifactResponse(
                            id=art.id,
                            artifact_type=art.artifact_type,
                            title=art.title,
                            description=art.description,
                            filename=art.filename,
                            mime_type=art.mime_type,
                            file_size_bytes=art.file_size_bytes,
                            payload=payload,
                            download_url=f"/api/v1/artifacts/{art.id}/download" if art.file_path else None,
                            created_at=art.created_at
                        )
                    )
        
        messages_res.append(
            MessageResponse(
                id=m.id,
                sender_role=m.sender_role,
                content=m.content,
                thinking_steps=thinking_steps,
                artifacts=artifacts_res,
                created_at=m.created_at
            )
        )

    return ConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        user_id=conv.user_id,
        company_id=conv.company_id,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(conv.messages),
        messages=messages_res
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

@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(
    conversation_id: str,
    req: RenameConversationRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Rename a conversation."""
    updated = repository.update_conversation_title(conversation_id, current_user.id, req.title.strip())
    if not updated:
        raise NotFoundError(f"Conversation '{conversation_id}' not found")
    return ConversationResponse(
        id=updated.id,
        title=updated.title,
        user_id=updated.user_id,
        company_id=updated.company_id,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        message_count=len(updated.messages) if updated.messages else 0
    )

@router.delete("/conversations", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_conversations(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Clear all conversations for current user."""
    repository.clear_all_conversations(current_user.id)
