"""
Acceptance Test Suite for Section 17: Intelligent, Question-Driven Visualization Engine.

Verifies:
1. Ranked query ("Which companies generate the most revenue?") -> horizontal_bar artifact with descriptive title.
2. Margin ranking ("Top 3 highest margin mills") -> horizontal_bar artifact with 3 items.
3. Trend query ("How has revenue changed over the last 12 months?") -> line/area artifact.
4. Comparative query ("What is our revenue versus expenditure?") -> grouped bar artifact with dual series.
5. Detailed records query ("Show me the detailed account records") -> Table artifact ONLY, no redundant chart.
6. Multi-turn visual refinement ("Now show only top two") -> updated 2-item ranking artifact.
7. Product lines ranking & share composition -> horizontal_bar vs donut.
"""

import sys
import os
from typing import List, Dict, Any

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.ai.artifacts import generate_artifacts_from_tool_result, _infer_chart_type, _wants_table_only, _extract_limit
from app.services.ai.orchestrator import AIOrchestrator
from app.repositories.dev_repo import repo
from app.schemas.auth import AuthenticatedUser
from app.services.ai.mock_provider import MockAIProvider


def _format_pass(msg: str):
    print(f"  [PASS] {msg}")


def _format_fail(msg: str):
    print(f"  [FAIL] {msg}")
    raise AssertionError(msg)


def test_scenario_1_revenue_ranking():
    print("\n--- Scenario 1: Revenue Ranking (Which companies generate the most revenue?) ---")
    prompt = "Which companies generate the most revenue?"
    
    mock_comparison = {
        "status": "success",
        "comparison": {
            "period_months": 6,
            "companies": [
                {"company_name": "Jeevan Clothing Company", "code": "JCC", "total_revenue_lakh": 340.5, "avg_profit_margin_pct": 24.2},
                {"company_name": "Precot Meridian Limited", "code": "PML", "total_revenue_lakh": 290.0, "avg_profit_margin_pct": 21.5},
                {"company_name": "Arvind Smart Textiles", "code": "AST", "total_revenue_lakh": 210.0, "avg_profit_margin_pct": 28.0},
                {"company_name": "KPR Mill Limited", "code": "KPR", "total_revenue_lakh": 180.0, "avg_profit_margin_pct": 19.8},
            ]
        }
    }

    artifacts = generate_artifacts_from_tool_result(
        tool_name="compare_companies",
        tool_args={"period_months": 6},
        tool_result=mock_comparison,
        user_prompt=prompt
    )

    chart = next((a for a in artifacts if a["type"] == "chart"), None)
    assert chart is not None, "Chart artifact must be generated"
    _format_pass(f"Chart generated: '{chart['title']}'")

    assert chart["data"]["chartType"] == "horizontal_bar", f"Expected horizontal_bar, got {chart['data']['chartType']}"
    _format_pass("Chart type is 'horizontal_bar'")

    assert "Ranked" in chart["title"] and "Revenue" in chart["title"], f"Title must be descriptive: {chart['title']}"
    _format_pass("Title contains descriptive dimension and metric")

    points = chart["data"]["dataPoints"]
    assert points[0]["code"] == "JCC" and points[-1]["code"] == "KPR", "Data points must be sorted descending by revenue"
    _format_pass(f"Points correctly sorted: #1 {points[0]['code']} ({points[0]['total_revenue_lakh']}L) -> #{len(points)} {points[-1]['code']}")

    kpi = next((a for a in artifacts if a["type"] == "kpi"), None)
    assert kpi is not None and "Revenue" in kpi["title"], "Revenue leader KPI must be generated"
    _format_pass(f"Leader KPI generated: {kpi['title']} -> {kpi['data']['value']}")


def test_scenario_2_profit_margin_ranking():
    print("\n--- Scenario 2: Margin Ranking (Top 3 highest margin mills) ---")
    prompt = "Top 3 highest margin mills over the last 6 months"

    mock_comparison = {
        "status": "success",
        "comparison": {
            "period_months": 6,
            "companies": [
                {"company_name": "Jeevan Clothing Company", "code": "JCC", "total_revenue_lakh": 340.5, "avg_profit_margin_pct": 24.2},
                {"company_name": "Precot Meridian Limited", "code": "PML", "total_revenue_lakh": 290.0, "avg_profit_margin_pct": 21.5},
                {"company_name": "Arvind Smart Textiles", "code": "AST", "total_revenue_lakh": 210.0, "avg_profit_margin_pct": 28.0},
                {"company_name": "KPR Mill Limited", "code": "KPR", "total_revenue_lakh": 180.0, "avg_profit_margin_pct": 19.8},
            ]
        }
    }

    artifacts = generate_artifacts_from_tool_result(
        tool_name="compare_companies",
        tool_args={"period_months": 6},
        tool_result=mock_comparison,
        user_prompt=prompt
    )

    chart = next((a for a in artifacts if a["type"] == "chart"), None)
    assert chart is not None, "Chart artifact must be generated"
    assert chart["data"]["chartType"] == "horizontal_bar", f"Expected horizontal_bar, got {chart['data']['chartType']}"
    _format_pass(f"Margin ranking chart generated: '{chart['title']}' with type {chart['data']['chartType']}")

    points = chart["data"]["dataPoints"]
    assert len(points) == 3, f"Expected exactly 3 points for top-3, got {len(points)}"
    _format_pass("Top 3 limit strictly respected: 3 points returned")

    assert points[0]["code"] == "AST", "Top margin entity must be AST (28.0%)"
    _format_pass(f"Top performer: {points[0]['company_name']} ({points[0]['avg_profit_margin_pct']}%)")

    assert chart["data"]["series"][0]["key"] == "avg_profit_margin_pct"
    _format_pass("Chart series accurately bound to 'avg_profit_margin_pct'")


