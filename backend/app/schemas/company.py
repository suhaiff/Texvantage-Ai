from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class CompanySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    specialization: str
    city: str
    state: str
    founded_year: int
    latest_monthly_revenue_lakh: Optional[float] = None
    latest_profit_margin_pct: Optional[float] = None
    revenue_growth_pct: Optional[float] = None
    dataset_count: int = 0
    status: str = "Active"

class CompanyDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: str
    specialization: str
    city: str
    state: str
    founded_year: int
    annual_capacity_description: str
    created_at: datetime
    latest_metrics: Optional[dict] = None
