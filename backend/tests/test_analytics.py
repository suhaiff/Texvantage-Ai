import pytest
from app.services.analytics.metrics import (
    calculate_gross_profit,
    calculate_net_profit,
    calculate_profit_margin,
    calculate_average_order_value,
    calculate_growth_rate,
    compute_financial_aggregate,
    compute_mom_growth,
    find_highest_lowest_periods
)
from app.services.analytics.comparison import rank_companies_by_metric, compare_multiple_companies
from app.models.financials import MonthlyFinancials
from datetime import date

def test_basic_metric_calculations():
    # 1. Gross Profit
    assert calculate_gross_profit(100.0, 60.0) == 40.0
    assert calculate_gross_profit(348.5, 230.2) == 118.3

    # 2. Net Profit
    assert calculate_net_profit(118.3, 40.0) == 78.3

    # 3. Profit Margin %
    assert calculate_profit_margin(40.0, 100.0) == 40.0
    assert calculate_profit_margin(0.0, 100.0) == 0.0
    assert calculate_profit_margin(10.0, 0.0) == 0.0 # Division by zero protected

    # 4. Average Order Value (AOV) in INR
    # 10 Lakhs = 1,000,000 INR across 100 orders = 10,000 INR
    assert calculate_average_order_value(10.0, 100) == 10000.0
    assert calculate_average_order_value(0.0, 0) == 0.0

    # 5. Growth Rate %
    assert calculate_growth_rate(120.0, 100.0) == 20.0
    assert calculate_growth_rate(80.0, 100.0) == -20.0
    assert calculate_growth_rate(100.0, 0.0) == 100.0

def test_financial_aggregate_computation():
    records = [
        MonthlyFinancials(
            id="f1", company_id="comp_a", year=2025, month=1, period_date=date(2025, 1, 1),
            month_name="Jan 2025", revenue_lakh=100.0, cogs_lakh=60.0, gross_profit_lakh=40.0,
            profit_margin_pct=40.0, operating_expenses_lakh=15.0, net_profit_lakh=25.0,
            units_produced=10000, units_sold=9000, orders_count=150, avg_order_value_inr=66666.67,
            capacity_utilization_pct=85.0
        ),
        MonthlyFinancials(
            id="f2", company_id="comp_a", year=2025, month=2, period_date=date(2025, 2, 1),
            month_name="Feb 2025", revenue_lakh=150.0, cogs_lakh=90.0, gross_profit_lakh=60.0,
            profit_margin_pct=40.0, operating_expenses_lakh=20.0, net_profit_lakh=40.0,
            units_produced=15000, units_sold=14000, orders_count=200, avg_order_value_inr=75000.00,
            capacity_utilization_pct=90.0
        )
    ]

    agg = compute_financial_aggregate(records)
    assert agg["record_count"] == 2
    assert agg["total_revenue_lakh"] == 250.0
    assert agg["total_gross_profit_lakh"] == 100.0
    assert agg["average_profit_margin_pct"] == 40.0
    assert agg["total_units_sold"] == 23000
    assert agg["total_orders"] == 350
    assert agg["average_capacity_utilization_pct"] == 87.5
    assert agg["average_monthly_revenue_lakh"] == 125.0

def test_mom_growth_series():
    records = [
        MonthlyFinancials(
            id="f1", company_id="comp_a", year=2025, month=1, period_date=date(2025, 1, 1),
            month_name="Jan 2025", revenue_lakh=100.0, cogs_lakh=60.0, gross_profit_lakh=40.0,
            profit_margin_pct=40.0, operating_expenses_lakh=10.0, net_profit_lakh=30.0,
            units_produced=10000, units_sold=10000, orders_count=100, avg_order_value_inr=100000.0,
            capacity_utilization_pct=80.0
        ),
        MonthlyFinancials(
            id="f2", company_id="comp_a", year=2025, month=2, period_date=date(2025, 2, 1),
            month_name="Feb 2025", revenue_lakh=120.0, cogs_lakh=70.0, gross_profit_lakh=50.0,
            profit_margin_pct=41.67, operating_expenses_lakh=12.0, net_profit_lakh=38.0,
            units_produced=12000, units_sold=12000, orders_count=120, avg_order_value_inr=100000.0,
            capacity_utilization_pct=88.0
        )
    ]

    mom = compute_mom_growth(records)
    assert len(mom) == 2
    assert mom[0]["revenue_growth_pct"] == 0.0
    assert mom[1]["revenue_growth_pct"] == 20.0
    assert mom[1]["revenue_change_lakh"] == 20.0

def test_peaks_and_troughs():
    records = [
        MonthlyFinancials(
            id="f1", company_id="comp_a", year=2025, month=1, period_date=date(2025, 1, 1),
            month_name="Jan 2025", revenue_lakh=200.0, cogs_lakh=120.0, gross_profit_lakh=80.0,
            profit_margin_pct=40.0, operating_expenses_lakh=20.0, net_profit_lakh=60.0,
            units_produced=20000, units_sold=20000, orders_count=200, avg_order_value_inr=100000.0,
            capacity_utilization_pct=85.0
        ),
        MonthlyFinancials(
            id="f2", company_id="comp_a", year=2025, month=2, period_date=date(2025, 2, 1),
            month_name="Feb 2025", revenue_lakh=350.0, cogs_lakh=210.0, gross_profit_lakh=140.0,
            profit_margin_pct=40.0, operating_expenses_lakh=30.0, net_profit_lakh=110.0,
            units_produced=35000, units_sold=35000, orders_count=350, avg_order_value_inr=100000.0,
            capacity_utilization_pct=95.0
        ),
        MonthlyFinancials(
            id="f3", company_id="comp_a", year=2025, month=3, period_date=date(2025, 3, 1),
            month_name="Mar 2025", revenue_lakh=150.0, cogs_lakh=80.0, gross_profit_lakh=70.0,
            profit_margin_pct=46.67, operating_expenses_lakh=15.0, net_profit_lakh=55.0,
            units_produced=15000, units_sold=15000, orders_count=150, avg_order_value_inr=100000.0,
            capacity_utilization_pct=75.0
        )
    ]

    peaks = find_highest_lowest_periods(records)
    assert peaks["highest_revenue"]["month"] == "Feb 2025"
    assert peaks["highest_revenue"]["revenue_lakh"] == 350.0
    assert peaks["lowest_revenue"]["month"] == "Mar 2025"
    assert peaks["lowest_revenue"]["revenue_lakh"] == 150.0
    assert peaks["highest_margin"]["month"] == "Mar 2025"
    assert peaks["highest_margin"]["margin_pct"] == 46.67
