from typing import List, Dict, Any, Optional
from datetime import date
from ...models.financials import MonthlyFinancials

def calculate_gross_profit(revenue_lakh: Optional[float], cogs_lakh: Optional[float]) -> Optional[float]:
    """Calculate gross profit in Lakh INR if both revenue and COGS are provided."""
    if cogs_lakh is None or revenue_lakh is None:
        return None
    return round(revenue_lakh - cogs_lakh, 2)

def calculate_net_profit(gross_profit_lakh: Optional[float], operating_expenses_lakh: Optional[float]) -> Optional[float]:
    """Calculate net profit in Lakh INR if both inputs exist."""
    if gross_profit_lakh is None or operating_expenses_lakh is None:
        return None
    return round(gross_profit_lakh - operating_expenses_lakh, 2)

def calculate_profit_margin(net_or_gross_profit_lakh: Optional[float], revenue_lakh: Optional[float]) -> Optional[float]:
    """Calculate profit margin percentage if profit is available. Protected against division by zero."""
    if net_or_gross_profit_lakh is None or revenue_lakh is None:
        return None
    if revenue_lakh == 0:
        return 0.0
    return round((net_or_gross_profit_lakh / revenue_lakh) * 100.0, 2)

def calculate_average_order_value(revenue_lakh: Optional[float], orders_count: Optional[int]) -> Optional[float]:
    """Calculate Average Order Value (AOV) in INR."""
    if revenue_lakh is None or orders_count is None:
        return None
    if orders_count == 0:
        return 0.0
    revenue_inr = revenue_lakh * 100_000.0
    return round(revenue_inr / orders_count, 2)

def calculate_growth_rate(current: Optional[float], previous: Optional[float]) -> Optional[float]:
    """Calculate percentage growth rate between two periods."""
    if current is None or previous is None:
        return None
    if previous == 0:
        return 0.0 if current == 0 else 100.0
    return round(((current - previous) / previous) * 100.0, 2)

def compute_financial_aggregate(records: List[MonthlyFinancials]) -> Dict[str, Any]:
    """
    Deterministically computes totals and weighted averages across monthly financial records.
    Never relies on AI for arithmetic aggregation.
    """
    if not records:
        return {
            "record_count": 0,
            "total_revenue_lakh": 0.0,
            "total_cogs_lakh": None,
            "total_gross_profit_lakh": None,
            "total_operating_expenses_lakh": None,
            "total_net_profit_lakh": None,
            "average_profit_margin_pct": None,
            "total_units_produced": None,
            "total_units_sold": None,
            "total_orders": None,
            "average_capacity_utilization_pct": None,
            "average_monthly_revenue_lakh": 0.0
        }

    total_revenue = sum(r.revenue_lakh for r in records if r.revenue_lakh is not None)
    
    cogs_list = [r.cogs_lakh for r in records if r.cogs_lakh is not None]
    total_cogs = round(sum(cogs_list), 2) if cogs_list else None
    
    gp_list = [r.gross_profit_lakh for r in records if r.gross_profit_lakh is not None]
    total_gross_profit = round(sum(gp_list), 2) if gp_list else None
    
    opex_list = [r.operating_expenses_lakh for r in records if r.operating_expenses_lakh is not None]
    total_opex = round(sum(opex_list), 2) if opex_list else None
    
    net_list = [r.net_profit_lakh for r in records if r.net_profit_lakh is not None]
    total_net_profit = round(sum(net_list), 2) if net_list else None
    
    produced_list = [r.units_produced for r in records if r.units_produced is not None]
    total_units_produced = sum(produced_list) if produced_list else None
    
    sold_list = [r.units_sold for r in records if r.units_sold is not None]
    total_units_sold = sum(sold_list) if sold_list else None
    
    orders_list = [r.orders_count for r in records if r.orders_count is not None]
    total_orders = sum(orders_list) if orders_list else None
    
    cap_list = [r.capacity_utilization_pct for r in records if r.capacity_utilization_pct is not None]
    avg_capacity = round(sum(cap_list) / len(cap_list), 2) if cap_list else None
    
    avg_margin = round((total_gross_profit / total_revenue * 100.0), 2) if (total_gross_profit is not None and total_revenue > 0) else None
    avg_monthly_rev = round(total_revenue / len(records), 2) if records else 0.0

    return {
        "record_count": len(records),
        "total_revenue_lakh": round(total_revenue, 2),
        "total_cogs_lakh": total_cogs,
        "total_gross_profit_lakh": total_gross_profit,
        "total_operating_expenses_lakh": total_opex,
        "total_net_profit_lakh": total_net_profit,
        "average_profit_margin_pct": avg_margin,
        "total_units_produced": total_units_produced,
        "total_units_sold": total_units_sold,
        "total_orders": total_orders,
        "average_capacity_utilization_pct": avg_capacity,
        "average_monthly_revenue_lakh": avg_monthly_rev
    }

