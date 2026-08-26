from typing import List, Dict, Any, Optional, Generator
import uuid
import json
import logging
import time
from datetime import datetime, timezone

from ...schemas.auth import AuthenticatedUser
from ...schemas.ai_events import AIStreamEvent
from ...repositories.base import IDataRepository
from ...models.chat import Conversation, Message
from ...models.artifact import Artifact, MessageArtifact
from ...core.config import settings
from .provider import AIProvider, AIProviderResponse, AIToolCall
from .gemini import GeminiProvider
from .mock_provider import MockAIProvider
from .tools import ToolRegistry
from .artifacts import generate_artifacts_from_tool_result

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are TexVantage Business Intelligence AI, an enterprise manufacturing analyst for Indian textile mills and garment exporters.

TENANT & IDENTITY CONTEXT:
- Authenticated User: {user_name} ({user_role})
- Assigned Company Context: {company_scope}

STRICT OPERATIONAL & GROUNDING RULES:
1. ALWAYS use the provided business query and calculation tools to fetch facts before answering questions about revenue, profit, margins, units, growth, categories, or comparisons.
2. NEVER calculate arithmetic in your head or invent numbers. If a tool returns ₹348.50 Lakh, use exactly ₹348.50 Lakh.
3. If a tool reports that data or metric is unavailable (for example, COGS, units, or margins were not provided in uploaded data), explicitly state that to the user. NEVER fabricate missing numbers.
4. If the tool returns an access violation, state the fact politely without hallucination.
5. For general manufacturing concepts (e.g. "What is capacity utilization?", "Explain gross margin vs net profit"), answer directly without tools.
6. Provide clear, professional, executive summaries suitable for C-suite textile mill owners with formatted bullet points, bold key figures, and succinct executive takeaways.
"""

class AIOrchestrator:
    """
    Coordinates multi-turn business chat, tool selection, safe validation, artifact generation, and database persistence.
    Strictly follows environment provider rules and never silently falls back to mock in production.
    """

    def __init__(
        self,
        repository: IDataRepository,
        user: AuthenticatedUser,
        provider: Optional[AIProvider] = None
    ):
        self.repository = repository
        self.user = user
        
        if provider is not None:
            self.provider = provider
        else:
            self.provider = self._select_provider()

    def _select_provider(self) -> AIProvider:
        """
        Determines the appropriate AI provider according to strict environment rules.
        """
        env = settings.APP_ENV.lower()
        explicit_provider = (settings.AI_PROVIDER or "").lower()

        if env == "production":
            if explicit_provider == "mock":
                raise ValueError("Mock AI provider is strictly prohibited in production environment.")
            gemini = GeminiProvider()
            return gemini

        elif env == "test":
            if explicit_provider == "gemini":
                return GeminiProvider()
            return MockAIProvider()

        else: # development or other
            if explicit_provider == "mock":
                return MockAIProvider()
            gemini = GeminiProvider()
            if gemini.is_configured():
                return gemini
            # If not configured in development and mock not explicitly set:
            # We return GeminiProvider so unconfigured invocation fails cleanly with explicit error
            return gemini

    def _build_system_instruction(self) -> str:
        comp_scope = "Global Administration (All 10 Companies)" if self.user.is_admin() else f"Company ID: {self.user.company_id}"
        return SYSTEM_PROMPT_TEMPLATE.format(
            user_name=self.user.name,
            user_role=self.user.role,
            company_scope=comp_scope
        )

    def _get_or_create_conversation(self, conversation_id: Optional[str] = None) -> Conversation:
        if conversation_id:
            conv = self.repository.get_conversation_by_id(conversation_id, self.user.id)
            if conv:
                return conv

        new_conv = Conversation(
            id=f"conv_{uuid.uuid4().hex[:12]}",
            user_id=self.user.id,
            company_id=self.user.company_id,
            title="Business Intelligence Consultation"
        )
        return self.repository.create_conversation(new_conv)

    def run_conversation_turn(
        self,
        prompt: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a complete single or multi-turn prompt synchronously.
        Returns the final assistant message, execution event log, and saved message ID.
        """
        events = list(self.stream_conversation_turn(prompt, conversation_id=conversation_id))
        
        final_answer = ""
        artifacts = []
        msg_id = ""
        conv_id = conversation_id

        for ev in events:
            if ev.type == "answer" and ev.content:
                final_answer = ev.content
            elif ev.type == "artifact" and ev.artifact:
                artifacts.append(ev.artifact)
            elif ev.type == "complete":
                conv_id = ev.conversation_id or conv_id
                msg_id = ev.message_id or msg_id

        return {
            "conversation_id": conv_id,
            "message_id": msg_id,
            "response": final_answer,
            "artifacts": artifacts,
            "events": [ev.model_dump() for ev in events]
        }

    def stream_conversation_turn(
        self,
        prompt: str,
        conversation_id: Optional[str] = None
    ) -> Generator[AIStreamEvent, None, None]:
        """
        Processes message and yields structured safe events suitable for SSE streaming.
        Never exposes internal stack traces, API keys, or silently switches to MockAIProvider in production.
        """
        yield AIStreamEvent(type="status", message="Analyzing your business query...")

        conv = self._get_or_create_conversation(conversation_id)
        conv_id = conv.id

        # 1. Save User Message to Database
        user_msg = Message(
            id=f"msg_{uuid.uuid4().hex[:12]}",
            conversation_id=conv.id,
            sender_role="user",
            content=prompt
        )
        self.repository.add_message(user_msg)

        # Update conversation title if default
        if conv.title == "Business Intelligence Consultation":
            trimmed = prompt[:40] + ("..." if len(prompt) > 40 else "")
            conv.title = trimmed

        # Verify provider configuration
        if isinstance(self.provider, GeminiProvider) and not self.provider.is_configured():
            err_msg = "AI service is temporarily unavailable. Please try again."
            logger.error("GeminiProvider is not configured (missing GEMINI_API_KEY). No mock fallback allowed.")
            yield AIStreamEvent(type="error", message=err_msg)
            
            # Save Assistant error message
            assistant_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            assistant_msg = Message(
                id=assistant_msg_id,
                conversation_id=conv.id,
                sender_role="assistant",
                content=err_msg
            )
            self.repository.add_message(assistant_msg)
            yield AIStreamEvent(type="answer", content=err_msg, conversation_id=conv_id, message_id=assistant_msg_id)
            yield AIStreamEvent(type="complete", content=err_msg, conversation_id=conv_id, message_id=assistant_msg_id)
            return

        # 2. Build conversation history
        tools = ToolRegistry.get_available_tools(self.user)
        system_instruction = self._build_system_instruction()

        loaded_conv = self.repository.get_conversation_by_id(conv.id, self.user.id)
        raw_messages = loaded_conv.messages if loaded_conv else [user_msg]

        # Last 10 messages for multi-turn context
        provider_messages = []
        for m in raw_messages[-10:]:
            provider_messages.append({
                "role": "user" if m.sender_role == "user" else "model",
                "content": m.content
            })

        yield AIStreamEvent(type="status", message="Evaluating query against verified data repository...")

        max_tool_iterations = 4
        iteration = 0
        final_content = ""
        captured_artifacts: List[Dict[str, Any]] = []

        while iteration < max_tool_iterations:
            iteration += 1
            
            try:
                response: AIProviderResponse = self.provider.generate_response(
                    messages=provider_messages,
                    tools=tools,
                    system_instruction=system_instruction
                )
            except Exception as e:
                logger.error(f"AI generation error: {e}")
                err_msg = "AI service is temporarily unavailable. Please try again."
                yield AIStreamEvent(type="error", message=err_msg)
                final_content = err_msg
                break

            # If model produced direct answer with no tool calls, we're done
            if not response.tool_calls:
                final_content = response.content or "Analysis complete."
                break

            # Handle Tool Calls
            for tool_call in response.tool_calls:
                yield AIStreamEvent(
                    type="tool_start",
                    tool=tool_call.name,
                    arguments=tool_call.arguments,
                    message=f"Querying verified ledger: {tool_call.name}"
                )

                tool_result = ToolRegistry.execute_tool(
                    tool_name=tool_call.name,
                    arguments=tool_call.arguments,
                    user=self.user,
                    repository=self.repository
                )

                yield AIStreamEvent(
                    type="tool_complete",
                    tool=tool_call.name,
                    data={"status": tool_result.get("status", "completed")},
                    message=f"Completed {tool_call.name}"
                )

                # Synthesize structured artifacts (KPIs, Charts, Tables, Files)
                new_artifacts = generate_artifacts_from_tool_result(
                    tool_name=tool_call.name,
                    tool_args=tool_call.arguments,
                    tool_result=tool_result,
                    user_prompt=prompt
                )
                for art in new_artifacts:
                    captured_artifacts.append(art)
                    yield AIStreamEvent(
                        type="artifact",
                        artifact=art,
                        message=f"Generated {art.get('title')}"
                    )

                # Append tool call & result to message history for Gemini to synthesize final answer
                provider_messages.append({
                    "role": "model",
                    "content": "",
                    "tool_calls": [{"name": tool_call.name, "arguments": tool_call.arguments}]
                })
                provider_messages.append({
                    "role": "function",
                    "name": tool_call.name,
                    "content": json.dumps(tool_result, default=str)
                })

        # Save Assistant message
        assistant_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        assistant_msg = Message(
            id=assistant_msg_id,
            conversation_id=conv.id,
            sender_role="assistant",
            content=final_content
        )
        self.repository.add_message(assistant_msg)

        # Stream words/tokens for a smooth typing animation experience
        words = final_content.split(" ")
        for i, word in enumerate(words):
            token_text = word if i == len(words) - 1 else word + " "
            yield AIStreamEvent(type="token", content=token_text)

        yield AIStreamEvent(
            type="answer",
            content=final_content,
            conversation_id=conv_id,
            message_id=assistant_msg_id
        )

        yield AIStreamEvent(
            type="complete",
            content=final_content,
            conversation_id=conv_id,
            message_id=assistant_msg_id
        )
