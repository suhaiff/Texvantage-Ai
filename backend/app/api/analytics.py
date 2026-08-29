from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from ..core.dependencies import get_current_user, get_repository, require_admin
from ..repositories.base import IDataRepository
from ..schemas.auth import AuthenticatedUser
from ..schemas.analytics import CompanyComparisonRequest
from ..services.analytics.query_service import BusinessQueryService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary")
def get_summary(
    company_id: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Get company executive summary and KPIs."""
    service = BusinessQueryService(repository, current_user)
    return service.get_company_summary(company_id)

@router.get("/sales-trend")
def get_sales_trend(
    company_id: Optional[str] = None,
    months: int = Query(default=6, ge=1, le=24),
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Get sales and unit volume trends."""
    service = BusinessQueryService(repository, current_user)
    return service.get_sales_trend(company_id, months=months)

@router.get("/profit-trend")
def get_profit_trend(
    company_id: Optional[str] = None,
    months: int = Query(default=6, ge=1, le=24),
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Get profit and margin trends."""
    service = BusinessQueryService(repository, current_user)
    return service.get_profit_trend(company_id, months=months)

@router.get("/top-products")
def get_top_products(
    company_id: Optional[str] = None,
    limit: int = Query(default=5, ge=1, le=20),
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Get top revenue products."""
    service = BusinessQueryService(repository, current_user)
    return service.get_top_products(company_id, limit=limit)

@router.get("/financials")
def get_financials(
    company_id: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Get monthly financials list for authorized company."""
    service = BusinessQueryService(repository, current_user)
    return service.get_monthly_financials(company_id=company_id)

@router.post("/compare")
def compare_companies(
    req: CompanyComparisonRequest,
    current_user: AuthenticatedUser = Depends(require_admin),
    repository: IDataRepository = Depends(get_repository)
):
    """ADMIN ONLY: Compare multiple companies side-by-side."""
    service = BusinessQueryService(repository, current_user)
    return service.get_company_comparison(req.company_ids, period_months=req.period_months)

@router.get("/global-summary")
def get_global_summary(
    period_months: int = Query(default=6, ge=1, le=24),
    current_user: AuthenticatedUser = Depends(require_admin),
    repository: IDataRepository = Depends(get_repository)
):
    """ADMIN ONLY: Portfolio-wide aggregation across all 10 companies."""
    service = BusinessQueryService(repository, current_user)
    return service.get_global_summary(period_months=period_months)

@router.get("/schema")
def get_database_schema(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Reflect the database schema and return tables/columns."""
    from sqlalchemy import inspect
    if not hasattr(repository, "engine"):
        return {"tables": []}
    
    engine = repository.engine
    inspector = inspect(engine)
    tables = []
    
    for table_name in inspector.get_table_names():
        columns = [{"name": c["name"], "type": str(c["type"])} for c in inspector.get_columns(table_name)]
        tables.append({"name": table_name, "columns": columns})
        
    return {"tables": tables}
