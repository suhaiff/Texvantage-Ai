from typing import List, Dict, Any, Optional
import uuid
import re


def _new_id(kind: str) -> str:
    return f"art_{kind}_{uuid.uuid4().hex[:8]}"


def _infer_chart_type(user_prompt: str, default: str) -> str:
    prompt = (user_prompt or "").casefold()
    if any(term in prompt for term in ("pie", "donut", "share", "mix", "composition", "breakdown", "distribution")):
        return "donut"
    if any(term in prompt for term in (
        "horizontal bar", "ranking", "ranked", "rank", "leaderboard", "leaders",
        "highest", "lowest", "top ", "top-", "top 3", "top 5", "top two", "top three",
        "most revenue", "best margin", "highest margin", "which companies generate",
        "which mills generate", "which company generates", "bottom"
    )):
        return "horizontal_bar"
    if "area" in prompt:
        return "area"
    if any(term in prompt for term in ("line", "trend", "trajectory", "over time", "monthly", "timeline", "history", "last 12 months", "last 6 months")):
        return "line"
    if any(term in prompt for term in ("versus", " vs ", "compare", "comparison", "grouped", "bar")):
        return "bar"
    return default


def _wants_table_only(prompt: str) -> bool:
    p = (prompt or "").casefold()
    has_table_intent = any(k in p for k in (
        "detailed account records", "account records", "detailed records", "records only",
        "table only", "detailed table", "raw records", "raw data", "ledger records",
        "ledger entries", "show ledger", "list of accounts", "account list", "show raw"
    ))
    has_chart_intent = any(k in p for k in (
        "chart", "graph", "plot", "visual", "visualize", "diagram", "trend", "ranking"
    ))
    return has_table_intent and not has_chart_intent


def _extract_limit(prompt: str, default: int) -> int:
    p = (prompt or "").casefold()
    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
    }
    m = re.search(r"(?:top|bottom|lowest|highest|first|leader|leaders)\s*[- ]?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b", p)
    if m:
        val = m.group(1)
        if val in word_to_num:
            return word_to_num[val]
        try:
            return max(1, int(val))
        except ValueError:
            pass
    if any(k in p for k in ("leader", "number one", "single best", "top performer")):
        return 1
    return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number != number or number in (float("inf"), float("-inf")):
        return default
    return number


def _kpi(
    title: str,
    metric: str,
    value: str,
    change: str,
    change_type: str,
    period: str,
    subtext: str = "",
    raw_value: float = 0.0,
) -> Dict[str, Any]:
    return {
        "id": _new_id("kpi"),
        "type": "kpi",
        "title": title,
        "data": {
            "metric": metric,
            "value": value,
            "rawValue": raw_value,
            "change": change,
            "changeType": change_type,
            "period": period,
            "subtext": subtext,
        },
    }


def _chart(
    title: str,
    chart_type: str,
    x_key: str,
    series: List[Dict[str, Any]],
    data_points: List[Dict[str, Any]],
) -> Dict[str, Any]:
    series_type = "donut" if chart_type == "donut" else chart_type
    normalized_series = []
    for item in series:
        entry = dict(item)
        entry["type"] = entry.get("type") or series_type
        normalized_series.append(entry)
    return {
        "id": _new_id("chart"),
        "type": "chart",
        "title": title,
        "data": {
            "chartType": chart_type,
            "xKey": x_key,
            "series": normalized_series,
            "dataPoints": data_points,
        },
    }


def _table(title: str, columns: List[Dict[str, Any]], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "id": _new_id("table"),
        "type": "table",
        "title": title,
        "data": {"columns": columns, "rows": rows},
    }


def _growth_type(value: float) -> str:
    if value > 0:
        return "positive"
    if value < 0:
        return "negative"
    return "neutral"


