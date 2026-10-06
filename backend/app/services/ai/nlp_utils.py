"""
nlp_utils.py
============
Natural-language understanding helpers for TexVantage AI.

Provides:
  - fuzzy_match_company()  — tolerates typos, partial names, abbreviations
  - extract_intent()       — maps any phrasing to a canonical BI intent
  - extract_period()       — extracts a period in months from free text
  - normalize_prompt()     — lightweight domain spell-correction

Deliberately has NO external network calls and NO database access.
All functions are pure, deterministic, and safe to call on every user turn.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple, Any


# ---------------------------------------------------------------------------
# 1. FUZZY COMPANY MATCHER
# ---------------------------------------------------------------------------

def _company_candidates(company: Any) -> List[str]:
    """
    Builds all reasonable surface-form strings for one Company ORM row.

    IMPORTANT: Only multi-word or uniquely distinctive phrases are included.
    Single common words like "Mills", "Exports", "Textile" are deliberately
    excluded because they appear in multiple company names and cause false
    positive substring matches when companies are iterated alphabetically.

    Included candidates:
      - Full name:           "Textile I (Imperial Woolen Mills)"
      - Trade name:          "Imperial Woolen Mills"
      - Short code:          "IMPE"
      - First two words:     "Imperial Woolen"
      - City (if unique enough): "Ludhiana"
    """
    full_name: str = getattr(company, "name", "") or ""
    code: str = getattr(company, "code", "") or ""
    city: str = getattr(company, "city", "") or ""

    candidates = [full_name, code]

    # Extract prefix label before parenthetical: "Textile I (Imperial ...)" → "Textile I"
    prefix_match = re.match(r"^(.+?)\s*\(", full_name)
    if prefix_match:
        prefix = prefix_match.group(1).strip()
        if len(prefix) >= 2:
            candidates.append(prefix)

    # Extract parenthetical trade name: "Textile I (Imperial Woolen Mills)" → "Imperial Woolen Mills"
    parenthetical = re.findall(r"\(([^)]+)\)", full_name)
    candidates.extend(parenthetical)

    # Add multi-word prefix combinations (2+ words only) — never individual words
    for trade in parenthetical:
        words = [w for w in trade.split() if len(w) >= 3]
        # First two words joined: "Imperial Woolen"
        if len(words) >= 2:
            candidates.append(" ".join(words[:2]))
        # First three words joined: "Imperial Woolen Mills"
        if len(words) >= 3:
            candidates.append(" ".join(words[:3]))

    # City name helps for queries like "bangalore factory revenue"
    if city and len(city) >= 4:
        candidates.append(city)

    return [c.strip() for c in candidates if c and c.strip()]


def fuzzy_match_company(
    query: str,
    companies: List[Any],
    threshold: int = 60,
) -> Optional[Any]:
    """
    Returns the best-matching Company for *query*, or None if confidence < threshold.

    Strategy (in priority order):
    1. Exact substring match (fastest, handles "imperial woolen mills" verbatim)
    2. Rapidfuzz partial_ratio on all candidate strings (handles typos)
    3. Token-set ratio for word-order insensitivity (handles "mills imperial woolen")
    """
    if not query or not companies:
        return None

    query_lower = query.casefold().strip()

    try:
        from rapidfuzz import fuzz
    except ImportError:
        # Graceful degradation: fall back to simple substring check
        for company in companies:
            for cand in _company_candidates(company):
                if cand.casefold() in query_lower or query_lower in cand.casefold():
                    return company
        return None

    best_company = None
    best_score = 0.0

    for company in companies:
        candidates = _company_candidates(company)
        for cand in candidates:
            cand_lower = cand.casefold()

            # Exact substring — always wins
            if cand_lower in query_lower or query_lower in cand_lower:
                return company

            # Rapidfuzz scores
            score = max(
                fuzz.partial_ratio(query_lower, cand_lower),
                fuzz.token_set_ratio(query_lower, cand_lower),
                fuzz.WRatio(query_lower, cand_lower),
            )
            if score > best_score:
                best_score = score
                best_company = company

    return best_company if best_score >= threshold else None


def fuzzy_match_company_with_score(
    query: str,
    companies: List[Any],
) -> Tuple[Optional[Any], float]:
    """Same as fuzzy_match_company but also returns the confidence score."""
    if not query or not companies:
        return None, 0.0

    query_lower = query.casefold().strip()

    try:
        from rapidfuzz import fuzz
    except ImportError:
        for company in companies:
            for cand in _company_candidates(company):
                if cand.casefold() in query_lower or query_lower in cand.casefold():
                    return company, 100.0
        return None, 0.0

    best_company = None
    best_score = 0.0

    for company in companies:
        candidates = _company_candidates(company)
        for cand in candidates:
            cand_lower = cand.casefold()
            if cand_lower in query_lower or query_lower in cand_lower:
                return company, 100.0
            score = max(
                fuzz.partial_ratio(query_lower, cand_lower),
                fuzz.token_set_ratio(query_lower, cand_lower),
                fuzz.WRatio(query_lower, cand_lower),
            )
            if score > best_score:
                best_score = score
                best_company = company

    return best_company, best_score


def closest_company_name(query: str, companies: List[Any]) -> Optional[str]:
    """Returns the display name of the closest-matching company (for error suggestions)."""
    company, score = fuzzy_match_company_with_score(query, companies)
    if company and score >= 40:
        return getattr(company, "name", None)
    return None


# ---------------------------------------------------------------------------
# 2. INTENT EXTRACTOR
# ---------------------------------------------------------------------------

# Ordered list of (pattern-list, intent-name) tuples.
# First match wins — most specific patterns must come before broader ones.
_INTENT_PATTERNS: List[Tuple[List[str], str]] = [
    # --- Comparison / Ranking ---
    (
        ["compare", "vs ", " vs", "versus", "benchmark", "rank ", "ranking",
         "who earned more", "who made more", "better than", "worse than",
         "against each other", "side by side", "side-by-side", "all companies",
         "all mills", "all 10", "all ten", "portfolio"],
        "comparison",
    ),
    # --- Product / Category mix ---
    (
        ["product", "category", "categor", "fabric", "mix", "composition",
         "breakdown", "what sells", "best selling", "top item", "top product",
         "product line", "range"],
        "products",
    ),
    # --- Trend / Chart ---
    (
        ["trend", "over time", "month by month", "monthly", "trajectory",
         "chart", "graph", "plot", "visual", "show me", "draw"],
        "trend",
    ),
    # --- Growth ---
    (
        ["growth", "grew", "increase", "increas", "decrease", "declin",
         "went up", "went down", "change", "delta", "mom", "month over month",
         "yoy", "year over year"],
        "growth",
    ),
    # --- Profit / Margin ---
    (
        ["margin", "profit margin", "gross margin", "net margin",
         "profitability", "how profitable", "operating margin"],
        "margin",
    ),
    # --- Revenue / Sales (broad — must come after margin) ---
    (
        ["revenue", "sales", "turnover", "income", "earn", "made",
         "how much", "total", "gross", "receipts", "billing"],
        "revenue",
    ),
    # --- Profit (gross/net amount) ---
    (
        ["profit", "gross profit", "net profit", "ebitda", "pnl", "p&l",
         "profit and loss"],
        "profit",
    ),
    # --- Summary / KPI / Dashboard ---
    (
        ["summary", "overview", "kpi", "dashboard", "performance", "how is",
         "how are", "doing", "performing", "status", "brief", "report",
         "executive", "snapshot", "tell me about", "give me info",
         "what is happening", "whats happening"],
        "summary",
    ),
    # --- Dataset / Upload info ---
    (
        ["dataset", "uploaded", "file", "what data", "my data", "data i",
         "records", "how many records"],
        "datasets",
    ),
    # --- Units / Volume ---
    (
        ["units", "pieces", "volume", "quantity", "produced", "manufactured",
         "how many units"],
        "units",
    ),
    # --- Orders / AOV ---
    (
        ["order", "aov", "average order", "ticket size"],
        "orders",
    ),
]


def extract_intent(prompt: str) -> str:
    """
    Returns a canonical intent string from free-text prompt.
    Falls back to "summary" if nothing matches.
    """
    p = normalize_prompt(prompt).casefold()
    for patterns, intent in _INTENT_PATTERNS:
        if any(pat in p for pat in patterns):
            return intent
    return "summary"


# ---------------------------------------------------------------------------
# 3. PERIOD EXTRACTOR
# ---------------------------------------------------------------------------

def extract_period(prompt: str) -> int:
    """
    Extracts a reporting period in months from free-text.
    Returns an integer number of months.
    """
    p = prompt.casefold()

    # Explicit "N month(s)" pattern
    m = re.search(r"\b(\d{1,2})\s*[-\s]?month", p)
    if m:
        return max(1, min(int(m.group(1)), 60))

    # Named periods
    if any(t in p for t in ("annual", "full year", "whole year", "last year", "past year", "twelve month", "ytd", "year to date")):
        return 12
    if any(t in p for t in ("half year", "half-year", "6 month", "six month", "last 6", "past 6")):
        return 6
    if any(t in p for t in ("quarter", "3 month", "three month", "last 3", "past 3", "q1", "q2", "q3", "q4")):
        return 3
    if any(t in p for t in ("last month", "this month", "previous month", "current month")):
        return 1
    if any(t in p for t in ("two month", "2 month", "last 2")):
        return 2

    # Default: 6 months
    return 6


# ---------------------------------------------------------------------------
# 4. PROMPT NORMALIZER
# ---------------------------------------------------------------------------

# Common domain-specific typos → corrections.
# Only correct tokens that are unambiguous in the textile/finance domain.
_TYPO_MAP: dict[str, str] = {
    # Finance terms
    "revnue": "revenue",
    "reveneu": "revenue",
    "reveue": "revenue",
    "revenu": "revenue",
    "revuene": "revenue",
    "proffit": "profit",
    "profut": "profit",
    "margn": "margin",
    "mrgin": "margin",
    "salse": "sales",
    "saels": "sales",
    "growht": "growth",
    "grwoth": "growth",
    "groth": "growth",
    "turover": "turnover",
    "turnver": "turnover",
    "earnigs": "earnings",
    "ernings": "earnings",
    "performace": "performance",
    "preformance": "performance",
    "performnce": "performance",
    "summry": "summary",
    "summery": "summary",
    "anlaysis": "analysis",
    "anlysis": "analysis",
    "anaylsis": "analysis",
    "comparsion": "comparison",
    "comparision": "comparison",
    "statistic": "statistics",
    # Textile terms
    "textil": "textile",
    "textille": "textile",
    "textlie": "textile",
    "woolen": "woolen",
    "woollen": "woolen",
    "wolen": "woolen",
    "wollen": "woolen",
    "spinnrs": "spinners",
    "spiner": "spinners",
    "spinnors": "spinners",
    "garmet": "garment",
    "garmant": "garment",
    "garmnet": "garment",
    "expot": "exports",
    "expirts": "exports",
    "orgnic": "organic",
    "organik": "organic",
    "fabrik": "fabric",
    "fabrick": "fabric",
    "denm": "denim",
    "dinom": "denim",
    "handlom": "handloom",
    "handleom": "handloom",
    "furnising": "furnishing",
    "furnishig": "furnishing",
    "imprial": "imperial",
    "imperail": "imperial",
    "imperiel": "imperial",
    "imperal": "imperial",
    # Temporal
    "monht": "month",
    "monh": "month",
    "mnths": "months",
    "quaterly": "quarterly",
    "quaretly": "quarterly",
    "yerly": "yearly",
    "anual": "annual",
    "annaul": "annual",
    "lastmonth": "last month",
    "lastquarter": "last quarter",
    "lastyear": "last year",
}


def normalize_prompt(prompt: str) -> str:
    """
    Applies lightweight domain-specific spell correction to a user prompt.
    Only corrects tokens in the known typo dictionary; never alters company
    names or other tokens not in the map.
    """
    if not prompt:
        return prompt

    tokens = prompt.split()
    corrected = []
    for token in tokens:
        # Strip punctuation for lookup but preserve original punctuation
        stripped = token.strip(".,!?;:\"'()")
        lower = stripped.casefold()
        if lower in _TYPO_MAP:
            # Preserve original capitalisation style
            replacement = _TYPO_MAP[lower]
            if stripped.isupper():
                replacement = replacement.upper()
            elif stripped[0].isupper():
                replacement = replacement.capitalize()
            corrected.append(token.replace(stripped, replacement))
        else:
            corrected.append(token)

    return " ".join(corrected)


# ---------------------------------------------------------------------------
# 5. HELPER — extract company-name fragment from prompt for error messages
# ---------------------------------------------------------------------------

def extract_requested_name(prompt: str) -> Optional[str]:
    """
    Attempts to isolate the company-name fragment a user typed.
    Used for building helpful 'did you mean?' error messages.
    """
    p = normalize_prompt(prompt)
    # Patterns like "... of Imperial Woolen ..." or "... for Apex ..."
    m = re.search(
        r"\b(?:for|of|about|on)\s+(.+?)(?:\s+(?:over|during|in|with|last|this|give|show)\b|[?.!,]|$)",
        p,
        flags=re.IGNORECASE,
    )
    if m:
        name = m.group(1).strip(" ,.")
        if len(name) >= 3 and not name.casefold().startswith(("the ", "all ", "my ")):
            return name

    # Fallback: look for a run of Title-cased words (likely a proper noun)
    title_run = re.findall(r"(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", p)
    if title_run:
        return title_run[0]

    return None
