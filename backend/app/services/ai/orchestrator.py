from typing import List, Dict, Any, Optional, Generator
import uuid
import json
import logging
import time
import re
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

BUSINESS KNOWLEDGE & RULES:
{knowledge_text}

STRICT OPERATIONAL & GROUNDING RULES:
1. When asked about metrics, data, charts, KPIs, or financials, ALWAYS call the matching analytics tool (`get_sales_trend`, `get_profit_trend`, `get_company_summary`, `get_top_products`, `compare_companies`, `get_global_summary`, `calculate_metric`, or `query_business_data`). The UI renders KPI cards and charts from those tool results automatically.
2. NEVER calculate arithmetic in your head or invent numbers. The numbers must come from a tool result.
3. If a tool reports that data or metric is unavailable, explicitly state that to the user. NEVER fabricate missing numbers.
4. If the tool returns an access violation, state the fact politely without hallucination.
5. Provide clear, professional, executive summaries suitable for C-suite textile mill owners. Do not claim a chart was shown unless a visualization tool actually ran.
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
            logger.info("GEMINI_API_KEY not configured. Falling back to local offline AI Engine for development.")
            return MockAIProvider()

    def _build_system_instruction(self) -> str:
        if self.user.is_admin():
            companies = self.repository.get_companies()
            comp_list = "\n".join([f"- {c.name} (ID: {c.id}, Location: {c.city}, {c.state})" for c in companies])
            comp_scope = f"Global Administration (All {len(companies)} Companies). Company mappings:\n{comp_list}"
        else:
            comp_scope = f"Company ID: {self.user.company_id}"
        
        knowledge_text = "No custom business knowledge documents found."
        if hasattr(self.repository, "SessionLocal"):
            try:
                from sqlalchemy import select
                from ...models.knowledge import CompanyKnowledge
                with self.repository.SessionLocal() as session:
                    # If admin, we could fetch all or none, but for safety fetch only if specific company scope is given, 
                    # or fetch all if admin. Let's fetch based on user's company_id.
                    docs = session.execute(select(CompanyKnowledge).where(CompanyKnowledge.company_id == self.user.company_id)).scalars().all()
                    if docs:
                        knowledge_text = "\n---\n".join([f"Document: {d.filename}\n{d.content}" for d in docs])
            except Exception as e:
                logger.error(f"Failed to fetch knowledge: {e}")
        
        return SYSTEM_PROMPT_TEMPLATE.format(
            user_name=self.user.name,
            user_role=self.user.role,
            company_scope=comp_scope,
            knowledge_text=knowledge_text
        )

    def _period_months_from_prompt(self, prompt_lower: str) -> int:
        month_match = re.search(r"\b(\d{1,2})\s*[- ]?month", prompt_lower)
        if month_match:
            return max(1, min(int(month_match.group(1)), 60))
        if any(term in prompt_lower for term in ("annual", "full year", "last year", "past year", "twelve month")):
            return 12
        if any(term in prompt_lower for term in ("quarter", "q1", "q2", "q3", "q4")):
            return 3
        return 6

    def _build_verified_tool_call(self, prompt: str) -> Optional[AIToolCall]:
        """Route unambiguous BI requests to database tools without an LLM.

        Named-company chart/KPI/report questions, multi-mill comparisons, and
        portfolio summaries are resolved from verified records even if the
        external model is rate-limited or skips visualization tools.
        """
        prompt_lower = prompt.casefold()
        companies = self.repository.get_companies(
            None if self.user.is_admin() else [self.user.company_id]
        )
        def aliases(company) -> List[str]:
            # Demo/ERP display names use the form "Textile J (Jupiter Garment
            # Exports)".  Users naturally ask for "Jupiter Garment Exports",
            # so treat the parenthetical trade name as an exact, safe alias.
            parenthetical_names = re.findall(r"\(([^)]+)\)", company.name)
            return [company.name, company.code, *parenthetical_names]

        matches = [
            company for company in companies
            if any(alias.casefold() in prompt_lower for alias in aliases(company))
        ]
        
        # Fallback for partial names (e.g., "Vardhman Spinning" for "Vardhman Spinning Mills")
        if not matches:
            extracted = re.search(r"\b(?:for|of)\s+(.+?)(?:\s+(?:over|during|in|with)\b|[?.!]|$)", prompt, flags=re.IGNORECASE)
            if extracted:
                req_name = extracted.group(1).strip(" ,.").casefold()
                if len(req_name) >= 3 and not req_name.startswith(("the ", "all ")):
                    matches = [
                        company for company in companies
                        if any(req_name in alias.casefold() for alias in aliases(company))
                    ]
        
        # Second fallback: match by the first word of the company alias
        if not matches:
            prompt_words = set(re.findall(r"\w+", prompt_lower))
            for company in companies:
                for alias in aliases(company):
                    first_word = alias.casefold().split()[0]
                    if len(first_word) >= 4 and first_word in prompt_words:
                        matches.append(company)
                        break
        months = self._period_months_from_prompt(prompt_lower)
        wants_chart = any(
            term in prompt_lower
            for term in ("trend", "plot", "chart", "graph", "visual", "trajectory")
        )
        wants_report = any(
            term in prompt_lower
            for term in ("report", "excel", "export", "brief", "workbook", "download")
        )
        wants_compare = any(
            term in prompt_lower
            for term in ("compare", "benchmark", "rank", "ranking", "versus", " vs ")
        )

        if any(term in prompt_lower for term in ("dataset", "uploaded file", "what have i uploaded")):
            company_id = matches[0].id if len(matches) == 1 else None
            args: Dict[str, Any] = {}
            if company_id:
                args["company_id"] = company_id
            return AIToolCall(name="get_uploaded_datasets_info", arguments=args)

        # If user has only 1 company (e.g. Owner), assume it for all DB questions if not specified
        if len(matches) == 0 and len(companies) == 1:
            matches = [companies[0]]

        if len(matches) >= 2 and self.user.is_admin() and wants_compare:
            return AIToolCall(
                name="compare_companies",
                arguments={
                    "company_ids": [company.id for company in matches],
                    "period_months": months,
                },
            )

        if len(matches) == 0 and self.user.is_admin() and (
            wants_compare
            or wants_chart
            or "portfolio" in prompt_lower
            or "all 10" in prompt_lower
            or "all ten" in prompt_lower
            or "consolidated" in prompt_lower
            or wants_report
            or "revenue" in prompt_lower
            or "profit" in prompt_lower
            or "margin" in prompt_lower
            or "sales" in prompt_lower
        ):
            if wants_compare:
                return AIToolCall(
                    name="compare_companies",
                    arguments={
                        "company_ids": [company.id for company in companies],
                        "period_months": months,
                    },
                )
            return AIToolCall(
                name="get_global_summary",
                arguments={"period_months": months},
            )

        if len(matches) != 1:
            return None

        company_id = matches[0].id

        if any(term in prompt_lower for term in ("category", "fabric", "product", "mix", "share", "composition", "breakdown")):
            return AIToolCall(
                name="get_top_products",
                arguments={"company_id": company_id, "limit": 10}
            )

        if wants_chart:
            tool_name = "get_profit_trend" if any(
                term in prompt_lower for term in ("profit", "margin")
            ) else "get_sales_trend"
            return AIToolCall(
                name=tool_name,
                arguments={"company_id": company_id, "months": months}
            )

        if wants_report or any(term in prompt_lower for term in ("executive summary", "summary", "kpi", "performance", "dashboard")):
            return AIToolCall(
                name="get_company_summary",
                arguments={"company_id": company_id}
            )

        if "growth" in prompt_lower:
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "growth", "period": "latest"}
            )

        return None

    def _unrecognized_company_message(self, prompt: str) -> Optional[str]:
        """Return a factual response when a prompt names a company absent from DB."""
        match = re.search(
            r"\b(?:for|of)\s+(.+?)(?:\s+(?:over|during|in|with)\b|[?.!]|$)",
            prompt,
            flags=re.IGNORECASE,
        )
        if not match:
            return None

        requested_name = match.group(1).strip(" ,.")
        if len(requested_name) < 3 or requested_name.casefold().startswith(("the ", "all ")):
            return None

        companies = self.repository.get_companies(
            None if self.user.is_admin() else [self.user.company_id]
        )
        known_names = ", ".join(company.name for company in companies)
        return (
            f"No company named '{requested_name}' exists in the connected database. "
            f"Available companies: {known_names}. Please select one of these names."
        )

    def _render_verified_answer(self, tool_name: str, tool_result: Dict[str, Any]) -> str:
        """Create a concise factual response from an already verified tool result."""
        if tool_result.get("status") != "success":
            return tool_result.get("message") or tool_result.get("error") or "Verified data is unavailable for this request."

        if tool_name == "get_sales_trend":
            trend = tool_result.get("sales_trend", {})
            company = self.repository.get_company_by_id(trend.get("company_id", ""))
            name = company.name if company else "the requested company"
            return (
                f"Verified {trend.get('period_months', 0)}-month sales and volume trend for {name}: "
                f"total revenue is ₹{trend.get('total_period_revenue_lakh', 0):,.2f} lakh and "
                f"average monthly revenue is ₹{trend.get('avg_monthly_revenue_lakh', 0):,.2f} lakh. "
                "The chart uses the underlying monthly ledger records."
            )

        if tool_name == "get_profit_trend":
            trend = tool_result.get("profit_trend", {})
            company = self.repository.get_company_by_id(trend.get("company_id", ""))
            name = company.name if company else "the requested company"
            return (
                f"Verified {trend.get('period_months', 0)}-month profitability trend for {name}. "
                "The chart uses the underlying monthly ledger records for gross profit and margin."
            )

        if tool_name == "get_company_summary":
            summary = tool_result.get("company_summary", {})
            return (
                f"Verified executive summary for {summary.get('company_name', 'the requested company')}: "
                f"latest monthly revenue is ₹{summary.get('latest_monthly_revenue_lakh', 0):,.2f} lakh "
                f"for {summary.get('latest_month', 'the latest recorded month')}, with a profit margin of "
                f"{summary.get('latest_profit_margin_pct', 0):.2f}%."
            )

        if tool_name == "calculate_metric" and tool_result.get("metric") == "revenue_growth":
            return (
                f"Verified month-over-month revenue growth is {tool_result.get('growth_pct', 0):+.2f}% "
                f"({tool_result.get('previous_month')} to {tool_result.get('current_month')})."
            )

        return "The displayed result was retrieved from the verified database records."

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

        # Provider configuration is checked lazily during generate_response()
        # This allows deterministic verified tool calls to execute even if the AI provider is unavailable.

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
        completed_tool_results: List[tuple[str, Dict[str, Any]]] = []
        verified_tool_call = self._build_verified_tool_call(prompt)
        unrecognized_company_message = (
            self._unrecognized_company_message(prompt)
            if verified_tool_call is None else None
        )

        while iteration < max_tool_iterations:
            iteration += 1

            # A named-company request with a known BI intent does not require
            # an external model to select its database tool.
            if verified_tool_call is not None and iteration == 1:
                response = AIProviderResponse(tool_calls=[verified_tool_call])
            elif verified_tool_call is not None:
                tool_name, tool_result = completed_tool_results[-1]
                final_content = self._render_verified_answer(tool_name, tool_result)
                break
            elif unrecognized_company_message is not None:
                final_content = unrecognized_company_message
                break
            else:
                try:
                    response = self.provider.generate_response(
                        messages=provider_messages,
                        tools=tools,
                        system_instruction=system_instruction
                    )
                except Exception as e:
                    logger.error(f"AI generation error: {e}")
                    # Do not discard a completed verified database result just
                    # because the optional natural-language synthesis call was
                    # rate-limited or otherwise unavailable.
                    if completed_tool_results:
                        tool_name, tool_result = completed_tool_results[-1]
                        final_content = self._render_verified_answer(tool_name, tool_result)
                        break
                    
                    if settings.APP_ENV.lower() == "production":
                        err_msg = "AI service is temporarily unavailable. Please try again."
                        yield AIStreamEvent(type="error", message=err_msg)
                        final_content = err_msg
                        break

                    # Fallback to MockAIProvider on API failure only in dev/test
                    try:
                        mock_provider = MockAIProvider()
                        response = mock_provider.generate_response(
                            messages=provider_messages,
                            tools=tools,
                            system_instruction=system_instruction
                        )
                        logger.info("Fell back to MockAIProvider successfully.")
                    except Exception as mock_e:
                        err_msg = "AI service is temporarily unavailable. Please try again."
                        yield AIStreamEvent(type="error", message=err_msg)
                        final_content = err_msg
                        break

            # If model produced direct answer with no tool calls, we're done
            if not response.tool_calls:
                final_content = response.content or "Analysis complete."
                break

            # Handle all calls from this model turn before returning results to
            # the provider.  Gemini requires its complete signed model content
            # to be replayed immediately before the corresponding responses.
            function_responses = []
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
                    resultSummary=f"Completed {tool_call.name}",
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

                function_responses.append({
                    "name": tool_call.name,
                    "id": tool_call.id,
                    "content": json.dumps(tool_result, default=str)
                })
                completed_tool_results.append((tool_call.name, tool_result))

            if response.model_content is not None:
                # Replay Gemini's native Content object without altering its
                # parts, including the opaque thought_signature.
                provider_messages.append({
                    "role": "model",
                    "gemini_content": response.model_content
                })
            else:
                # Other providers do not supply native signed content.
                provider_messages.append({
                    "role": "model",
                    "content": "",
                    "tool_calls": [
                        {"name": tool_call.name, "arguments": tool_call.arguments, "id": tool_call.id}
                        for tool_call in response.tool_calls
                    ]
                })

            provider_messages.append({
                "role": "function",
                "responses": function_responses
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
            yield AIStreamEvent(type="token", content=token_text, text=token_text)

        yield AIStreamEvent(
            type="answer",
            content=final_content,
            conversation_id=conv_id,
            message_id=assistant_msg_id,
            artifacts=captured_artifacts,
        )

        yield AIStreamEvent(
            type="complete",
            content=final_content,
            conversation_id=conv_id,
            message_id=assistant_msg_id,
            artifacts=captured_artifacts,
        )
