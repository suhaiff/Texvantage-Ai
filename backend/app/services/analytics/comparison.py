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
    Safely handles None values without raising TypeError.
    """
    sorted_companies = sorted(
        companies_data,
        key=lambda x: (
            x.get(metric) is not None,
            x.get(metric) if x.get(metric) is not None else float("-inf" if descending else "inf")
        ),
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
    Safely handles companies with partial or zero financial data.
    """
    comparison_records: List[Dict[str, Any]] = []

    for c in companies:
        records = financials_by_company.get(c.id, [])
        if period_months and len(records) > period_months:
            records = records[-period_months:]

        agg = compute_financial_aggregate(records)

        growth_pct = 0.0
        if len(records) >= 2:
            calc_growth = calculate_growth_rate(records[-1].revenue_lakh, records[0].revenue_lakh)
            growth_pct = calc_growth if calc_growth is not None else 0.0

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
            "weighted_profit_margin_pct": agg["average_profit_margin_pct"],
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
    total_portfolio_rev = round(sum(valid_revenues), 2) if valid_revenues else 0.0

    valid_profits = [r["total_gross_profit_lakh"] for r in ranked_by_revenue if r.get("total_gross_profit_lakh") is not None]
    total_portfolio_profit = round(sum(valid_profits), 2) if valid_profits else 0.0

    if total_portfolio_rev and total_portfolio_profit:
        portfolio_avg_margin = round((total_portfolio_profit / total_portfolio_rev * 100.0), 2)
    else:
        portfolio_avg_margin = None

    valid_margin_comps = [r for r in ranked_by_revenue if r.get("avg_profit_margin_pct") is not None]
    highest_margin_comp = max(valid_margin_comps, key=lambda x: x["avg_profit_margin_pct"]) if valid_margin_comps else None

    valid_growth_comps = [r for r in ranked_by_revenue if r.get("revenue_growth_pct") is not None]
    highest_growth_comp = max(valid_growth_comps, key=lambda x: x["revenue_growth_pct"]) if valid_growth_comps else None
    highest_revenue_comp = ranked_by_revenue[0] if ranked_by_revenue else None

    total_units_sold = sum((r.get("total_units_sold") or 0) for r in ranked_by_revenue)

    return {
        "period_months": period_months,
        "companies_count": len(ranked_by_revenue),
        "total_portfolio_revenue_lakh": total_portfolio_rev,
        "total_portfolio_gross_profit_lakh": total_portfolio_profit,
        "portfolio_average_margin_pct": portfolio_avg_margin,
        "portfolio_weighted_margin_pct": portfolio_avg_margin,
        "total_units_sold": total_units_sold,
        "top_performing_company": {
            "code": highest_revenue_comp["code"],
            "name": highest_revenue_comp["company_name"],
            "revenue_lakh": highest_revenue_comp["total_revenue_lakh"]
        } if highest_revenue_comp else None,
        "highest_margin_company": {
            "code": highest_margin_comp["code"],
            "name": highest_margin_comp["company_name"],
            "weighted_profit_margin_pct": highest_margin_comp["avg_profit_margin_pct"]
        } if highest_margin_comp else None,
        "fastest_growing_company": {
            "code": highest_growth_comp["code"],
            "name": highest_growth_comp["company_name"],
            "growth_pct": highest_growth_comp["revenue_growth_pct"]
        } if highest_growth_comp else None,
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
