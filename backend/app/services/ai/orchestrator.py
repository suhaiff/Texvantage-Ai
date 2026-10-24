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

SYSTEM_PROMPT_TEMPLATE = """# TEXVANTAGE AI — MASTER BUSINESS INTELLIGENCE & REASONING ENGINE

You are TexVantage AI — an enterprise-grade Master Business Intelligence & Reasoning Assistant for executive leadership, financial analysts, operations directors, and commercial teams.

TENANT & IDENTITY CONTEXT:
- Authenticated User: {user_name} ({user_role})
- Assigned Company Context: {company_scope}

BUSINESS KNOWLEDGE & POLICIES:
{knowledge_text}

================================================================================
MASTER BUSINESS INTELLIGENCE & REASONING RULES (SECTIONS 1–16)
================================================================================

1. MISSION & ROLE:
Behave like an experienced financial analyst, business intelligence consultant, operations manager, and executive advisor combined. Deliver correct, evidence-based, comprehensive, and actionable business insights — not merely generate impressive-looking reports.

2. UNDERSTAND THE BUSINESS BEFORE ANSWERING:
- Identify the business entity, metric, relevant time period, and conditions before querying.
- Strictly distinguish between companies, financial accounts, customers/buyers, suppliers, products, inventory items, transactions, and departments.
- NEVER treat two different concepts as interchangeable merely because their names are similar.
- If the user asks for account names and types, return actual financial ledger accounts. Do NOT substitute company names or invented specializations.
- If a term is genuinely ambiguous and materially alters the result, ask a concise clarification. Otherwise, state your reasonable assumption explicitly.

3. ANSWER FROM EVIDENCE, NEVER ASSUMPTIONS:
Follow the strict lifecycle: Question → Understand → Retrieve Evidence → Validate → Calculate → Interpret → Answer.
NEVER invent:
- Companies, account codes, customers, suppliers, or products.
- Revenue, expenses, profits, margins, balances, or growth rates.
- Capacity utilization, efficiency, or operational metrics without backing data.
- Reasons for business outcomes not grounded in retrieved data.
If the database cannot establish an answer, state what is missing and why. Never claim information is verified or audited unless verified records were fetched.

4. MANDATORY BUSINESS CALCULATIONS (FORMULAS MUST BE ADHERED TO):
- Gross Profit = Revenue − Cost of Goods Sold (COGS).
- Gross Profit Margin (%) = (Gross Profit ÷ Revenue) × 100.
- Revenue Contribution (%) = (Entity Revenue ÷ Total Portfolio Revenue) × 100.
- Period Growth (%) = ((Current Value − Prior Value) ÷ Prior Value) × 100.
- Weighted Portfolio Margin (%) = (Aggregate Portfolio Gross Profit ÷ Aggregate Portfolio Revenue) × 100. NEVER average company margin percentages unless explicitly requested!
- Reconcile all subtotals to displayed totals. Avoid double-counting transactions or amounts introduced by joins.

5. TIME PERIODS MUST BE PRECISE:
- Disclose exact date boundaries for financial reports.
- Compare equivalent consecutive or year-over-year periods (like-for-like).
- If historical data is incomplete, state the limitation rather than silently shortening the period.

6. EXECUTIVE-QUALITY ANSWER STRUCTURE:
For complex questions, use this structure:
### Executive Summary
State the primary takeaway and single most important business finding in bold.
### Key Metrics
Present relevant totals, margins, comparisons, and rankings with exact figures.
### Supporting Breakdown
Detailed company-, account-, product-, customer-, or period-level analysis.
### Trends and Observations
Explain meaningful increases, declines, differences, or anomalies supported by evidence.
### Business Implications
What the findings mean for working capital, profitability, or risk (distinguish verified facts from hypotheses).
### Recommended Actions
Specific, prioritized, actionable business recommendations.
### Data Limitations & Provenance
Explicitly disclose any unverified assumptions, missing COGS, or data boundaries.
(For simple factual questions, provide direct, concise answers without unnecessary sections.)

7. MULTI-TURN CONVERSATION INTELLIGENCE:
- Maintain analytical context across conversational turns.
- If user asks "Show revenue for all companies over last 6 months" and follows with "Now show only top three", preserve the 6-month period and revenue metric while applying the ranking filter.
- If user asks "Which company had the highest revenue?" followed by "Why did it decline?", preserve the identified company and investigate the historical trend using underlying records.

8. ROOT CAUSE & CROSS-FUNCTIONAL INVESTIGATION:
- When asked "Why did it decline?" or "Why did margin drop?", investigate underlying components (e.g. price, volume, COGS, product mix, customer concentration).
- Distinguish correlation from causation. Do not claim a root cause simply because two numbers changed together.

9. DYNAMIC SCHEMA DISCOVERY & FUTURE-PROOF DATABASE INTELLIGENCE (SECTION 16):
- TexVantage AI is connected to a live database containing 2,000+ tables and views spanning all business domains (Finance, Sales, Procurement, Inventory, Production, Quality, HR).
- You are NEVER restricted to a hardcoded list of known tables.
- When a user asks about tables, views, or business domains you have not yet inspected (e.g. ProductionOrders, Invoice_Export, EmployeeAttendance, QualityInspection, Buyer, Style):
  1. Use `discover_database_schema` to locate relevant tables.
  2. Use `inspect_table_schema` to inspect columns, data types, primary keys, foreign keys, and sample rows.
  3. Use `validate_table_join` before joining tables to prevent Cartesian duplicate multiplication and verify foreign keys.
  4. Use `execute_sql_query` to retrieve verified records using safe read-only SQL.
  5. If user asks "What data can you analyze?" or "What tables exist?", call `summarize_database_capabilities`.
10. INTELLIGENT, QUESTION-DRIVEN VISUALIZATION ENGINE (SECTION 17):
- Whenever a user asks a question that would benefit from visual representation, generate the visualization that best answers that exact question.
- Never use the same generic chart template for every question. Never generate a chart merely to fill space.
- Match visual format strictly to analytical purpose:
  * Ranking (e.g. "Which companies generate the most revenue?", "Highest profit margins") -> Sorted Horizontal Bar Chart ('horizontal_bar').
  * Trends over time (e.g. "How has revenue changed over last 12 months?", "Monthly sales trajectory") -> Chronological Line or Area Chart ('line' or 'area').
  * Comparisons (e.g. "Revenue versus expenditure", "Profit vs Revenue across mills") -> Grouped Multi-Series Bar Chart ('bar') with clear legend.
  * Composition & Share (e.g. "Product line share", "Category breakdown" with <= 6 items) -> Donut Chart ('donut').
  * Detailed Records & Raw Ledger (e.g. "Show me the detailed account records", "List transaction rows") -> Structured Data Table ONLY. Do NOT generate an unnecessary or redundant chart!
  * Single key metric -> Compact KPI card with period, context, and change rate.
- Chart titles must be descriptive and question-grounded: Include the metric, dimensions, and timeframe (e.g. "Top 3 Textile Enterprises Ranked by Gross Profit Margin (%) — 6-Month Period", never generic "Bar Chart").
- Accompany every visualization with a concise business explanation interpreting what the chart shows, highlighting key leaders, laggards, and inflection points.
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
        2. Schema and database capabilities detection (Section 16)
        3. Fuzzy company matching (handles partial names, typos, abbreviations)
        4. Semantic intent extraction (30+ phrase patterns)
        5. Period extraction (month count from free text)
        """
        normalized = normalize_prompt(prompt)
        prompt_lower = normalized.casefold()
        months = extract_period(prompt_lower)
        intent = extract_intent(prompt_lower)

        # --- Dynamic Schema & Database Discovery (Section 16) ---
        if any(p in prompt_lower for p in (
            "what data can you analyze", "what can you analyze", "database capabilities",
            "what data is available", "what tables exist", "summarize database",
            "show database capabilities", "what data do you have"
        )):
            return AIToolCall(name="summarize_database_capabilities", arguments={})

        if any(p in prompt_lower for p in ("discover schema", "find tables", "search tables", "show tables matching", "list tables")):
            m = re.search(r"(?:for|about|matching|like|in)\s+([a-zA-Z0-9_]+)", prompt_lower)
            kw = m.group(1) if m else None
            return AIToolCall(name="discover_database_schema", arguments={"keyword": kw} if kw else {})

        if any(p in prompt_lower for p in ("inspect table", "schema of", "describe table", "columns in table")):
            m = re.search(r"(?:table|of|in)\s+([a-zA-Z0-9_]+)", prompt_lower)
            tbl = m.group(1) if m else None
            if tbl and tbl not in ("the", "all", "schema", "database"):
                return AIToolCall(name="inspect_table_schema", arguments={"table_names": [tbl]})

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
            if not matched_company and (_has_bi_keyword or any(w in prompt_lower for w in ("location", "located", "where", "city", "headquarter", "profile", "specializ"))) and intent in ("revenue", "profit", "margin", "summary", "trend", "growth", "profile"):
                if intent == "profile" or any(w in prompt_lower for w in ("location", "located", "where", "city", "headquarter")):
                    return AIToolCall(
                        name="compare_companies",
                        arguments={
                            "company_ids": [c.id for c in companies],
                            "period_months": months,
                        },
                    )
                return AIToolCall(name="get_global_summary", arguments={"period_months": months})

        # --- Single-company routing ---
        if not matched_company:
            return None

        company_id = matched_company.id

        # Company profile / location / background / metadata
        if intent == "profile":
            return AIToolCall(
                name="get_company_summary",
                arguments={"company_id": company_id},
            )

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
        Does NOT block schema discovery, database tables, or general business entity queries.
        """
        normalized = normalize_prompt(prompt)
        prompt_lower = normalized.casefold()

        # If user is asking about database, schema, tables, queries, or general business concepts,
        # never treat it as an unrecognized company error! (Sections 2 & 16)
        SCHEMA_KEYWORDS = {
            "table", "tables", "view", "views", "schema", "database", "query", "queries",
            "order", "orders", "production", "attendance", "employee", "payroll", "supplier",
            "suppliers", "vendor", "vendors", "inventory", "stock", "invoice", "invoices",
            "buyer", "buyers", "customer", "customers", "account", "accounts", "ledger",
            "quality", "inspection", "defect", "data", "records", "columns", "analyze",
            "capabilities", "what data", "all", "what can you", "how many", "list", "dataset"
        }
        if any(sk in prompt_lower for sk in SCHEMA_KEYWORDS):
            return None

        requested_name = extract_requested_name(normalized)
        if not requested_name:
            return None
        if len(requested_name) < 3 or requested_name.casefold().startswith(("the ", "all ", "my ")):
            return None

        # If requested name matches common table patterns (e.g. CamelCase or snake_case table name without spaces), pass to schema discovery
        if "_" in requested_name or (" " not in requested_name and any(c.isupper() for c in requested_name[1:])):
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

        # Update conversation title in database if default
        if conv.title in ("Business Intelligence Consultation", "New Conversation"):
            trimmed = prompt[:45] + ("..." if len(prompt) > 45 else "")
            self.repository.update_conversation_title(conv.id, self.user.id, trimmed)
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

        # Resolve contextual pronoun or follow-up before tool selection
        effective_prompt = prompt
        companies_scope = self.repository.get_companies(
            None if self.user.is_admin() else [self.user.company_id]
        )
        has_explicit_company = fuzzy_match_company(normalize_prompt(prompt), companies_scope) is not None

        if len(raw_messages) >= 2:
            prompt_cf = prompt.casefold()
            # Multi-Turn Context Retention (Section 9):
            # Preserves previous reporting period, metric, and filters across follow-ups
            # E.g. "Now show only top three" or "Why did it decline?"
            last_user_msgs = [m for m in raw_messages if m.sender_role == "user"]
            prev_user_prompt = last_user_msgs[-2].content if len(last_user_msgs) >= 2 else ""
            assistant_msgs = [m for m in raw_messages if m.sender_role == "assistant"]
            last_assistant_msg = assistant_msgs[-1].content if assistant_msgs else ""

            is_ranking_refinement = any(phrase in prompt_cf for phrase in (
                "top two", "top 2", "top three", "top 3", "top four", "top 4", "top five", "top 5",
                "only top", "just top", "show top", "top 10", "lowest 3", "bottom 3"
            )) and not any(term in prompt_cf for term in ("revenue", "margin", "profit", "sales", "month"))

            if is_ranking_refinement and prev_user_prompt:
                # Retain the metric and period from previous query
                prev_months = extract_period(prev_user_prompt.casefold())
                metric_match = re.search(r"(profit margin|gross margin|margin|profit|revenue|sales|growth|units)", prev_user_prompt.casefold())
                metric_name = metric_match.group(1) if metric_match else "profit margin"
                effective_prompt = f"{prompt} by {metric_name} across companies over last {prev_months} months"

            elif not has_explicit_company:
                has_pronoun = any(
                    re.search(r"\b" + re.escape(w) + r"\b", prompt_cf)
                    for w in ("it", "its", "it's", "they", "their", "this company", "this mill", "that company", "that mill", "the company", "the mill", "here", "there")
                )
                is_decline_followup = any(w in prompt_cf for w in ("why did it", "why did they", "why decline", "why did revenue", "what caused", "why drop"))
                is_attribute_query = any(w in prompt_cf for w in (
                    "where", "location", "located", "address", "city", "state", "place",
                    "specializ", "capacity", "founded", "established", "who is",
                    "revenue", "sales", "margin", "profit", "growth", "units", "trend"
                ))
                is_explicit_portfolio = any(w in prompt_cf for w in (
                    "all companies", "all mills", "across mills", "every company", "every mill",
                    "portfolio", "compare all", "which companies", "which mills"
                ))

                if (has_pronoun or is_attribute_query or is_decline_followup) and not is_explicit_portfolio:
                    prev_company = None
                    if prev_user_prompt:
                        prev_company, prev_score = fuzzy_match_company_with_score(normalize_prompt(prev_user_prompt), companies_scope)
                        if not prev_company or prev_score < 60:
                            prev_company = None
                    if not prev_company and last_assistant_msg:
                        prev_company, prev_score = fuzzy_match_company_with_score(normalize_prompt(last_assistant_msg), companies_scope)
                        if not prev_company or prev_score < 60:
                            prev_company = None
                    if prev_company:
                        if is_decline_followup:
                            effective_prompt = f"Why did revenue and profit margin decline for {prev_company.name}?"
                        else:
                            effective_prompt = f"{prev_company.name} {prompt}"

        verified_tool_call = self._build_verified_tool_call(effective_prompt)

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
                        user_prompt=effective_prompt
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
            content=final_content,
            thinking_steps_json=json.dumps([t[0] for t in completed_tool_results]) if completed_tool_results else None
        )
        self.repository.add_message(assistant_msg)

        # Persist captured artifacts so they reload on subsequent conversation views
        for art in captured_artifacts:
            try:
                art_id = art.get("id") or f"art_{uuid.uuid4().hex[:12]}"
                artifact_model = Artifact(
                    id=art_id,
                    company_id=self.user.company_id,
                    artifact_type=art.get("type", "chart"),
                    title=art.get("title", "Analysis Artifact"),
                    payload_json=json.dumps(art, default=str)
                )
                self.repository.save_artifact(artifact_model, message_id=assistant_msg_id)
            except Exception as e:
                logger.error(f"Failed to persist artifact {art}: {e}")

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
