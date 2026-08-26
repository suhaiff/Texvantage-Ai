from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import date

class MonthlyFinancialRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    company_name: Optional[str] = None
    year: int
    month: int
    period_date: date
    month_name: str
    revenue_lakh: float
    cogs_lakh: float
    gross_profit_lakh: float
    profit_margin_pct: float
    net_profit_lakh: float
    units_produced: int
    units_sold: int
    orders_count: int
    avg_order_value_inr: float
    capacity_utilization_pct: float

class KpiCard(BaseModel):
    label: str
    value: str
    numeric_value: float
    unit: str
    change_pct: Optional[float] = None
    change_label: Optional[str] = None
    trend: str = "neutral" # "up", "down", "neutral"
    status: str = "good" # "good", "warning", "neutral"

class DashboardSummaryResponse(BaseModel):
    scope: str # "COMPANY" or "GLOBAL"
    company_name: Optional[str] = None
    period_label: str
    kpis: List[KpiCard]
    monthly_trends: List[Dict[str, Any]]
    top_categories: List[Dict[str, Any]]

class CompanyComparisonRequest(BaseModel):
    company_ids: List[str]
    period_months: int = 6
    metrics: List[str] = ["revenue_lakh", "profit_margin_pct", "units_sold"]

class ComparisonRecord(BaseModel):
    company_id: str
    company_name: str
    total_revenue_lakh: float
    avg_monthly_revenue_lakh: float
    avg_profit_margin_pct: float
    total_units_sold: int
    revenue_growth_pct: float
    rank: int
