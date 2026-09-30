from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import uuid
from pydantic import BaseModel, Field

class AIToolCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    arguments: Dict[str, Any]

class AIProviderResponse(BaseModel):
    content: Optional[str] = None
    tool_calls: List[AIToolCall] = Field(default_factory=list)
    finish_reason: Optional[str] = None
    usage_metadata: Optional[Dict[str, Any]] = None
    # Providers that require opaque metadata in a model turn (for example,
    # Gemini thought signatures) retain the original SDK content here.  The
    # orchestrator must replay it verbatim before sending tool results back.
    model_content: Optional[Any] = None

class AIProvider(ABC):
    """
    Abstract AI Provider Interface.
    Decouples business intelligence layer from any specific LLM SDK.
    """

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider credentials and endpoints are available."""
        pass

    @abstractmethod
    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        system_instruction: Optional[str] = None
    ) -> AIProviderResponse:
        """
        Generate chat response with function calling / tool calling capability.
        `messages` is a list of dicts with role ('user', 'model'/'assistant', 'function'/'tool') and content/results.
        """
        pass
