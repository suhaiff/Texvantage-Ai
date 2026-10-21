from typing import List, Dict, Any, Optional, Generator
import uuid
import json
import logging
import time
import re
from datetime import datetime, timezone
from .nlp_utils import (
    fuzzy_match_company,
    fuzzy_match_company_with_score,
    closest_company_name,
    extract_intent,
    extract_period,
    normalize_prompt,
    extract_requested_name,
)

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
from .narrative_generator import generate_narrative_from_tool_result, generate_conceptual_narrative

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are TexVantage Business Intelligence AI — an expert senior enterprise analyst for Indian textile mills and garment manufacturers, comparable to a top-tier McKinsey/BCG consultant.

TENANT & IDENTITY CONTEXT:
- Authenticated User: {user_name} ({user_role})
- Assigned Company Context: {company_scope}

BUSINESS KNOWLEDGE & RULES:
{knowledge_text}

CRITICAL ANALYTICAL RESPONSE RULES (Follow these STRICTLY):
1. ALWAYS call the appropriate analytics tool before answering any numerical question. NEVER guess or invent numbers.
2. After receiving tool data, produce a COMPREHENSIVE, MULTI-PARAGRAPH analytical response — not just a data dump or bullet list.
3. Structure every response like a professional analyst report:
   - Start with a bold headline insight (the single most important takeaway).
   - Expand with 2–4 paragraphs covering: what the numbers mean, why they matter, trends, comparisons to expectations, and what factors are likely driving the result.
   - Close with 2–3 strategic recommendations or follow-up observations.