def compute_mom_growth(records_sorted_by_date: List[MonthlyFinancials]) -> List[Dict[str, Any]]:
    """
    Computes Month-over-Month (MoM) revenue, profit, and unit growth series.
    """
    results = []
    prev_record: Optional[MonthlyFinancials] = None

    for r in records_sorted_by_date:
        entry = {
            "period": r.month_name,
            "period_date": r.period_date.isoformat(),
            "revenue_lakh": r.revenue_lakh,
            "gross_profit_lakh": r.gross_profit_lakh,
            "profit_margin_pct": r.profit_margin_pct,
            "units_sold": r.units_sold,
            "orders_count": r.orders_count,
            "capacity_utilization_pct": r.capacity_utilization_pct,
            "revenue_growth_pct": 0.0 if prev_record is None else None,
            "profit_growth_pct": 0.0 if prev_record is None else None,
            "units_growth_pct": 0.0 if prev_record is None else None,
            "revenue_change_lakh": 0.0 if prev_record is None else None
        }

        if prev_record is not None:
            if r.revenue_lakh is not None and prev_record.revenue_lakh is not None:
                entry["revenue_growth_pct"] = calculate_growth_rate(r.revenue_lakh, prev_record.revenue_lakh)
                entry["revenue_change_lakh"] = round(r.revenue_lakh - prev_record.revenue_lakh, 2)
            if r.gross_profit_lakh is not None and prev_record.gross_profit_lakh is not None:
                entry["profit_growth_pct"] = calculate_growth_rate(r.gross_profit_lakh, prev_record.gross_profit_lakh)
            if r.units_sold is not None and prev_record.units_sold is not None:
                entry["units_growth_pct"] = calculate_growth_rate(float(r.units_sold), float(prev_record.units_sold))

        results.append(entry)
        prev_record = r

    return results

def find_highest_lowest_periods(records: List[MonthlyFinancials]) -> Dict[str, Any]:
    """Finds peak and trough performance months for revenue and margin."""
    if not records:
        return {"highest_revenue": None, "lowest_revenue": None, "highest_margin": None, "lowest_margin": None}

    rev_records = [r for r in records if r.revenue_lakh is not None]
    margin_records = [r for r in records if r.profit_margin_pct is not None]

    highest_rev = max(rev_records, key=lambda r: r.revenue_lakh) if rev_records else None
    lowest_rev = min(rev_records, key=lambda r: r.revenue_lakh) if rev_records else None
    highest_margin = max(margin_records, key=lambda r: r.profit_margin_pct) if margin_records else None
    lowest_margin = min(margin_records, key=lambda r: r.profit_margin_pct) if margin_records else None

    return {
        "highest_revenue": {
            "month": highest_rev.month_name,
            "revenue_lakh": highest_rev.revenue_lakh,
            "profit_margin_pct": highest_rev.profit_margin_pct
        } if highest_rev else None,
        "lowest_revenue": {
            "month": lowest_rev.month_name,
            "revenue_lakh": lowest_rev.revenue_lakh,
            "profit_margin_pct": lowest_rev.profit_margin_pct
        } if lowest_rev else None,
        "highest_margin": {
            "month": highest_margin.month_name,
            "margin_pct": highest_margin.profit_margin_pct,
            "revenue_lakh": highest_margin.revenue_lakh
        } if highest_margin else None,
        "lowest_margin": {
            "month": lowest_margin.month_name,
            "margin_pct": lowest_margin.profit_margin_pct,
            "revenue_lakh": lowest_margin.revenue_lakh
        } if lowest_margin else None
    }
