from pydantic import BaseModel, Field
from typing import List, Optional

class ExcelReportRequest(BaseModel):
    report_type: str = Field(default="executive", description="'executive' (single company) or 'portfolio' / 'comparison' (multi-company)")
    company_ids: Optional[List[str]] = Field(default=None, description="List of company IDs for Admin multi-company export")
    company_id: Optional[str] = Field(default=None, description="Single company ID for single-company export")
    period_months: int = Field(default=6, ge=1, le=24, description="Analysis window in months")
    analysis_context: Optional[str] = Field(default=None, description="Optional AI analysis findings or context to embed")
    title: Optional[str] = Field(default=None, description="Custom report title")

class ReportMetadataResponse(BaseModel):
    report_id: str
    report_title: str
    generated_at: str
    tenant_scope: str
    companies_included: List[str]
    sheets: List[str]