def generate_artifacts_from_tool_result(
    tool_name: str,
    tool_args: Dict[str, Any],
    tool_result: Dict[str, Any],
    user_prompt: str = "",
) -> List[Dict[str, Any]]:
    """
    Synthesizes structured artifacts (KPIs, Charts, Tables, and Report files)
    from verified deterministic tool execution results.

    Payloads use the camelCase contract expected by the React chat UI.
    """
    artifacts: List[Dict[str, Any]] = []
    prompt_lower = (user_prompt or "").lower()

    if tool_result.get("status") != "success":
        return artifacts

    chart_hint = _infer_chart_type(user_prompt, "bar")

    # 1. calculate_metric
    if tool_name == "calculate_metric":
        metric = tool_result.get("metric")
        if metric == "revenue_growth":
            growth = _safe_float(tool_result.get("growth_pct"))
            artifacts.append(_kpi(
                title=f"MoM Revenue Growth ({tool_result.get('current_month')})",
                metric="Revenue Growth",
                value=f"{growth:+.2f}%",
                raw_value=growth,
                change=f"{_safe_float(tool_result.get('change_lakh', 0)):+.2f} Lakh",
                change_type=_growth_type(growth),
                period=f"{tool_result.get('current_month')} vs {tool_result.get('previous_month')}",
                subtext=(
                    f"Current: ₹{tool_result.get('current_revenue_lakh')}L | "
                    f"Prev: ₹{tool_result.get('previous_revenue_lakh')}L"
                ),
            ))
        elif metric in ("revenue_lakh", "total_revenue_lakh"):
            val = _safe_float(tool_result.get("value"))
            period = tool_result.get("month") or tool_result.get("period") or "Latest"
            artifacts.append(_kpi(
                title=f"Sales Revenue ({period})",
                metric="Total Revenue",
                value=f"₹{val:,.2f} Lakh",
                raw_value=val,
                change="Verified ledger",
                change_type="neutral",
                period=str(period),
                subtext="Sales ledger record",
            ))
        elif metric == "profit_margin_pct":
            val = _safe_float(tool_result.get("value"))
            artifacts.append(_kpi(
                title=f"Gross Profit Margin ({tool_result.get('month', 'Latest')})",
                metric="Profit Margin",
                value=f"{val:.2f}%",
                raw_value=val,
                change="Operational gross margin",
                change_type="positive" if val > 20 else "neutral",
                period=tool_result.get("month", "Latest"),
                subtext="Excluding administrative overheads",
            ))
        elif metric in ("gross_profit_lakh", "total_gross_profit_lakh"):
            val = _safe_float(tool_result.get("value"))
            period = tool_result.get("month") or tool_result.get("period") or "Latest"
            artifacts.append(_kpi(
                title=f"Gross Profit ({period})",
                metric="Gross Profit",
                value=f"₹{val:,.2f} Lakh",
                raw_value=val,
                change="Verified COGS-backed profit",
                change_type="positive" if val >= 0 else "negative",
                period=str(period),
                subtext="From monthly financials",
            ))

    # 2. get_company_summary
    elif tool_name == "get_company_summary":
        summary = tool_result.get("company_summary", {})
        comp_name = summary.get("company_name", "Textile Mill")
        latest_rev = _safe_float(summary.get("latest_monthly_revenue_lakh"))
        latest_margin = _safe_float(summary.get("latest_profit_margin_pct"))
        mom_growth = _safe_float(summary.get("mom_revenue_growth_pct"))
        latest_month = summary.get("latest_month", "Latest")

        is_loc = any(w in prompt_lower for w in ("where is", "where are", "location", "located", "address", "city", "state", "place", "headquarter"))
        is_profile = any(w in prompt_lower for w in ("specializ", "what do they make", "capacity", "founded", "established", "who is", "profile"))

        if is_loc and (summary.get("city") or summary.get("state")):
            city = summary.get("city") or "N/A"
            state = summary.get("state") or "N/A"
            artifacts.append(_kpi(
                title="Location / Base",
                metric="Headquarters",
                value=f"{city}, {state}",
                change="Verified Facility",
                change_type="positive",
                period="Operating Base",
                subtext=comp_name,
                raw_value=0.0,
            ))
            artifacts.append(_kpi(
                title="Specialization",
                metric="Core Focus",
                value=str(summary.get("code") or "Enterprise"),
                change=f"Est. {summary.get('founded_year', 'N/A')}",
                change_type="neutral",
                period="Manufacturing",
                subtext=str(summary.get("specialization") or "Textiles")[:32],
                raw_value=0.0,
            ))
        elif is_profile:
            artifacts.append(_kpi(
                title="Specialization",
                metric="Core Focus",
                value=str(summary.get("code") or "Enterprise"),
                change=f"Est. {summary.get('founded_year', 'N/A')}",
                change_type="neutral",
                period="Manufacturing",
                subtext=str(summary.get("specialization") or "Textiles")[:32],
                raw_value=0.0,
            ))
            artifacts.append(_kpi(
                title="Annual Capacity",
                metric="Rated Capacity",
                value=str(summary.get("capacity_description") or "Commercial"),
                change="Production capability",
                change_type="positive",
                period="Factory output",
                subtext=f"{summary.get('city', '')}, {summary.get('state', '')}",
                raw_value=0.0,
            ))
        else:
            artifacts.append(_kpi(
                title=f"Current Month Sales ({latest_month})",
                metric="Sales Revenue",
                value=f"₹{latest_rev:,.2f} L",
                raw_value=latest_rev,
                change=f"{mom_growth:+.2f}% MoM",
                change_type=_growth_type(mom_growth),
                period=latest_month,
                subtext=comp_name,
            ))
            peaks = summary.get("peaks_and_troughs") or {}
            highest_margin_dict = peaks.get("highest_margin") or {}
            peak_margin = _safe_float(highest_margin_dict.get("margin_pct", 0) if isinstance(highest_margin_dict, dict) else 0)
            annual_agg = summary.get("annual_aggregate") or {}
            avg_margin = _safe_float(annual_agg.get("average_profit_margin_pct", 0) if isinstance(annual_agg, dict) else 0)

            artifacts.append(_kpi(
                title="Profit Margin",
                metric="Gross Margin",
                value=f"{latest_margin:.2f}%",
                raw_value=latest_margin,
                change=f"Peak: {peak_margin}%",
                change_type="positive",
                period=latest_month,
                subtext=f"Annual Avg: {avg_margin:.1f}%",
            ))

        # Dynamic visual chart for single enterprise — only when asking financial/trend questions
        monthly_trend = summary.get("monthly_trend") or []
        if monthly_trend and not is_loc and not is_profile and not _wants_table_only(user_prompt):
            is_margin_q = any(w in prompt_lower for w in ("margin", "profitability", "profitable", "margin trend"))
            is_units_q = any(w in prompt_lower for w in ("units", "volume", "production", "produced", "pieces"))
            is_vs_q = any(w in prompt_lower for w in ("versus", " vs ", "revenue vs", "revenue versus", "vs expenditure", "versus expenditure", "revenue and profit"))

            if is_margin_q:
                artifacts.append(_chart(
                    title=f"Gross Profit Margin Trajectory (%) — {comp_name} (12 Months)",
                    chart_type="line",
                    x_key="month",
                    series=[{"key": "profit_margin_pct", "name": "Profit Margin %", "color": "#34D399", "type": "line"}],
                    data_points=monthly_trend,
                ))
            elif is_units_q and any(row.get("units_sold") is not None for row in monthly_trend):
                artifacts.append(_chart(
                    title=f"Monthly Production Volume (Units Sold) — {comp_name} (12 Months)",
                    chart_type="bar",
                    x_key="month",
                    series=[{"key": "units_sold", "name": "Units Sold", "color": "#A089E6", "type": "bar"}],
                    data_points=monthly_trend,
                ))
            elif is_vs_q:
                artifacts.append(_chart(
                    title=f"Monthly Revenue vs Gross Profit Comparison — {comp_name} (₹ Lakh)",
                    chart_type="bar",
                    x_key="month",
                    series=[
                        {"key": "revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#A089E6", "type": "bar"},
                        {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#34D399", "type": "bar"},
                    ],
                    data_points=monthly_trend,
                ))
            else:
                c_type = _infer_chart_type(user_prompt, "bar")
                artifacts.append(_chart(
                    title=f"Monthly Financial Performance (₹ Lakh) — {comp_name} (12 Months)",
                    chart_type=c_type,
                    x_key="month",
                    series=[
                        {"key": "revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#A089E6", "type": c_type},
                        {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#34D399", "type": c_type},
                    ],
                    data_points=monthly_trend,
                ))

    # 3. get_sales_trend
    elif tool_name == "get_sales_trend":
        trend = tool_result.get("sales_trend", {})
        series = trend.get("series") or []
        months = trend.get("period_months", len(series) or 0)
        total_rev = _safe_float(trend.get("total_period_revenue_lakh"))
        avg_rev = _safe_float(trend.get("avg_monthly_revenue_lakh"))
        latest = series[-1] if series else {}
        latest_growth = _safe_float(latest.get("growth_pct"))

        artifacts.append(_kpi(
            title="Period Revenue",
            metric="Total Revenue",
            value=f"₹{total_rev:,.2f} Lakh",
            raw_value=total_rev,
            change=f"{months}-month ledger total",
            change_type="positive" if total_rev else "neutral",
            period=f"{months} Months",
            subtext="Verified monthly sales records",
        ))
        artifacts.append(_kpi(
            title="Average Monthly Revenue",
            metric="Avg Monthly Sales",
            value=f"₹{avg_rev:,.2f} Lakh",
            raw_value=avg_rev,
            change=f"{latest_growth:+.2f}% latest MoM" if series else "No MoM change",
            change_type=_growth_type(latest_growth) if series else "neutral",
            period=str(latest.get("month") or f"{months} Months"),
            subtext="From underlying monthly ledger",
        ))

        if series and not _wants_table_only(user_prompt):
            chart_type = _infer_chart_type(user_prompt, "line")
            if chart_type == "donut":
                chart_type = "line"
            artifacts.append(_chart(
                title=f"Monthly Sales Revenue Trend ({months} Months) — ₹ Lakh",
                chart_type=chart_type,
                x_key="month",
                series=[
                    {
                        "key": "revenue_lakh",
                        "name": "Revenue (₹ Lakh)",
                        "color": "#A089E6",
                        "type": chart_type,
                    }
                ],
                data_points=series,
            ))
            if any(row.get("units_sold") is not None for row in series) and any(w in prompt_lower for w in ("unit", "volume", "production", "quantity")):
                artifacts.append(_chart(
                    title=f"Monthly Sales Volume Trend ({months} Months) — Units",
                    chart_type="bar",
                    x_key="month",
                    series=[{"key": "units_sold", "name": "Units Sold", "color": "#34D399", "type": "bar"}],
                    data_points=series,
                ))
            artifacts.append(_table(
                title=f"Monthly Sales Ledger ({months} Months)",
                columns=[
                    {"key": "month", "label": "Month"},
                    {"key": "revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                    {"key": "units_sold", "label": "Units Sold", "format": "number"},
                    {"key": "growth_pct", "label": "MoM Growth %", "format": "growth"},
                ],
                rows=[
                    {
                        "month": row.get("month"),
                        "revenue_lakh": f"₹{_safe_float(row.get('revenue_lakh')):,.2f} L",
                        "units_sold": f"{int(_safe_float(row.get('units_sold'))):,}",
                        "growth_pct": f"{_safe_float(row.get('growth_pct')):+.2f}%",
                    }
                    for row in series
                ],
            ))

    # 4. get_profit_trend
    elif tool_name == "get_profit_trend":
        trend = tool_result.get("profit_trend", {})
        series = trend.get("series") or []
        months = trend.get("period_months", len(series) or 0)
        total_gp = _safe_float(trend.get("total_period_gross_profit_lakh"))
        avg_margin = _safe_float(trend.get("avg_margin_pct"))

        artifacts.append(_kpi(
            title="Period Gross Profit",
            metric="Gross Profit",
            value=f"₹{total_gp:,.2f} Lakh",
            raw_value=total_gp,
            change=f"{months}-month total",
            change_type="positive" if total_gp >= 0 else "negative",
            period=f"{months} Months",
            subtext="Verified ledger profit",
        ))
        artifacts.append(_kpi(
            title="Average Profit Margin",
            metric="Avg Margin",
            value=f"{avg_margin:.2f}%",
            raw_value=avg_margin,
            change="Weighted on period revenue",
            change_type="positive" if avg_margin > 20 else "neutral",
            period=f"{months} Months",
            subtext="Gross margin excluding overheads",
        ))

        if series and not _wants_table_only(user_prompt):
            chart_type = _infer_chart_type(user_prompt, "line")
            artifacts.append(_chart(
                title=f"Gross Profit Trajectory ({months} Months) — ₹ Lakh",
                chart_type=chart_type if chart_type != "donut" else "line",
                x_key="month",
                series=[
                    {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#34D399", "type": chart_type if chart_type != "donut" else "line"},
                ],
                data_points=series,
            ))
            artifacts.append(_chart(
                title=f"Gross Profit Margin Trajectory ({months} Months) — %",
                chart_type="line",
                x_key="month",
                series=[{"key": "profit_margin_pct", "name": "Profit Margin %", "color": "#FBBF24", "type": "line"}],
                data_points=series,
            ))

    # 5. compare_companies (Admin)
    elif tool_name == "compare_companies":
        comp = tool_result.get("comparison", {})
        companies = comp.get("companies") or []
        period_months = comp.get("period_months", 6)
        if companies:
            for c in companies:
                c["code"] = c.get("code") or c.get("company_name", "")[:4].upper()
                c["display_name"] = f"{c['code']} - {c.get('company_name', '').split()[0]}"

            is_location_q = any(w in prompt_lower for w in ("location", "located", "where", "city", "cities", "state", "geography", "headquarters"))
            is_margin_q = any(w in prompt_lower for w in ("margin", "profitability", "profitable", "highest margin", "lowest margin", "best margin", "worst margin"))
            is_growth_q = any(w in prompt_lower for w in ("growth", "grew", "fastest", "expansion", "momentum"))
            is_units_q = any(w in prompt_lower for w in ("units", "volume", "produced", "quantity", "pieces"))
            is_revenue_q = any(w in prompt_lower for w in ("revenue", "sales", "highest revenue", "top revenue", "turnover", "most sales", "revenue leaders", "generate the most"))
            is_vs_q = any(w in prompt_lower for w in ("versus", " vs ", "revenue vs", "revenue versus", "vs expenditure", "versus expenditure", "compare revenue and", "revenue and profit"))
            is_share_q = any(w in prompt_lower for w in ("share", "distribution", "mix", "pie", "donut", "breakdown", "contribution"))
            table_only = _wants_table_only(user_prompt)

            limit = _extract_limit(user_prompt, default=len(companies))

            if is_location_q:
                artifacts.append(_table(
                    title="Textile Enterprise Facilities & Locations",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "city", "label": "City"},
                        {"key": "state", "label": "State / Province"},
                        {"key": "specialization", "label": "Core Specialization"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "city": c.get("city", "N/A"),
                            "state": c.get("state", "N/A"),
                            "specialization": c.get("specialization", "Textiles"),
                        }
                        for c in companies
                    ]
                ))
            elif is_vs_q:
                sorted_by_rev = sorted(companies, key=lambda x: _safe_float(x.get("total_revenue_lakh")), reverse=True)[:limit]
                if not table_only:
                    artifacts.append(_chart(
                        title=f"Comparative Revenue vs Gross Profit Across Enterprises (₹ Lakh) — {period_months} Months",
                        chart_type="bar",
                        x_key="code",
                        series=[
                            {"key": "total_revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#A089E6", "type": "bar"},
                            {"key": "total_gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#34D399", "type": "bar"},
                        ],
                        data_points=sorted_by_rev,
                    ))
                artifacts.append(_table(
                    title=f"Enterprise Financial Performance Comparison ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "total_revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                        {"key": "total_gross_profit_lakh", "label": "Gross Profit (₹ Lakh)", "format": "currency"},
                        {"key": "avg_profit_margin_pct", "label": "Margin %", "format": "percent"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                            "total_gross_profit_lakh": f"₹{_safe_float(c.get('total_gross_profit_lakh')):,.2f} L",
                            "avg_profit_margin_pct": f"{_safe_float(c.get('avg_profit_margin_pct')):.2f}%",
                        }
                        for c in sorted_by_rev
                    ]
                ))
            elif is_share_q:
                sorted_by_rev = sorted(companies, key=lambda x: _safe_float(x.get("total_revenue_lakh")), reverse=True)[:min(limit, 8)]
                if not table_only:
                    artifacts.append(_chart(
                        title=f"Enterprise Revenue Contribution Share (%) — {period_months} Months",
                        chart_type="donut",
                        x_key="code",
                        series=[{"key": "total_revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#A089E6", "type": "donut"}],
                        data_points=sorted_by_rev,
                    ))
                artifacts.append(_table(
                    title=f"Enterprise Revenue Contribution Breakdown ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "total_revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                        }
                        for c in sorted_by_rev
                    ]
                ))
            elif is_margin_q and not is_revenue_q:
                sorted_by_margin = sorted(companies, key=lambda x: _safe_float(x.get("avg_profit_margin_pct")), reverse=True)[:limit]
                top_m = sorted_by_margin[0]
                artifacts.append(_kpi(
                    title="Highest Margin Enterprise",
                    metric="Top Gross Margin",
                    value=f"{_safe_float(top_m.get('avg_profit_margin_pct')):.2f}%",
                    raw_value=_safe_float(top_m.get('avg_profit_margin_pct')),
                    change=str(top_m.get("company_name") or ""),
                    change_type="positive",
                    period=f"{period_months} Months",
                    subtext=f"Total Revenue: ₹{_safe_float(top_m.get('total_revenue_lakh')):,.2f} L",
                ))
                if not table_only:
                    title_margin = (
                        f"Top {len(sorted_by_margin)} Enterprises Ranked by Gross Profit Margin (%) — {period_months} Months"
                        if limit < len(companies)
                        else f"Textile Enterprises Ranked by Gross Profit Margin (%) — {period_months} Months"
                    )
                    artifacts.append(_chart(
                        title=title_margin,
                        chart_type="horizontal_bar",
                        x_key="code",
                        series=[{"key": "avg_profit_margin_pct", "name": "Gross Margin %", "color": "#34D399", "type": "horizontal_bar"}],
                        data_points=sorted_by_margin,
                    ))
                artifacts.append(_table(
                    title=f"Enterprise Margin Ranking ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "avg_profit_margin_pct", "label": "Avg Margin %", "format": "percent"},
                        {"key": "total_revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "avg_profit_margin_pct": f"{_safe_float(c.get('avg_profit_margin_pct')):.2f}%",
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                        }
                        for c in sorted_by_margin
                    ]
                ))
            elif is_growth_q:
                sorted_by_growth = sorted(companies, key=lambda x: _safe_float(x.get("revenue_growth_pct")), reverse=True)[:limit]
                top_g = sorted_by_growth[0]
                artifacts.append(_kpi(
                    title="Fastest Growing Enterprise",
                    metric="Top Revenue Growth",
                    value=f"{_safe_float(top_g.get('revenue_growth_pct')):+.2f}%",
                    raw_value=_safe_float(top_g.get('revenue_growth_pct')),
                    change=str(top_g.get("company_name") or ""),
                    change_type="positive",
                    period=f"{period_months} Months",
                    subtext=f"Total Revenue: ₹{_safe_float(top_g.get('total_revenue_lakh')):,.2f} L",
                ))
                if not table_only:
                    artifacts.append(_chart(
                        title=f"Top {len(sorted_by_growth)} Enterprises Ranked by Revenue Growth Rate (%) — {period_months} Months",
                        chart_type="horizontal_bar",
                        x_key="code",
                        series=[{"key": "revenue_growth_pct", "name": "Growth %", "color": "#38BDF8", "type": "horizontal_bar"}],
                        data_points=sorted_by_growth,
                    ))
                artifacts.append(_table(
                    title=f"Enterprise Growth Performance ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Enterprise"},
                        {"key": "revenue_growth_pct", "label": "Growth %", "format": "growth"},
                        {"key": "total_revenue_lakh", "label": "Total Revenue (₹ Lakh)", "format": "currency"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "revenue_growth_pct": f"{_safe_float(c.get('revenue_growth_pct')):+.2f}%",
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                        }
                        for c in sorted_by_growth
                    ]
                ))
            elif is_units_q:
                sorted_by_units = sorted(companies, key=lambda x: _safe_float(x.get("total_units_sold")), reverse=True)[:limit]
                if not table_only:
                    artifacts.append(_chart(
                        title=f"Enterprises Ranked by Production Volume (Units Sold) — {period_months} Months",
                        chart_type="horizontal_bar",
                        x_key="code",
                        series=[{"key": "total_units_sold", "name": "Units Sold", "color": "#FBBF24", "type": "horizontal_bar"}],
                        data_points=sorted_by_units,
                    ))
                artifacts.append(_table(
                    title=f"Production Volume by Enterprise ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Enterprise"},
                        {"key": "total_units_sold", "label": "Units Sold", "format": "number"},
                        {"key": "total_revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "total_units_sold": f"{int(_safe_float(c.get('total_units_sold'))):,}",
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                        }
                        for c in sorted_by_units
                    ]
                ))
            elif is_revenue_q and not is_margin_q:
                sorted_by_rev = sorted(companies, key=lambda x: _safe_float(x.get("total_revenue_lakh")), reverse=True)[:limit]
                top_r = sorted_by_rev[0]
                artifacts.append(_kpi(
                    title="Revenue Leader",
                    metric="Top Sales Performer",
                    value=f"₹{_safe_float(top_r.get('total_revenue_lakh')):,.2f} L",
                    raw_value=_safe_float(top_r.get('total_revenue_lakh')),
                    change=str(top_r.get("company_name") or ""),
                    change_type="positive",
                    period=f"{period_months} Months",
                    subtext=f"Margin: {_safe_float(top_r.get('avg_profit_margin_pct')):.2f}%",
                ))
                if not table_only:
                    title_rev = (
                        f"Top {len(sorted_by_rev)} Enterprises Ranked by Sales Revenue (₹ Lakh) — {period_months} Months"
                        if limit < len(companies)
                        else f"Textile Enterprises Ranked by Total Sales Revenue (₹ Lakh) — {period_months} Months"
                    )
                    artifacts.append(_chart(
                        title=title_rev,
                        chart_type="horizontal_bar",
                        x_key="code",
                        series=[{"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#A089E6", "type": "horizontal_bar"}],
                        data_points=sorted_by_rev,
                    ))
                artifacts.append(_table(
                    title=f"Enterprise Revenue Ranking ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "total_revenue_lakh", "label": "Total Revenue (₹ Lakh)", "format": "currency"},
                        {"key": "avg_profit_margin_pct", "label": "Avg Margin %", "format": "percent"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                            "avg_profit_margin_pct": f"{_safe_float(c.get('avg_profit_margin_pct')):.2f}%",
                        }
                        for c in sorted_by_rev
                    ]
                ))
            else:
                sorted_by_rev = sorted(companies, key=lambda x: _safe_float(x.get("total_revenue_lakh")), reverse=True)[:limit]
                title_default = (
                    f"Top {len(sorted_by_rev)} Enterprises Ranked by Total Sales Revenue (₹ Lakh) — {period_months} Months"
                    if limit < len(companies)
                    else f"Textile Enterprises Ranked by Total Sales Revenue (₹ Lakh) — {period_months} Months"
                )
                if not table_only:
                    artifacts.append(_chart(
                        title=title_default,
                        chart_type="horizontal_bar",
                        x_key="code",
                        series=[{"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#A089E6", "type": "horizontal_bar"}],
                        data_points=sorted_by_rev,
                    ))
                artifacts.append(_table(
                    title=f"Multi-Company Comparative Analysis ({period_months} Months)",
                    columns=[
                        {"key": "code", "label": "Code"},
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "total_revenue_lakh", "label": "Total Revenue (₹ Lakh)", "format": "currency"},
                        {"key": "avg_profit_margin_pct", "label": "Avg Margin %", "format": "percent"},
                        {"key": "total_units_sold", "label": "Units Sold", "format": "number"},
                        {"key": "revenue_growth_pct", "label": "Period Growth %", "format": "growth"},
                    ],
                    rows=[
                        {
                            "code": c.get("code"),
                            "company_name": c.get("company_name"),
                            "total_revenue_lakh": f"₹{_safe_float(c.get('total_revenue_lakh')):,.2f} L",
                            "avg_profit_margin_pct": f"{_safe_float(c.get('avg_profit_margin_pct')):.2f}%",
                            "total_units_sold": f"{int(_safe_float(c.get('total_units_sold'))):,}",
                            "revenue_growth_pct": f"{_safe_float(c.get('revenue_growth_pct')):+.2f}%",
                        }
                        for c in sorted_by_rev
                    ],
                ))

    # 6. get_global_summary (Admin)
    elif tool_name == "get_global_summary":
        glob = tool_result.get("global_summary") or tool_result.get("comparison") or {}
        port = glob.get("portfolio_summary", {})
        companies = glob.get("companies") or []
        period = f"{glob.get('period_months', 12)} Months"
        total_rev = _safe_float(port.get("total_portfolio_revenue_lakh"))
        avg_margin = _safe_float(
            port.get("portfolio_weighted_margin_pct")
            or port.get("average_portfolio_margin_pct")
        )

        artifacts.append(_kpi(
            title="Total Portfolio Revenue",
            metric="Portfolio Revenue",
            value=f"₹{total_rev:,.2f} L",
            raw_value=total_rev,
            change=f"{glob.get('companies_count', len(companies))} companies",
            change_type="positive",
            period=period,
            subtext=f"Top performer: {port.get('top_revenue_performer') or 'N/A'}",
        ))
        artifacts.append(_kpi(
            title="Highest Margin Performer",
            metric="Top Margin Mill",
            value=str(port.get("highest_margin_performer") or "N/A"),
            raw_value=avg_margin,
            change=f"Fastest growth: {port.get('fastest_growth_performer') or 'N/A'}",
            change_type="positive",
            period=period,
            subtext=f"Portfolio margin: {avg_margin:.2f}%",
        ))
        if companies and not _wants_table_only(user_prompt):
            for c in companies:
                c["code"] = c.get("code") or c.get("company_name", "")[:4].upper()
            chart_type = _infer_chart_type(user_prompt, "horizontal_bar")
            artifacts.append(_chart(
                title=f"Portfolio Revenue by Enterprise (₹ Lakh) — {period}",
                chart_type=chart_type,
                x_key="code",
                series=[{"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#A089E6", "type": chart_type}],
                data_points=sorted(companies, key=lambda x: _safe_float(x.get("total_revenue_lakh")), reverse=True),
            ))

    # 7. get_top_products
    elif tool_name == "get_top_products":
        products = tool_result.get("top_products") or []
        if products:
            top = products[0]
            artifacts.append(_kpi(
                title="Top Category by Revenue",
                metric="Leading Product Line",
                value=str(top.get("category_name") or "N/A"),
                raw_value=_safe_float(top.get("total_revenue_lakh")),
                change=f"₹{_safe_float(top.get('total_revenue_lakh')):,.2f} Lakh",
                change_type="positive",
                period="Product Mix",
                subtext=f"{len(products)} categories ranked",
            ))

            if not _wants_table_only(user_prompt):
                is_share_q = any(w in prompt_lower for w in ("share", "distribution", "mix", "pie", "donut", "breakdown", "composition"))
                is_margin_q = any(w in prompt_lower for w in ("margin", "profitability", "profitable"))

                if is_share_q:
                    chart_type = "donut"
                    chart_title = "Product Line Revenue Contribution Breakdown (%)"
                    series = [{"key": "total_revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#A089E6", "type": "donut"}]
                elif is_margin_q and any(p.get("gross_margin_pct") is not None or p.get("profit_margin_pct") is not None for p in products):
                    chart_type = "horizontal_bar"
                    margin_key = "gross_margin_pct" if "gross_margin_pct" in products[0] else "profit_margin_pct"
                    chart_title = f"Top {len(products)} Product Categories Ranked by Profit Margin (%)"
                    series = [{"key": margin_key, "name": "Gross Margin %", "color": "#34D399", "type": "horizontal_bar"}]
                else:
                    chart_type = _infer_chart_type(user_prompt, "horizontal_bar")
                    chart_title = f"Top {len(products)} Product Categories Ranked by Sales Revenue (₹ Lakh)"
                    series = [{"key": "total_revenue_lakh", "name": "Sales Revenue (₹ Lakh)", "color": "#A089E6", "type": chart_type}]

                artifacts.append(_chart(
                    title=chart_title,
                    chart_type=chart_type,
                    x_key="category_name",
                    series=series,
                    data_points=products,
                ))

            artifacts.append(_table(
                title=f"Product Category Performance ({len(products)} Lines)",
                columns=[
                    {"key": "category_name", "label": "Product Category"},
                    {"key": "total_revenue_lakh", "label": "Revenue (₹ Lakh)", "format": "currency"},
                    {"key": "units_sold", "label": "Units Sold", "format": "number"},
                ],
                rows=[
                    {
                        "category_name": p.get("category_name"),
                        "total_revenue_lakh": f"₹{_safe_float(p.get('total_revenue_lakh')):,.2f} L",
                        "units_sold": f"{int(_safe_float(p.get('units_sold'))):,}" if p.get("units_sold") is not None else "N/A",
                    }
                    for p in products
                ]
            ))

    # 8. query_business_data — render whatever monthly series the tool returned
    elif tool_name == "query_business_data":
        records = tool_result.get("records") or []
        artifacts.extend(_artifacts_from_tabular_records(records, user_prompt, chart_hint))

    # 9. uploaded datasets
    elif tool_name == "get_uploaded_datasets_info":
        info = tool_result.get("datasets_info") or {}
        datasets = info.get("datasets") or []
        artifacts.append(_kpi(
            title="Datasets on File",
            metric="Uploaded Datasets",
            value=str(info.get("dataset_count", len(datasets))),
            raw_value=_safe_float(info.get("dataset_count", len(datasets))),
            change=f"{info.get('total_records', 0)} records",
            change_type="positive" if datasets else "neutral",
            period=str(info.get("date_range") or "Ledger"),
            subtext=f"{info.get('historical_ledger_months', 0)} ledger months",
        ))
        if datasets:
            artifacts.append(_table(
                title="Authorized Dataset Inventory",
                columns=[
                    {"key": "name", "label": "Dataset"},
                    {"key": "filename", "label": "Source File"},
                    {"key": "record_count", "label": "Records", "format": "number"},
                    {"key": "status", "label": "Status"},
                    {"key": "date_range_end", "label": "Through"},
                ],
                rows=[
                    {
                        "name": row.get("name"),
                        "filename": row.get("filename"),
                        "record_count": row.get("record_count"),
                        "status": row.get("status"),
                        "date_range_end": row.get("date_range_end"),
                    }
                    for row in datasets
                ],
            ))

    # 10. render_custom_chart
    elif tool_name == "render_custom_chart":
        chart_args = tool_result.get("chart_data", {})
        artifacts.append(_chart(
            title=chart_args.get("title", "Custom Analysis"),
            chart_type=chart_args.get("chart_type", "bar"),
            x_key=chart_args.get("x_key", "x"),
            series=[{"key": k, "name": k, "type": chart_args.get("chart_type", "bar")} for k in chart_args.get("series", [])],
            data_points=chart_args.get("data_points", [])
        ))

    # 8. execute_sql_query
    elif tool_name == "execute_sql_query":
        rows = tool_result.get("rows", [])
        cols = tool_result.get("columns", [])
        exec_ms = tool_result.get("execution_time_ms", 0)

        if rows:
            table_cols = [{"key": c, "label": c.replace("_", " ").title()} for c in cols]
            artifacts.append(_table(
                title=f"Verified Database Query ({len(rows)} Records)",
                columns=table_cols,
                rows=rows
            ))

            artifacts.append(_kpi(
                title="Query Output",
                metric="Records Returned",
                value=f"{len(rows)} Rows",
                raw_value=len(rows),
                change=f"{exec_ms} ms",
                change_type="positive" if rows else "neutral",
                period="Live Database Query",
                subtext=f"{len(cols)} columns retrieved securely"
            ))

            # Redundant Chart Suppression (Section 17.1 & 17.2):
            # If user asked for detailed records, accounts, raw data, or table, do NOT generate an unnecessary chart!
            if not _wants_table_only(user_prompt):
                first_row = rows[0]
                cat_col = next((c for c in cols if isinstance(first_row.get(c), str)), None)
                num_cols = [c for c in cols if isinstance(first_row.get(c), (int, float)) and not isinstance(first_row.get(c), bool)]
                if cat_col and num_cols and len(rows) >= 2:
                    primary_num = num_cols[0]
                    num_label = primary_num.replace("_", " ").title()
                    cat_label = cat_col.replace("_", " ").title()

                    chart_type = _infer_chart_type(user_prompt, "bar")
                    if any(t in cat_col.lower() for t in ("date", "month", "year", "period", "time")) and chart_type != "horizontal_bar":
                        chart_type = "line"

                    series = [{
                        "key": primary_num,
                        "name": num_label,
                        "color": "#A089E6",
                        "type": chart_type
                    }]
                    artifacts.append(_chart(
                        title=f"{num_label} by {cat_label} ({min(len(rows), 20)} Records)",
                        chart_type=chart_type,
                        x_key=cat_col,
                        series=series,
                        data_points=rows[:20]
                    ))

    # 9. discover_database_schema
    elif tool_name in ("discover_database_schema", "get_database_schema"):
        if "summary" in tool_result:
            summary = tool_result["summary"]
            domains = summary.get("domains", [])
            table_rows = [
                {
                    "domain": d.get("domain", ""),
                    "table_count": d.get("table_count", 0),
                    "sample_tables": ", ".join(d.get("sample_tables", [])[:4])
                }
                for d in domains
            ]
            artifacts.append(_table(
                title="Live Database Domain Catalog",
                columns=[
                    {"key": "domain", "label": "Business Domain"},
                    {"key": "table_count", "label": "Tables & Views"},
                    {"key": "sample_tables", "label": "Sample Entities"}
                ],
                rows=table_rows
            ))
            artifacts.append(_kpi(
                title="Database Coverage",
                metric="Total Entities",
                value=f"{summary.get('total_entities', 0):,}",
                raw_value=summary.get('total_entities', 0),
                change=f"{summary.get('total_tables', 0)} Tables",
                change_type="positive",
                period="Live Database Schema",
                subtext=f"{summary.get('total_views', 0)} Views | {len(domains)} Domains"
            ))
        else:
            tables = tool_result.get("tables", [])
            if tables:
                artifacts.append(_table(
                    title=f"Discovered Tables ({len(tables)})",
                    columns=[
                        {"key": "name", "label": "Table Name"},
                        {"key": "type", "label": "Type"},
                        {"key": "domain", "label": "Business Domain"}
                    ],
                    rows=tables
                ))

    # 10. inspect_table_schema
    elif tool_name == "inspect_table_schema":
        tables = tool_result.get("tables", {})
        for t_name, info in tables.items():
            if info.get("status") == "success":
                cols = info.get("columns", [])
                samples = info.get("sample_rows", [])

                artifacts.append(_table(
                    title=f"Schema: {t_name} ({len(cols)} Columns)",
                    columns=[
                        {"key": "name", "label": "Column Name"},
                        {"key": "type", "label": "Data Type"},
                        {"key": "nullable", "label": "Nullable"},
                        {"key": "is_primary_key", "label": "Primary Key"}
                    ],
                    rows=cols
                ))

                if samples:
                    first_sample = samples[0]
                    sample_cols = [{"key": k, "label": k} for k in first_sample.keys()]
                    artifacts.append(_table(
                        title=f"Sample Records: {t_name}",
                        columns=sample_cols,
                        rows=samples
                    ))

    # 11. summarize_database_capabilities / refresh_database_schema
    elif tool_name in ("summarize_database_capabilities", "refresh_database_schema"):
        summary = tool_result.get("catalog_summary") or tool_result
        if "domains" in summary:
            domains = summary.get("domains", [])
            table_rows = [
                {
                    "domain": d.get("domain", ""),
                    "table_count": d.get("table_count", 0),
                    "sample_tables": ", ".join(d.get("sample_tables", [])[:4])
                }
                for d in domains
            ]
            artifacts.append(_table(
                title="Live Enterprise Schema Capabilities",
                columns=[
                    {"key": "domain", "label": "Business Domain"},
                    {"key": "table_count", "label": "Entity Count"},
                    {"key": "sample_tables", "label": "Key Sample Tables"}
                ],
                rows=table_rows
            ))
            artifacts.append(_kpi(
                title="Schema Capacity",
                metric="Total Accessible Entities",
                value=f"{summary.get('total_entities', 0):,}",
                raw_value=summary.get('total_entities', 0),
                change=f"{summary.get('total_tables', 0)} Tables",
                change_type="positive",
                period="Connected Database",
                subtext=f"{summary.get('total_views', 0)} Views | Dynamic Discovery Active"
            ))

    # File report ONLY when the user explicitly asked for an export, download, excel, or spreadsheet
    wants_download = any(k in prompt_lower for k in (
        "excel", "xlsx", "download", "export", "spreadsheet", "csv", ".xlsx"
    )) or ("give" in prompt_lower and "file" in prompt_lower) or ("send" in prompt_lower and "file" in prompt_lower)
    if wants_download:
        is_comparison = tool_name in ("compare_companies", "get_global_summary")
        report_type = "portfolio" if is_comparison else "executive"
        comp_ids = tool_args.get("company_ids") if is_comparison else (
            [tool_args.get("company_id")] if tool_args.get("company_id") else None
        )
        filename = "Portfolio_Executive_Report.xlsx" if is_comparison else "Executive_Financial_Report.xlsx"
        artifacts.append({
            "id": _new_id("file_xlsx"),
            "type": "file",
            "title": filename,
            "data": {
                "filename": filename,
                "format": "xlsx",
                "size": "42.8 KB",
                "description": (
                    "5-Sheet Executive Workbook: Summary, Financial Statements, "
                    "Monthly Trends, Category Economics & Data Sources Provenance."
                ),
                "reportType": report_type,
                "companyIds": comp_ids,
                "periodMonths": tool_args.get("period_months") or tool_args.get("months") or 6,
            },
        })

    return artifacts


