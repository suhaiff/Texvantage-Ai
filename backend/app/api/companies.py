from fastapi import APIRouter, Depends
from typing import List
from ..core.dependencies import get_current_user, get_repository, TenantGuard
from ..core.exceptions import ForbiddenError, NotFoundError
from ..repositories.base import IDataRepository
from ..schemas.auth import AuthenticatedUser
from ..schemas.company import CompanySummary, CompanyDetail

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.get("", response_model=List[CompanySummary])
def list_companies(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """
    List accessible companies with latest monthly KPIs.
    - If ADMIN: Returns all 10 companies across the portfolio.
    - If OWNER: Strictly returns only the owner's company.
    """
    authorized_ids = current_user.authorized_company_ids
    companies = repository.get_companies(authorized_company_ids=authorized_ids)
    
    # Get latest financials to compute summary cards
    latest_fin_map = repository.get_latest_financials_for_companies(authorized_ids)
    
    summaries: List[CompanySummary] = []
    for c in companies:
        latest = latest_fin_map.get(c.id)
        summaries.append(CompanySummary(
            id=c.id,
            name=c.name,
            code=c.code,
            specialization=c.specialization,
            city=c.city,
            state=c.state,
            founded_year=c.founded_year,
            latest_monthly_revenue_lakh=latest.revenue_lakh if latest else None,
            latest_profit_margin_pct=latest.profit_margin_pct if latest else None,
            dataset_count=1,
            status="Active"
        ))
    
    return summaries

@router.get("/{company_id}", response_model=CompanyDetail)
def get_company_detail(
    company_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """
    Retrieve comprehensive company profile.
    - Enforces TenantGuard: Non-admin users attempting to inspect other companies
      receive HTTP 403 Forbidden.
    """
    # Strict server-side authorization check
    TenantGuard.enforce_company_access(current_user, company_id)

    company = repository.get_company_by_id(company_id)
    if not company:
        raise NotFoundError(f"Company '{company_id}' not found")
    
    latest_fin_map = repository.get_latest_financials_for_companies([company_id])
    latest = latest_fin_map.get(company_id)
    latest_metrics = None
    if latest:
        latest_metrics = {
            "period": latest.month_name,
            "revenue_lakh": latest.revenue_lakh,
            "profit_margin_pct": latest.profit_margin_pct,
            "gross_profit_lakh": latest.gross_profit_lakh,
            "units_sold": latest.units_sold,
            "capacity_utilization_pct": latest.capacity_utilization_pct
        }

    return CompanyDetail(
        id=company.id,
        name=company.name,
        code=company.code,
        specialization=company.specialization,
        city=company.city,
        state=company.state,
        founded_year=company.founded_year,
        annual_capacity_description=company.annual_capacity_description,
        created_at=company.created_at,
        latest_metrics=latest_metrics
    )
