from typing import List, Dict, Any, Optional
import uuid
from .provider import AIProvider, AIProviderResponse, AIToolCall
from .nlp_utils import extract_intent, extract_period, normalize_prompt


class MockAIProvider(AIProvider):
    """
    Deterministic Mock AI Provider for automated tests and offline simulation.
    Uses the shared NLP pipeline (nlp_utils) so it handles the same range of
    natural-language phrasings as the production Gemini path.
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

        # If the last message is a function response (tool result), produce a
        # clean natural-language wrap — do NOT echo the raw JSON dict.
        if role in ("function", "tool"):
            return AIProviderResponse(
                content="Based on verified business records, I have generated the requested analysis below.",
                tool_calls=[]
            )

        # Normalise and extract intent from the user prompt
        normalized = normalize_prompt(raw_content)
        content = normalized.casefold()
        intent = extract_intent(content)
        months = extract_period(content)

        # --- Conceptual / definitional queries ---
        if any(w in content for w in [
            "what is gross margin", "what is capacity utilization",
            "explain margin", "what is cogs", "define ", "meaning of",
            "what does", "what are",
        ]):
            return AIProviderResponse(
                content=(
                    "Gross margin is the percentage of revenue remaining after subtracting "
                    "direct cost of goods sold (COGS). It reflects core manufacturing efficiency."
                ),
                tool_calls=[]
            )

        # --- Route by intent using shared NLP ---
        if intent == "datasets" or any(p in content for p in ("uploaded", "what data have i", "how many records")):
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_uploaded_datasets_info",
                    arguments={}
                )]
            )

        if intent == "products":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_top_products",
                    arguments={"limit": 10}
                )]
            )

        if intent == "trend":
            tool_name = "get_profit_trend" if any(t in content for t in ("profit", "margin")) else "get_sales_trend"
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name=tool_name,
                    arguments={"months": months}
                )]
            )

        if intent == "comparison":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="compare_companies",
                    arguments={"company_ids": [], "period_months": months}
                )]
            )

        if intent == "growth":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "growth", "period": "latest"}
                )]
            )

        if intent == "revenue":
            period = "last_6_months" if months == 6 and any(
                t in content for t in ("total", "last 6", "6 month", "six month", "past 6")
            ) else "latest"
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "revenue", "period": period}
                )]
            )

        if intent == "profit":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "gross_profit", "period": "latest"}
                )]
            )

        if intent == "margin":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "margin", "period": "latest"}
                )]
            )

        if intent == "units":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "units", "period": "latest"}
                )]
            )

        if intent == "orders":
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "aov", "period": "latest"}
                )]
            )

        # Default: executive summary / portfolio overview
        if "global" in content or "across all" in content or "portfolio" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_global_summary",
                    arguments={"period_months": months}
                )]
            )

        # Fallback: company summary
        return AIProviderResponse(
            content=None,
            tool_calls=[AIToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="get_company_summary",
                arguments={}
            )]
        )
