from typing import List, Dict, Any, Optional
import uuid
import json

def generate_artifacts_from_tool_result(
    tool_name: str,
    tool_args: Dict[str, Any],
    tool_result: Dict[str, Any],
    user_prompt: str = ""
) -> List[Dict[str, Any]]:
    """
    Synthesizes structured artifacts (KPIs, Charts, Tables, and Report files)
    from verified deterministic tool execution results.
    """
    artifacts: List[Dict[str, Any]] = []
    prompt_lower = user_prompt.lower()
    
    if tool_result.get("status") != "success":
        return artifacts

    # 1. calculate_metric
    if tool_name == "calculate_metric":
        metric = tool_result.get("metric")
        if metric == "revenue_growth":
            growth = tool_result.get("growth_pct", 0.0)
            is_pos = growth >= 0
            artifacts.append({
                "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
                "type": "kpi",
                "title": f"MoM Revenue Growth ({tool_result.get('current_month')})",
                "data": {
                    "metric": "Revenue Growth",
                    "value": f"{'+' if is_pos else ''}{growth:.2f}%",
                    "raw_value": growth,
                    "change": f"{'+' if is_pos else ''}₹{tool_result.get('change_lakh', 0):.2f} Lakh",
                    "change_type": "positive" if is_pos else "negative",
                    "period": f"{tool_result.get('current_month')} vs {tool_result.get('previous_month')}",
                    "subtext": f"Current: ₹{tool_result.get('current_revenue_lakh')}L | Prev: ₹{tool_result.get('previous_revenue_lakh')}L"
                }
            })
        elif metric == "revenue_lakh":
            val = tool_result.get("value", 0.0)
            artifacts.append({
                "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
                "type": "kpi",
                "title": f"Monthly Sales ({tool_result.get('month', 'Latest')})",
                "data": {
                    "metric": "Total Revenue",
                    "value": f"₹{val:,.2f} Lakh",
                    "raw_value": val,
                    "change": "Latest Period",
                    "change_type": "neutral",
                    "period": tool_result.get("month", "Latest"),
                    "subtext": "Verified Sales Ledger Record"
                }
            })
        elif metric == "profit_margin_pct":
            val = tool_result.get("value", 0.0)
            artifacts.append({
                "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
                "type": "kpi",
                "title": f"Gross Profit Margin ({tool_result.get('month', 'Latest')})",
                "data": {
                    "metric": "Profit Margin",
                    "value": f"{val:.2f}%",
                    "raw_value": val,
                    "change": "Operational Gross Margin",
                    "change_type": "positive" if val > 20 else "neutral",
                    "period": tool_result.get("month", "Latest"),
                    "subtext": "Excluding administrative overheads"
                }
            })

    # 2. get_company_summary
    elif tool_name == "get_company_summary":
        summary = tool_result.get("company_summary", {})
        comp_name = summary.get("company_name", "Textile Mill")
        latest_rev = summary.get("latest_monthly_revenue_lakh", 0.0)
        latest_margin = summary.get("latest_profit_margin_pct", 0.0)
        mom_growth = summary.get("mom_revenue_growth_pct", 0.0)
        is_growth_pos = mom_growth >= 0

        # KPI 1: Revenue
        artifacts.append({
            "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
            "type": "kpi",
            "title": f"Current Month Sales ({summary.get('latest_month')})",
            "data": {
                "metric": "Sales Revenue",
                "value": f"₹{latest_rev:,.2f} L",
                "raw_value": latest_rev,
                "change": f"{'+' if is_growth_pos else ''}{mom_growth:.2f}% MoM",
                "change_type": "positive" if is_growth_pos else "negative",
                "period": summary.get("latest_month", "Latest"),
                "subtext": comp_name
            }
        })

        # KPI 2: Margin
        artifacts.append({
            "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
            "type": "kpi",
            "title": "Profit Margin",
            "data": {
                "metric": "Gross Margin",
                "value": f"{latest_margin:.2f}%",
                "raw_value": latest_margin,
                "change": f"Peak: {summary.get('peaks_and_troughs', {}).get('highest_margin', {}).get('margin_pct', 0)}%",
                "change_type": "positive",
                "period": summary.get("latest_month", "Latest"),
                "subtext": f"Annual Avg: {summary.get('annual_aggregate', {}).get('average_profit_margin_pct', 0):.1f}%"
            }
        })

        # Trend Chart from monthly_trend
        monthly_trend = summary.get("monthly_trend", [])
        if monthly_trend:
            artifacts.append({
                "id": f"art_chart_{uuid.uuid4().hex[:8]}",
                "type": "chart",
                "title": f"12-Month Financial Performance — {comp_name}",
                "data": {
                    "chart_type": "bar",
                    "x_key": "month",
                    "series": [
                        {"key": "revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#2563EB", "type": "bar"},
                        {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#10B981", "type": "bar"},
                        {"key": "profit_margin_pct", "name": "Margin %", "color": "#F59E0B", "type": "line"}
                    ],
                    "data_points": monthly_trend
                }
            })

    # 3. get_sales_trend
    elif tool_name == "get_sales_trend":
        trend = tool_result.get("sales_trend", {})
        series = trend.get("series", [])
        if series:
            artifacts.append({
                "id": f"art_chart_{uuid.uuid4().hex[:8]}",
                "type": "chart",
                "title": f"Sales & Volume Trend ({trend.get('period_months', 6)} Months)",
                "data": {
                    "chart_type": "area",
                    "x_key": "month",
                    "series": [
                        {"key": "revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#3B82F6", "type": "area"},
                        {"key": "units_sold", "name": "Units Sold", "color": "#8B5CF6", "type": "line"}
                    ],
                    "data_points": series
                }
            })

    # 4. get_profit_trend
    elif tool_name == "get_profit_trend":
        trend = tool_result.get("profit_trend", {})
        series = trend.get("series", [])
        if series:
            artifacts.append({
                "id": f"art_chart_{uuid.uuid4().hex[:8]}",
                "type": "chart",
                "title": f"Profitability & Margin Trend ({trend.get('period_months', 6)} Months)",
                "data": {
                    "chart_type": "line",
                    "x_key": "month",
                    "series": [
                        {"key": "gross_profit_lakh", "name": "Gross Profit (₹ Lakh)", "color": "#10B981", "type": "line"},
                        {"key": "profit_margin_pct", "name": "Profit Margin %", "color": "#F59E0B", "type": "line"}
                    ],
                    "data_points": series
                }
            })

    # 5. compare_companies (Admin)
    elif tool_name == "compare_companies":
        comp = tool_result.get("comparison", {})
        companies = comp.get("companies", [])
        if companies:
            # Table Artifact
            artifacts.append({
                "id": f"art_table_{uuid.uuid4().hex[:8]}",
                "type": "table",
                "title": f"Multi-Company Comparative Analysis ({comp.get('period_months', 6)} Months)",
                "data": {
                    "columns": [
                        {"key": "company_name", "label": "Textile Enterprise"},
                        {"key": "total_revenue_lakh", "label": "Total Revenue (₹ Lakh)", "format": "currency"},
                        {"key": "avg_profit_margin_pct", "label": "Avg Margin %", "format": "percent"},
                        {"key": "total_units_sold", "label": "Units Sold", "format": "number"},
                        {"key": "yoy_growth_pct", "label": "YoY Growth %", "format": "growth"}
                    ],
                    "rows": [
                        {
                            "company_name": c.get("company_name"),
                            "total_revenue_lakh": f"₹{c.get('total_revenue_lakh', 0):,.2f} L",
                            "avg_profit_margin_pct": f"{c.get('avg_profit_margin_pct', 0):.2f}%",
                            "total_units_sold": f"{c.get('total_units_sold', 0):,}",
                            "yoy_growth_pct": f"{'+' if c.get('yoy_growth_pct', 0) >= 0 else ''}{c.get('yoy_growth_pct', 0):.2f}%"
                        }
                        for c in companies
                    ]
                }
            })

            # Comparison Bar Chart
            artifacts.append({
                "id": f"art_chart_{uuid.uuid4().hex[:8]}",
                "type": "chart",
                "title": "Revenue & Margin Comparison by Company",
                "data": {
                    "chart_type": "bar",
                    "x_key": "company_name",
                    "series": [
                        {"key": "total_revenue_lakh", "name": "Total Revenue (₹ Lakh)", "color": "#2563EB", "type": "bar"},
                        {"key": "avg_profit_margin_pct", "name": "Margin %", "color": "#10B981", "type": "bar"}
                    ],
                    "data_points": companies
                }
            })

    # 6. get_global_summary (Admin)
    elif tool_name == "get_global_summary":
        glob = tool_result.get("global_summary", {})
        port = glob.get("portfolio_summary", {})
        
        # Portfolio KPI
        artifacts.append({
            "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
            "type": "kpi",
            "title": "Total Portfolio Revenue (All 10 Companies)",
            "data": {
                "metric": "Portfolio Revenue",
                "value": f"₹{port.get('total_portfolio_revenue_lakh', 0):,.2f} L",
                "raw_value": port.get("total_portfolio_revenue_lakh", 0),
                "change": f"{port.get('companies_count', 10)} Companies Active",
                "change_type": "positive",
                "period": f"{glob.get('period_months', 12)} Months Aggregate",
                "subtext": f"Top Performer: {port.get('top_revenue_performer')}"
            }
        })

        artifacts.append({
            "id": f"art_kpi_{uuid.uuid4().hex[:8]}",
            "type": "kpi",
            "title": "Highest Margin Performer",
            "data": {
                "metric": "Top Margin Mill",
                "value": port.get("highest_margin_performer", "N/A"),
                "raw_value": 0,
                "change": "Fastest Growth: " + str(port.get("fastest_growth_performer", "N/A")),
                "change_type": "positive",
                "period": "12-Month Period",
                "subtext": f"Avg Portfolio Margin: {port.get('average_portfolio_margin_pct', 0):.2f}%"
            }
        })

    # 7. get_top_products
    elif tool_name == "get_top_products":
        products = tool_result.get("top_products", [])
        if products:
            artifacts.append({
                "id": f"art_chart_{uuid.uuid4().hex[:8]}",
                "type": "chart",
                "title": "Top Fabric & Product Categories by Revenue",
                "data": {
                    "chart_type": "donut",
                    "x_key": "category_name",
                    "series": [
                        {"key": "total_revenue_lakh", "name": "Revenue (₹ Lakh)", "color": "#6366F1", "type": "donut"}
                    ],
                    "data_points": products
                }
            })

    # Generate File Report Artifacts if user asked for report/export or on comparisons/summaries
    if any(k in prompt_lower for k in ["report", "export", "excel", "sheet", "download", "summary", "brief", "compare", "portfolio"]):
        is_comparison = tool_name in ["compare_companies", "get_global_summary"]
        report_type = "portfolio" if is_comparison else "executive"
        comp_ids = tool_args.get("company_ids") if is_comparison else ([tool_args.get("company_id")] if tool_args.get("company_id") else None)
        
        artifacts.append({
            "id": f"art_file_xlsx_{uuid.uuid4().hex[:8]}",
            "type": "file",
            "title": "Executive_Financial_Report.xlsx" if not is_comparison else "Portfolio_Executive_Report.xlsx",
            "data": {
                "filename": "Executive_Financial_Report.xlsx" if not is_comparison else "Portfolio_Executive_Report.xlsx",
                "format": "xlsx",
                "size": "42.8 KB",
                "description": "5-Sheet Executive Workbook: Summary, Financial Statements, Monthly Trends, Category Economics & Data Sources Provenance.",
                "report_type": report_type,
                "company_ids": comp_ids,
                "period_months": tool_args.get("period_months", 6)
            }
        })

    return artifacts