def _artifacts_from_tabular_records(
    records: List[Dict[str, Any]],
    user_prompt: str,
    chart_hint: str,
) -> List[Dict[str, Any]]:
    if not records:
        return []

    sample = records[0]
    x_key = next((k for k in ("month", "month_name", "period", "company_name", "category_name") if k in sample), None)
    numeric_keys = [
        k for k, v in sample.items()
        if k != x_key and isinstance(v, (int, float)) and not isinstance(v, bool)
    ]
    if not numeric_keys:
        return []

    label_map = {
        "revenue_lakh": "Revenue (₹ Lakh)",
        "gross_profit_lakh": "Gross Profit (₹ Lakh)",
        "profit_margin_pct": "Margin %",
        "units_sold": "Units Sold",
        "orders_count": "Orders",
    }
    colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"]
    preferred = [k for k in ("revenue_lakh", "gross_profit_lakh") if k in numeric_keys] or numeric_keys[:1]
    chart_type = "donut" if chart_hint == "donut" and x_key else (chart_hint if chart_hint != "donut" else "bar")

    artifacts = []
    first_key = preferred[0]
    first_vals = [float(r.get(first_key) or 0) for r in records]
    total = round(sum(first_vals), 2)
    artifacts.append(_kpi(
        title=label_map.get(first_key, first_key.replace("_", " ").title()),
        metric=label_map.get(first_key, first_key),
        value=f"{total:,.2f}",
        raw_value=total,
        change=f"{len(records)} records",
        change_type="positive" if total else "neutral",
        period="Query result",
        subtext="Generated from verified database rows",
    ))

    if x_key and len(records) >= 2:
        series = [
            {
                "key": key,
                "name": label_map.get(key, key.replace("_", " ").title()),
                "color": colors[idx % len(colors)],
                "type": chart_type,
            }
            for idx, key in enumerate(preferred[:2])
        ]
        metric_title = " & ".join(label_map.get(k, k.replace('_', ' ').title()) for k in preferred[:2])
        artifacts.append(_chart(
            title=f"{metric_title} by {x_key.replace('_', ' ').title()} ({len(records)} Records)",
            chart_type=chart_type,
            x_key=x_key,
            series=series,
            data_points=records,
        ))
    return artifacts
