from app.services.ai.artifacts import generate_artifacts_from_tool_result


def test_sales_trend_emits_camelcase_kpis_and_chart():
    result = generate_artifacts_from_tool_result(
        tool_name="get_sales_trend",
        tool_args={"company_id": "comp_a", "months": 12},
        tool_result={
            "status": "success",
            "sales_trend": {
                "period_months": 3,
                "total_period_revenue_lakh": 300.0,
                "avg_monthly_revenue_lakh": 100.0,
                "series": [
                    {"month": "Jan 2026", "revenue_lakh": 90.0, "units_sold": 10, "growth_pct": 0},
                    {"month": "Feb 2026", "revenue_lakh": 100.0, "units_sold": 12, "growth_pct": 11.1},
                    {"month": "Mar 2026", "revenue_lakh": 110.0, "units_sold": 14, "growth_pct": 10.0},
                ],
            },
        },
        user_prompt="Plot the 12-month revenue trend",
    )

    types = [a["type"] for a in result]
    assert types.count("kpi") == 2
    assert "chart" in types
    chart = next(a for a in result if a["type"] == "chart")
    assert "chart_type" not in chart["data"]
    assert chart["data"]["chartType"] in ("line", "area", "bar")
    assert chart["data"]["xKey"] == "month"
    assert len(chart["data"]["dataPoints"]) == 3
    assert chart["data"]["series"][0]["key"] == "revenue_lakh"


def test_failed_tool_does_not_fabricate_artifacts():
    result = generate_artifacts_from_tool_result(
        tool_name="get_sales_trend",
        tool_args={},
        tool_result={"status": "error", "message": "boom"},
        user_prompt="Plot revenue",
    )
    assert result == []
