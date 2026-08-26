from typing import List, Dict, Any, Optional
import uuid
from .provider import AIProvider, AIProviderResponse, AIToolCall

class MockAIProvider(AIProvider):
    """
    Deterministic Mock AI Provider for automated tests and offline simulation.
    Demonstrates multi-turn tool calling without requiring live external network requests.
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
        content = str(last_msg.get("content", "")).lower()

        # If the last message is a function response (from a tool execution), generate final natural language summary
        if role in ("function", "tool"):
            tool_data = last_msg.get("content", {})
            return AIProviderResponse(
                content=f"Based on verified business records, here is the result: {tool_data}",
                tool_calls=[]
            )

        # Conceptual / general business definitions (Part 10)
        if any(w in content for w in ["what is gross margin", "what is capacity utilization", "explain margin", "what is cogs"]):
            return AIProviderResponse(
                content="Gross margin is the percentage of revenue remaining after subtracting direct cost of goods sold (COGS). It reflects core manufacturing efficiency.",
                tool_calls=[]
            )

        # Pattern match user intents to trigger realistic tool calls for offline testing
        if any(phrase in content for phrase in ["uploaded", "what data have i", "dataset", "period does my data", "how many records"]):
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_uploaded_datasets_info",
                    arguments={}
                )]
            )
        elif "highest revenue" in content or "peak" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_company_summary",
                    arguments={}
                )]
            )
        elif "compare" in content:
            if "textile b" in content and "textile c" in content:
                comps = ["comp_textile_a", "comp_textile_b", "comp_textile_c"]
            elif "textile b" in content or "textile a" in content:
                comps = ["comp_textile_a", "comp_textile_b"]
            else:
                comps = ["comp_textile_a", "comp_textile_b"]
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="compare_companies",
                    arguments={"company_ids": comps, "period_months": 6}
                )]
            )
        elif "profit margin" in content or "margin" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "margin", "period": "latest"}
                )]
            )
        elif "sales" in content or "revenue" in content or "last month" in content or "this month" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="calculate_metric",
                    arguments={"metric_type": "revenue", "period": "latest"}
                )]
            )
        elif "global" in content or "across all" in content or "total revenue" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_global_summary",
                    arguments={"period_months": 6}
                )]
            )
        elif "top product" in content or "fabric" in content or "category" in content:
            return AIProviderResponse(
                content=None,
                tool_calls=[AIToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="get_top_products",
                    arguments={"limit": 5}
                )]
            )
        else:
            # General business question (Part 10)
            return AIProviderResponse(
                content="Gross margin is the percentage of revenue remaining after subtracting direct cost of goods sold (COGS). It reflects core manufacturing efficiency.",
                tool_calls=[]
            )