def test_scenario_3_time_series_trend():
    print("\n--- Scenario 3: Time-Series Revenue Trend (How has revenue changed over the last 12 months?) ---")
    prompt = "How has revenue changed over the last 12 months?"

    mock_trend = {
        "status": "success",
        "sales_trend": {
            "period_months": 12,
            "total_period_revenue_lakh": 1250.0,
            "avg_monthly_revenue_lakh": 104.16,
            "series": [
                {"month": "Jan 2025", "revenue_lakh": 90.0, "growth_pct": 0},
                {"month": "Feb 2025", "revenue_lakh": 95.0, "growth_pct": 5.5},
                {"month": "Mar 2025", "revenue_lakh": 105.0, "growth_pct": 10.5},
                {"month": "Apr 2025", "revenue_lakh": 110.0, "growth_pct": 4.8},
            ]
        }
    }

    artifacts = generate_artifacts_from_tool_result(
        tool_name="get_sales_trend",
        tool_args={"months": 12},
        tool_result=mock_trend,
        user_prompt=prompt
    )

    chart = next((a for a in artifacts if a["type"] == "chart"), None)
    assert chart is not None, "Chart must be generated"
    assert chart["data"]["chartType"] in ("line", "area"), f"Expected line/area, got {chart['data']['chartType']}"
    _format_pass(f"Time-series chart type: {chart['data']['chartType']}")

    assert "Monthly Sales Revenue Trend" in chart["title"] and "₹ Lakh" in chart["title"], f"Title: {chart['title']}"
    _format_pass(f"Descriptive title with exact currency unit: '{chart['title']}'")

    assert chart["data"]["xKey"] == "month"
    assert len(chart["data"]["dataPoints"]) == 4
    _format_pass("4 chronological monthly points verified")


def test_scenario_4_comparative_revenue_vs_profit():
    print("\n--- Scenario 4: Comparative Revenue vs Profit (What is our revenue versus expenditure?) ---")
    prompt = "What is our revenue versus expenditure across companies?"

    mock_comparison = {
        "status": "success",
        "comparison": {
            "period_months": 6,
            "companies": [
                {"company_name": "Jeevan Clothing", "code": "JCC", "total_revenue_lakh": 340.0, "total_gross_profit_lakh": 85.0, "avg_profit_margin_pct": 25.0},
                {"company_name": "Precot Meridian", "code": "PML", "total_revenue_lakh": 290.0, "total_gross_profit_lakh": 65.0, "avg_profit_margin_pct": 22.4},
            ]
        }
    }

    artifacts = generate_artifacts_from_tool_result(
        tool_name="compare_companies",
        tool_args={"period_months": 6},
        tool_result=mock_comparison,
        user_prompt=prompt
    )

    chart = next((a for a in artifacts if a["type"] == "chart"), None)
    assert chart is not None, "Comparative chart must be generated"
    assert chart["data"]["chartType"] == "bar", f"Expected grouped bar, got {chart['data']['chartType']}"
    _format_pass(f"Comparative chart format: {chart['data']['chartType']}")

    series = chart["data"]["series"]
    assert len(series) == 2, f"Expected 2 series for comparison, got {len(series)}"
    series_keys = [s["key"] for s in series]
    assert "total_revenue_lakh" in series_keys and "total_gross_profit_lakh" in series_keys
    _format_pass("Dual comparative series: Revenue (₹ Lakh) & Gross Profit (₹ Lakh)")

    assert "Comparative Revenue vs Gross Profit" in chart["title"]
    _format_pass(f"Verified chart title: '{chart['title']}'")


