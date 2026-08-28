from typing import List, Dict, Any, Optional
from ...models.company import Company
from ...models.financials import MonthlyFinancials
from .metrics import compute_financial_aggregate, calculate_growth_rate

def rank_companies_by_metric(
    companies_data: List[Dict[str, Any]],
    metric: str = "total_revenue_lakh",
    descending: bool = True
) -> List[Dict[str, Any]]:
    """
    Ranks companies strictly and deterministically by metric.
    """
    sorted_companies = sorted(
        companies_data,
        key=lambda x: x.get(metric, 0.0),
        reverse=descending
    )
    for idx, c in enumerate(sorted_companies, 1):
        c["rank"] = idx
    return sorted_companies

def compare_multiple_companies(
    companies: List[Company],
    financials_by_company: Dict[str, List[MonthlyFinancials]],
    period_months: int = 6
) -> Dict[str, Any]:
    """
    Generates deterministic cross-company comparison and ranking analysis.
    """
    comparison_records: List[Dict[str, Any]] = []

    for c in companies:
        records = financials_by_company.get(c.id, [])
        if period_months and len(records) > period_months:
            records = records[-period_months:]

        agg = compute_financial_aggregate(records)

        growth_pct = 0.0
        if len(records) >= 2:
            growth_pct = calculate_growth_rate(records[-1].revenue_lakh, records[0].revenue_lakh)

        latest_record = records[-1] if records else None

        comparison_records.append({
            "company_id": c.id,
            "company_name": c.name,
            "code": c.code,
            "specialization": c.specialization,
            "city": c.city,
            "state": c.state,
            "founded_year": c.founded_year,
            "period_months_analyzed": len(records),
            "total_revenue_lakh": agg["total_revenue_lakh"],
            "avg_monthly_revenue_lakh": agg["average_monthly_revenue_lakh"],
            "avg_profit_margin_pct": agg["average_profit_margin_pct"],
            "total_gross_profit_lakh": agg["total_gross_profit_lakh"],
            "total_units_sold": agg["total_units_sold"],
            "avg_capacity_utilization_pct": agg["average_capacity_utilization_pct"],
            "revenue_growth_pct": growth_pct,
            "latest_month": latest_record.month_name if latest_record else "N/A",
            "latest_monthly_revenue_lakh": latest_record.revenue_lakh if latest_record else 0.0,
            "latest_profit_margin_pct": latest_record.profit_margin_pct if latest_record else 0.0
        })

    # Rank by revenue by default
    ranked_by_revenue = rank_companies_by_metric(comparison_records, "total_revenue_lakh", descending=True)

    # Compute portfolio aggregates
    valid_revenues = [r["total_revenue_lakh"] for r in ranked_by_revenue if r.get("total_revenue_lakh") is not None]
    total_portfolio_rev = round(sum(valid_revenues), 2) if valid_revenues else None

    valid_profits = [r["total_gross_profit_lakh"] for r in ranked_by_revenue if r.get("total_gross_profit_lakh") is not None]
    total_portfolio_profit = round(sum(valid_profits), 2) if valid_profits else None

    if total_portfolio_rev and total_portfolio_profit:
        portfolio_avg_margin = round((total_portfolio_profit / total_portfolio_rev * 100.0), 2)
    else:
        portfolio_avg_margin = None

    highest_margin_comp = max(ranked_by_revenue, key=lambda x: x["avg_profit_margin_pct"]) if ranked_by_revenue else None
    highest_growth_comp = max(ranked_by_revenue, key=lambda x: x["revenue_growth_pct"]) if ranked_by_revenue else None
    highest_revenue_comp = ranked_by_revenue[0] if ranked_by_revenue else None

    return {
        "period_months": period_months,
        "companies_count": len(ranked_by_revenue),
        "portfolio_summary": {
            "total_portfolio_revenue_lakh": total_portfolio_rev,
            "total_portfolio_gross_profit_lakh": total_portfolio_profit,
            "portfolio_weighted_margin_pct": portfolio_avg_margin,
            "top_revenue_performer": highest_revenue_comp["company_name"] if highest_revenue_comp else None,
            "highest_margin_performer": highest_margin_comp["company_name"] if highest_margin_comp else None,
            "fastest_growth_performer": highest_growth_comp["company_name"] if highest_growth_comp else None
        },
        "companies": ranked_by_revenue
    }
