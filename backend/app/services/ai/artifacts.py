from typing import List, Dict, Any
import uuid


def _new_id(kind: str) -> str:
    return f"art_{kind}_{uuid.uuid4().hex[:8]}"


def _infer_chart_type(user_prompt: str, default: str) -> str:
    prompt = (user_prompt or "").casefold()
    if any(term in prompt for term in ("pie", "donut", "share", "mix", "composition", "breakdown")):
        return "donut"
    if any(term in prompt for term in ("bar chart", "bar graph", "column", "compare", "rank", "ranking")):
        return "bar"
    if "area" in prompt:
        return "area"
    if any(term in prompt for term in ("line", "trend", "trajectory", "plot", "graph", "chart", "visual")):
        return "line" if "bar" not in prompt else "bar"
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
                change=f"{tool_result.get('change_lakh', 0):+.2f} Lakh",
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
        artifacts.append(_kpi(
            title="Profit Margin",
            metric="Gross Margin",
            value=f"{latest_margin:.2f}%",
            raw_value=latest_margin,
            change=f"Peak: {summary.get('peaks_and_troughs', {}).get('highest_margin', {}).get('margin_pct', 0)}%",
            change_type="positive",
            period=latest_month,
            subtext=f"Annual Avg: {summary.get('annual_aggregate', {}).get('average_profit_margin_pct', 0):.1f}%",
        ))

        monthly_trend = summary.get("monthly_trend") or []
        if monthly_trend:
            artifacts.append(_chart(
                title=f"12-Month Financial Performance — {comp_name}",
                chart_type=_infer_chart_type(user_prompt, "bar"),
                x_key="month",
                series=[
                    {"key": "revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#2563EB", "type": "bar"},
                    {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#10B981", "type": "bar"},
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

        if series:
            chart_type = _infer_chart_type(user_prompt, "area")
            artifacts.append(_chart(
                title=f"Sales Revenue Trend ({months} Months)",
                chart_type=chart_type if chart_type != "donut" else "area",
                x_key="month",
                series=[
                    {
                        "key": "revenue_lakh",
                        "name": "Revenue (₹ Lakh)",
                        "color": "#3B82F6",
                        "type": "area" if chart_type == "donut" else chart_type,
                    }
                ],
                data_points=series,
            ))
            if any(row.get("units_sold") is not None for row in series):
                artifacts.append(_chart(
                    title=f"Sales Volume Trend ({months} Months)",
                    chart_type="bar",
                    x_key="month",
                    series=[{"key": "units_sold", "name": "Units Sold", "color": "#8B5CF6", "type": "bar"}],
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

        if series:
            artifacts.append(_chart(
                title=f"Profitability Trend ({months} Months)",
                chart_type=_infer_chart_type(user_prompt, "line"),
                x_key="month",
                series=[
                    {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#10B981"},
                ],
                data_points=series,
            ))
            artifacts.append(_chart(
                title=f"Margin Trend ({months} Months)",
                chart_type="line",
                x_key="month",
                series=[{"key": "profit_margin_pct", "name": "Profit Margin %", "color": "#F59E0B", "type": "line"}],
                data_points=series,
            ))

    # 5. compare_companies (Admin)
    elif tool_name == "compare_companies":
        comp = tool_result.get("comparison", {})
        companies = comp.get("companies") or []
        if companies:
            artifacts.append(_table(
                title=f"Multi-Company Comparative Analysis ({comp.get('period_months', 6)} Months)",
                columns=[
                    {"key": "company_name", "label": "Textile Enterprise"},
                    {"key": "total_revenue_lakh", "label": "Total Revenue (₹ Lakh)", "format": "currency"},
                    {"key": "avg_profit_margin_pct", "label": "Avg Margin %", "format": "percent"},
                    {"key": "total_units_sold", "label": "Units Sold", "format": "number"},
                    {"key": "revenue_growth_pct", "label": "Period Growth %", "format": "growth"},
                ],
                rows=[
                    {
                        "company_name": c.get("company_name"),
                        "total_revenue_lakh": f"₹{c.get('total_revenue_lakh', 0):,.2f} L",
                        "avg_profit_margin_pct": f"{c.get('avg_profit_margin_pct', 0):.2f}%",
                        "total_units_sold": f"{c.get('total_units_sold', 0):,}",
                        "revenue_growth_pct": (
                            f"{c.get('revenue_growth_pct', 0):+.2f}%"
                        ),
                    }
                    for c in companies
                ],
            ))
            artifacts.append(_chart(
                title="Revenue Comparison by Company",
                chart_type=_infer_chart_type(user_prompt, "bar"),
                x_key="company_name",
                series=[{"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#2563EB", "type": "bar"}],
                data_points=companies,
            ))
            artifacts.append(_chart(
                title="Margin Comparison by Company",
                chart_type="bar",
                x_key="company_name",
                series=[{"key": "avg_profit_margin_pct", "name": "Avg Margin %", "color": "#10B981", "type": "bar"}],
                data_points=companies,
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
        if companies:
            artifacts.append(_chart(
                title="Portfolio Revenue by Enterprise",
                chart_type=_infer_chart_type(user_prompt, "bar"),
                x_key="company_name",
                series=[{"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#2563EB", "type": "bar"}],
                data_points=companies,
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
                period="Category mix",
                subtext=f"{len(products)} categories ranked",
            ))
            chart_type = _infer_chart_type(user_prompt, "donut")
            artifacts.append(_chart(
                title="Top Fabric & Product Categories by Revenue",
                chart_type=chart_type if chart_type in ("donut", "bar") else "donut",
                x_key="category_name",
                series=[{"key": "total_revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#6366F1"}],
                data_points=products,
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

    # File report when the user asked for an export / brief
    if any(k in prompt_lower for k in ("report", "export", "excel", "sheet", "download", "summary", "brief", "compare", "portfolio")):
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
        artifacts.append(_chart(
            title="Verified Database Trend",
            chart_type=chart_type,
            x_key=x_key,
            series=series,
            data_points=records,
        ))
    return artifacts