def test_scenario_5_redundant_chart_suppression():
    print("\n--- Scenario 5: Redundant Chart Suppression for Detailed Records ---")
    prompt = "Show me the detailed account records for all ledger accounts"

    mock_sql_result = {
        "status": "success",
        "rows": [
            {"account_code": "1001", "account_name": "Sales Revenue", "balance_lakh": 450.0},
            {"account_code": "2001", "account_name": "Raw Cotton Inventory", "balance_lakh": 120.0},
            {"account_code": "3001", "account_name": "Accounts Payable", "balance_lakh": 85.0},
            {"account_code": "4001", "account_name": "Operating Expenses", "balance_lakh": 65.0},
        ],
        "columns": ["account_code", "account_name", "balance_lakh"],
        "execution_time_ms": 12
    }

    artifacts = generate_artifacts_from_tool_result(
        tool_name="execute_sql_query",
        tool_args={"query": "SELECT * FROM LedgerAccounts"},
        tool_result=mock_sql_result,
        user_prompt=prompt
    )

    table = next((a for a in artifacts if a["type"] == "table"), None)
    assert table is not None, "Table artifact must be generated for detailed records"
    _format_pass(f"Table artifact generated: '{table['title']}' with {len(table['data']['rows'])} rows")

    charts = [a for a in artifacts if a["type"] == "chart"]
    assert len(charts) == 0, f"Redundant chart must be suppressed! Found: {len(charts)} chart(s)"
    _format_pass("Redundant chart successfully suppressed as requested by Section 17.1 & 17.2")


def test_scenario_6_multi_turn_visual_refinement():
    print("\n--- Scenario 6: Multi-Turn Visual Refinement (Now show only top two) ---")
    admin = AuthenticatedUser(id="user_admin", email="admin@texvantage.com", name="Global Admin", role="ADMIN", company_id=None, authorized_company_ids=[])
    orchestrator = AIOrchestrator(repository=repo, user=admin, provider=MockAIProvider())

    conv_id = "conv_visual_refinement_test"
    
    # Turn 1
    turn1 = orchestrator.run_conversation_turn("Which companies have the highest profit margins?", conversation_id=conv_id)
    chart1 = next((a for a in turn1["artifacts"] if a["type"] == "chart"), None)
    assert chart1 is not None, "Turn 1 must produce a chart"
    assert chart1["data"]["chartType"] == "horizontal_bar"
    _format_pass(f"Turn 1 Chart: '{chart1['title']}' (Items: {len(chart1['data']['dataPoints'])})")

    # Turn 2: Follow-up refinement
    turn2 = orchestrator.run_conversation_turn("Now show only top two", conversation_id=conv_id)
    chart2 = next((a for a in turn2["artifacts"] if a["type"] == "chart"), None)
    assert chart2 is not None, "Turn 2 must produce an updated chart"
    assert chart2["data"]["chartType"] == "horizontal_bar"
    assert len(chart2["data"]["dataPoints"]) == 2, f"Expected 2 data points, got {len(chart2['data']['dataPoints'])}"
    _format_pass(f"Turn 2 Refined Chart: '{chart2['title']}' with exactly {len(chart2['data']['dataPoints'])} points")

    assert "Top 2" in chart2["title"]
    _format_pass("Title dynamically updated to 'Top 2 Enterprises Ranked by Gross Profit Margin (%)'")


def test_scenario_7_product_lines_ranking_and_share():
    print("\n--- Scenario 7: Product Lines Ranking & Share Composition ---")
    mock_products = {
        "status": "success",
        "top_products": [
            {"category_name": "Cotton Combed Yarn", "total_revenue_lakh": 240.0, "units_sold": 50000},
            {"category_name": "Organic Knitted Fabric", "total_revenue_lakh": 180.0, "units_sold": 35000},
            {"category_name": "Polyester Blend Fabric", "total_revenue_lakh": 120.0, "units_sold": 28000},
        ]
    }

    # Query A: Ranking
    prompt_a = "Top product categories by revenue"
    art_a = generate_artifacts_from_tool_result("get_top_products", {}, mock_products, prompt_a)
    chart_a = next((a for a in art_a if a["type"] == "chart"), None)
    assert chart_a is not None
    assert chart_a["data"]["chartType"] == "horizontal_bar"
    _format_pass(f"Ranking query produces horizontal_bar: '{chart_a['title']}'")

    # Query B: Share / Distribution
    prompt_b = "Product revenue distribution and share breakdown"
    art_b = generate_artifacts_from_tool_result("get_top_products", {}, mock_products, prompt_b)
    chart_b = next((a for a in art_b if a["type"] == "chart"), None)
    assert chart_b is not None
    assert chart_b["data"]["chartType"] == "donut"
    _format_pass(f"Share query produces donut: '{chart_b['title']}'")


if __name__ == "__main__":
    print("======================================================================")
    print("TEXVANTAGE AI — SECTION 17 QUESTION-DRIVEN VISUALIZATION ACCEPTANCE TEST")
    print("======================================================================")

    test_scenario_1_revenue_ranking()
    test_scenario_2_profit_margin_ranking()
    test_scenario_3_time_series_trend()
    test_scenario_4_comparative_revenue_vs_profit()
    test_scenario_5_redundant_chart_suppression()
    test_scenario_6_multi_turn_visual_refinement()
    test_scenario_7_product_lines_ranking_and_share()

    print("\n======================================================================")
    print("ALL 7 SECTION 17 SCENARIOS PASSED WITH ZERO ERRORS (100.0%)")
    print("======================================================================")
