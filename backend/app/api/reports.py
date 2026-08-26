from fastapi import APIRouter, Depends, Response, Query
from typing import Optional, List
import datetime
import urllib.parse

from ..core.dependencies import get_current_user, get_repository
from ..repositories.base import IDataRepository
from ..schemas.auth import AuthenticatedUser
from ..schemas.reports import ExcelReportRequest, ReportMetadataResponse
from ..services.analytics.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

@router.post("/excel", summary="Generate Professional Executive Excel Report")
def generate_excel_report(
    req: ExcelReportRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """
    Authoritative Server-Side Excel Report Generation.
    Returns a multi-sheet .xlsx workbook generated strictly from verified database records.
    Enforces row-level tenant security (Owner restricted to own enterprise; Admin can compare or aggregate).
    """
    service = ReportService(repository, current_user)
    excel_stream = service.generate_excel_report(
        report_type=req.report_type,
        company_ids=req.company_ids,
        company_id=req.company_id,
        period_months=req.period_months,
        analysis_context=req.analysis_context,
        title=req.title
    )

    # Determine a professional and clean safe filename
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    if not current_user.is_admin():
        comp = repository.get_company_by_id(current_user.company_id)
        comp_code = comp.code if comp else "COMPANY"
        filename = f"TexVantage_Executive_Report_{comp_code}_{timestamp_str}.xlsx"
    elif req.company_ids and len(req.company_ids) > 1:
        filename = f"TexVantage_Portfolio_Comparison_{len(req.company_ids)}_Enterprises_{timestamp_str}.xlsx"
    elif req.company_id:
        comp = repository.get_company_by_id(req.company_id)
        comp_code = comp.code if comp else req.company_id
        filename = f"TexVantage_Executive_Report_{comp_code}_{timestamp_str}.xlsx"
    else:
        filename = f"TexVantage_Global_Portfolio_Report_{timestamp_str}.xlsx"

    # Sanitize filename for headers
    safe_filename = urllib.parse.quote(filename)

    return Response(
        content=excel_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{safe_filename}',
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Cache-Control": "no-cache, no-store, must-revalidate"
        }
    )

@router.get("/metadata", response_model=ReportMetadataResponse, summary="Get Report Capabilities & Tenant Scope")
def get_report_metadata(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Returns the authorized report scope and supported sheets."""
    if current_user.is_admin():
        companies = repository.get_companies()
        scope = "Global Administrator (All Enterprises)"
        comps = [c.name for c in companies]
        sheets = ["Executive Summary", "Company Comparison", "Monthly Performance", "Product Performance", "Data Sources"]
    else:
        comp = repository.get_company_by_id(current_user.company_id) if current_user.company_id else None
        scope = f"Single Enterprise ({comp.name if comp else current_user.company_id})"
        comps = [comp.name] if comp else []
        sheets = ["Executive Summary", "Financial Performance", "Monthly Trend", "Product Performance", "Data Sources"]

    return ReportMetadataResponse(
        report_id=f"rep_meta_{current_user.id}",
        report_title="TexVantage Executive Business Intelligence Report",
        generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        tenant_scope=scope,
        companies_included=comps,
        sheets=sheets
    )