4. For RANKINGS (top N, highest, lowest, best, worst): Always list ALL items in the ranking with their exact numbers, then analyze the gap between leaders and laggards.
5. For SINGLE COMPANIES: Cover revenue, margin, growth rate, capacity utilization, trends, peaks/troughs, and product mix. Make the company feel fully understood.
6. For COMPARISONS: Highlight which company leads and which lags on each dimension, explain the gap, and identify structural advantages.
7. Use Markdown formatting: **bold** for key numbers and company names, bullet points for lists, ### headers for section titles.
8. Always show exact numbers from the database with appropriate units (₹ Lakh, %, units). Round to 2 decimal places.
9. The response should feel like talking to an insightful senior analyst, not reading a database printout.
10. Every response MUST have at least 150 words of meaningful analysis.
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
        """Delegates to nlp_utils for robust period extraction."""
        return extract_period(prompt_lower)

    def _build_verified_tool_call(self, prompt: str) -> Optional[AIToolCall]:
        """
        Routes ANY natural-language BI request to the correct database tool.

        Uses a multi-layer NLP pipeline:
        1. Prompt normalization (typo correction)
        2. Fuzzy company matching (handles partial names, typos, abbreviations)
        3. Semantic intent extraction (30+ phrase patterns)
        4. Period extraction (month count from free text)
        """
        normalized = normalize_prompt(prompt)
        prompt_lower = normalized.casefold()
        months = extract_period(prompt_lower)
        intent = extract_intent(prompt_lower)

        companies = self.repository.get_companies(
            None if self.user.is_admin() else [self.user.company_id]
        )

        # --- Conceptual / Advisory queries (pure consultancy / business knowledge) ---
        if intent == "conceptual":
            return None

        # --- Datasets query (always short-circuit before company matching) ---
        if intent == "datasets" or any(term in prompt_lower for term in ("uploaded file", "what have i uploaded")):
            matched = fuzzy_match_company(normalized, companies)
            args: Dict[str, Any] = {}
            if matched:
                args["company_id"] = matched.id
            return AIToolCall(name="get_uploaded_datasets_info", arguments=args)

        # --- Fuzzy company matching ---
        matched_company, match_score = fuzzy_match_company_with_score(normalized, companies)

        # Single-company users always use their own company
        if not matched_company and len(companies) == 1:
            matched_company = companies[0]
            match_score = 100.0

        # Products request without single company specified
        if intent == "products" and not matched_company:
            return AIToolCall(name="get_top_products", arguments={"limit": 10})

        # --- Admin-level: portfolio / cross-company requests ---
        if self.user.is_admin():
            is_ranking_or_comparison = (
                intent == "comparison" or
                any(term in prompt_lower for term in (
                    "top 3", "top 5", "top 10", "top ", "top-3", "top-5",
                    "highest", "lowest", "best", "worst", "leader", "leaders",
                    "rank", "which mill", "which company", "which mills", "which companies",
                    "across mills", "across companies", "by company", "by mill",
                    "all mills", "all companies", "all 10", "all ten", "portfolio"
                ))
            )
            is_portfolio = any(term in prompt_lower for term in (
                "portfolio", "all 10", "all ten", "consolidated", "all companies",
                "all mills", "every company", "every mill", "across all",
            ))

            if is_ranking_or_comparison and (not matched_company or match_score < 75):
                if intent == "summary" and is_portfolio and not any(term in prompt_lower for term in ("compare", "top", "rank", "highest", "lowest", "which")):
                    return AIToolCall(name="get_global_summary", arguments={"period_months": months})
                return AIToolCall(
                    name="compare_companies",
                    arguments={
                        "company_ids": [c.id for c in companies],
                        "period_months": months,
                    },
                )

            # Multiple companies matched — compare them
            if is_ranking_or_comparison and matched_company:
                multi_matches = [c for c in companies if fuzzy_match_company(normalized, [c], threshold=65)]
                if len(multi_matches) >= 2:
                    return AIToolCall(
                        name="compare_companies",
                        arguments={
                            "company_ids": [c.id for c in multi_matches],
                            "period_months": months,
                        },
                    )

            # No specific company identified and it's a general BI question → global summary
            # Guard: require at least one explicit business keyword in the prompt to avoid
            # routing generic greetings ("Hello", "Tell me a joke") as BI queries.
            _BI_KEYWORDS = {
                "revenue", "sales", "profit", "margin", "cost", "cogs", "performance",
                "summary", "overview", "kpi", "dashboard", "report", "trend", "growth",
                "units", "production", "capacity", "turnover", "income", "earning",
                "mill", "company", "companies", "portfolio", "textile", "financial",
            }
            _has_bi_keyword = any(kw in prompt_lower for kw in _BI_KEYWORDS)
            if not matched_company and _has_bi_keyword and intent in ("revenue", "profit", "margin", "summary", "trend", "growth"):
                return AIToolCall(name="get_global_summary", arguments={"period_months": months})

        # --- Single-company routing ---
        if not matched_company:
            return None

        company_id = matched_company.id

        # Products / category mix
        if intent == "products":
            return AIToolCall(
                name="get_top_products",
                arguments={"company_id": company_id, "limit": 10},
            )

        # Trend / chart
        if intent == "trend":
            tool_name = "get_profit_trend" if any(
                t in prompt_lower for t in ("profit", "margin")
            ) else "get_sales_trend"
            return AIToolCall(
                name=tool_name,
                arguments={"company_id": company_id, "months": months},
            )

        # Growth rate
        if intent == "growth":
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "growth", "period": "latest"},
            )

        # Revenue / sales total
        if intent == "revenue":
            period = "last_6_months" if months == 6 and any(
                t in prompt_lower for t in ("total", "last 6", "6 month", "six month", "past 6")
            ) else "latest"
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "revenue", "period": period},
            )

        # Gross profit amount
        if intent == "profit":
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "gross_profit", "period": "latest"},
            )

        # Profit margin %
        if intent == "margin":
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "margin", "period": "latest"},
            )

        # Units / volume
        if intent == "units":
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "units", "period": "latest"},
            )

        # Orders / AOV
        if intent == "orders":
            return AIToolCall(
                name="calculate_metric",
                arguments={"company_id": company_id, "metric_type": "aov", "period": "latest"},
            )

        # Summary / KPI / report / dashboard — default single-company action
        return AIToolCall(
            name="get_company_summary",
            arguments={"company_id": company_id},
        )

    def _unrecognized_company_message(self, prompt: str) -> Optional[str]:
        """
        Returns a helpful error message only when the prompt CLEARLY names a company
        that cannot be matched even with fuzzy logic.
        Suggests the closest match when confidence is moderate.
        """
        normalized = normalize_prompt(prompt)
        requested_name = extract_requested_name(normalized)
        if not requested_name:
            return None
        if len(requested_name) < 3 or requested_name.casefold().startswith(("the ", "all ", "my ")):
            return None

        companies = self.repository.get_companies(
            None if self.user.is_admin() else [self.user.company_id]
        )

        matched, score = fuzzy_match_company_with_score(normalized, companies)

        # High confidence — a company was matched; no error needed
        if matched and score >= 65:
            return None

        # Moderate confidence — suggest the closest match
        if matched and score >= 40:
            return (
                f"I couldn't find a company named '{requested_name}' in the database. "
                f"Did you mean **{matched.name}**? "
                f"You can also choose from: {', '.join(c.name for c in companies if c.id != matched.id)}."
            )

        # Low confidence — list all options
        known_names = ", ".join(c.name for c in companies)
        return (
            f"No company named '{requested_name}' exists in the connected database. "
            f"Available companies: {known_names}. Please select one of these names."
        )

    def _render_verified_answer(self, tool_name: str, tool_result: Dict[str, Any], prompt: str = "") -> str:
        """
        Generate a deep, ChatGPT-style analytical narrative tailored dynamically to
        verified tool results and the user's specific prompt.
        """
        return generate_narrative_from_tool_result(tool_name, tool_result, prompt)

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
        # Track which tool names have already generated artifacts this turn.
        # Prevents duplicate charts/KPIs when the same tool is called >1 time
        # in a multi-step loop (e.g. compare_companies on iter 1 AND iter 2).
        tools_that_generated_artifacts: set = set()
        verified_tool_call = self._build_verified_tool_call(prompt)

        # Context carry-forward: if nothing was matched but the previous assistant
        # message mentioned a company, re-run the last tool for that company with
        # the updated intent from the new prompt.
        if verified_tool_call is None:
            try:
                last_user_msgs = [m for m in raw_messages if m.sender_role == "user"]
                prev_user_prompt = last_user_msgs[-2].content if len(last_user_msgs) >= 2 else ""
                if prev_user_prompt:
                    prev_normalized = normalize_prompt(prev_user_prompt)
                    companies_scope = self.repository.get_companies(
                        None if self.user.is_admin() else [self.user.company_id]
                    )
                    prev_company, prev_score = fuzzy_match_company_with_score(prev_normalized, companies_scope)
                    if prev_company and prev_score >= 60:
                        # Build a synthetic combined prompt and re-attempt routing
                        combined = prev_normalized + " " + prompt
                        verified_tool_call = self._build_verified_tool_call(combined)
            except Exception:
                pass  # Never let context carry-forward break the request

        unrecognized_company_message = (
            self._unrecognized_company_message(prompt)
            if verified_tool_call is None else None
        )

        while iteration < max_tool_iterations:
            iteration += 1

            # A named-company request with a known BI intent does not require
            # an external model to select its database tool (forces tool call).
            if verified_tool_call is not None and iteration == 1:
                response = AIProviderResponse(tool_calls=[verified_tool_call])
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
                        final_content = self._render_verified_answer(tool_name, tool_result, prompt=prompt)
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
                # Only generate artifacts once per unique tool name per turn to
                # prevent duplicate charts when the AI calls the same tool again
                # in a subsequent iteration (e.g. compare_companies loops).
                if tool_call.name not in tools_that_generated_artifacts:
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
                    if new_artifacts:
                        tools_that_generated_artifacts.add(tool_call.name)

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

        # Ensure assistant response is never empty
        if not final_content:
            if completed_tool_results:
                last_tool_name, last_tool_res = completed_tool_results[-1]
                final_content = self._render_verified_answer(last_tool_name, last_tool_res, prompt=prompt)
            elif extract_intent(normalize_prompt(prompt).casefold()) == "conceptual":
                final_content = generate_conceptual_narrative(prompt)
            else:
                final_content = "Analysis complete based on verified records."

        # Save Assistant message
        assistant_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        assistant_msg = Message(
            id=assistant_msg_id,
            conversation_id=conv.id,
            sender_role="assistant",
            content=final_content
        )
        self.repository.add_message(assistant_msg)

        # Stream words/tokens smoothly with ChatGPT/Claude-like typing cadence
        tokens = re.split(r'(\s+)', final_content)
        for token in tokens:
            if not token:
                continue
            yield AIStreamEvent(type="token", content=token, text=token)
            time.sleep(0.008)

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
