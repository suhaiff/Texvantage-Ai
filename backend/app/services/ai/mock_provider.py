from typing import List, Dict, Any, Optional
import uuid
import json
from .provider import AIProvider, AIProviderResponse, AIToolCall
from .nlp_utils import extract_intent, extract_period, normalize_prompt
from .narrative_generator import generate_narrative_from_tool_result, generate_conceptual_narrative


class MockAIProvider(AIProvider):
    """
    Deterministic Mock AI Provider for automated tests and offline simulation.
    Uses the shared NLP pipeline (nlp_utils) so it handles the same range of
    natural-language phrasings as the production Gemini path.
    Produces rich, ChatGPT/Claude-style analytical narratives for every query angle.
    """

    def __init__(self, canned_responses: Optional[Dict[str, Any]] = None):
        self.canned_responses = canned_responses or {}

    def is_configured(self) -> bool:
        return True

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        system_instruction: Optional[str] = None
    ) -> AIProviderResponse:
        last_msg = messages[-1] if messages else {}
        role = last_msg.get("role", "")
        raw_content = str(last_msg.get("content", ""))

        user_prompt = next(
            (str(m.get("content", "")) for m in reversed(messages) if m.get("role") == "user"),
            raw_content
        )

        # ── If the last message is a tool result, generate deep dynamic analysis ──
        if role in ("function", "tool"):
            responses = last_msg.get("responses") or []

            for resp in responses:
                tool_name = resp.get("name")
                raw_json = resp.get("content", "{}")
                try:
                    data = json.loads(raw_json)
                except Exception:
                    data = {}

                return AIProviderResponse(
                    content=generate_narrative_from_tool_result(tool_name, data, prompt=user_prompt),
                    tool_calls=[]
                )

            return AIProviderResponse(
                content="### Analysis Complete\n\nThe verified database query was executed successfully. The detailed results are shown in the interactive view below.",
                tool_calls=[]
            )

        # ── Route user prompt to the correct tool ─────────────────────────────
        normalized = normalize_prompt(raw_content)
        content = normalized.casefold()
        intent = extract_intent(content)
        months = extract_period(content)

        # Conceptual / educational queries (no tool call needed)
        if intent == "conceptual" or any(w in content for w in [
            "what is capacity utilization", "how does capacity utilization",
            "what is gross margin", "explain gross margin", "what is cogs",
            "how to improve margin", "how can we improve", "difference between",
        ]):
            return AIProviderResponse(
                content=generate_conceptual_narrative(raw_content),
                tool_calls=[]
            )

        # Dynamic schema & database capabilities (Section 16)
        if any(p in content for p in ("what data can you analyze", "database capabilities", "what data is available", "what tables exist", "summarize database", "what can you analyze")):
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="summarize_database_capabilities", arguments={})]
            )

        if any(p in content for p in ("discover schema", "find tables", "search tables", "list tables")):
            m = re.search(r"(?:for|about|matching|like|in)\s+([a-zA-Z0-9_]+)", content)
            kw = m.group(1) if m else None
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="discover_database_schema", arguments={"keyword": kw} if kw else {})]
            )

        if any(p in content for p in ("inspect table", "schema of", "describe table", "columns in table")):
            m = re.search(r"(?:table|of|in)\s+([a-zA-Z0-9_]+)", content)
            tbl = m.group(1) if m else None
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="inspect_table_schema", arguments={"table_names": [tbl] if tbl else []})]
            )

        if intent == "datasets" or any(p in content for p in ("uploaded", "what data have i", "how many records")):
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="get_uploaded_datasets_info", arguments={})]
            )

        if intent == "products":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="get_top_products", arguments={"limit": 10})]
            )

        if intent == "trend":
            tool_name = "get_profit_trend" if any(t in content for t in ("profit", "margin")) else "get_sales_trend"
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name=tool_name, arguments={"months": months})]
            )

        if intent == "comparison":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="compare_companies", arguments={"company_ids": [], "period_months": months})]
            )

        if intent == "growth":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "growth", "period": "latest"})]
            )

        if intent == "revenue":
            period = "last_6_months" if months == 6 and any(
                t in content for t in ("total", "last 6", "6 month", "six month", "past 6")
            ) else "latest"
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "revenue", "period": period})]
            )

        if intent == "profit":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "gross_profit", "period": "latest"})]
            )

        if intent == "margin":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "margin", "period": "latest"})]
            )

        if intent == "units":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "units", "period": "latest"})]
            )

        if intent == "orders":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="calculate_metric", arguments={"metric_type": "aov", "period": "latest"})]
            )

        # Default portfolio overview
        if "global" in content or "across all" in content or "portfolio" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="get_global_summary", arguments={"period_months": months})]
            )

        # Fallback: company summary
        return AIProviderResponse(
            content=None,
            tool_calls=[AIToolCall(id=f"call_{uuid.uuid4().hex[:8]}", name="get_company_summary", arguments={})]
        )
