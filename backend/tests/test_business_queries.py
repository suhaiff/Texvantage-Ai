import pytest
from app.repositories.dev_repo import repo
from app.services.analytics.query_service import BusinessQueryService
from app.schemas.auth import AuthenticatedUser
from app.core.exceptions import ForbiddenError, NotFoundError

@pytest.fixture
def admin_user():
    return AuthenticatedUser(
        id="user_admin_01",
        email="admin@demo.local",
        name="Global Admin",
        role="ADMIN",
        company_id=None,
        authorized_company_ids=[f"comp_textile_{c}" for c in "abcdefghij"]
    )

@pytest.fixture
def owner_a_user():
    return AuthenticatedUser(
        id="user_owner_a",
        email="owner.a@demo.local",
        name="Owner A",
        role="OWNER",
        company_id="comp_textile_a",
        authorized_company_ids=["comp_textile_a"]
    )

def test_owner_a_can_query_own_summary(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    summary = service.get_company_summary("comp_textile_a")
    assert summary["company_id"] == "comp_textile_a"
    assert "Apex Spinners" in summary["company_name"]
    assert summary["period_months"] == 12
    assert summary["latest_monthly_revenue_lakh"] > 0
    assert summary["annual_aggregate"]["total_revenue_lakh"] > 0

def test_owner_a_cannot_query_company_b(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    with pytest.raises(ForbiddenError):
        service.get_company_summary("comp_textile_b")

def test_owner_a_cannot_query_company_b_financials(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    with pytest.raises(ForbiddenError):
        service.get_monthly_financials(company_id="comp_textile_b")

def test_owner_a_cannot_access_global_summary(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    with pytest.raises(ForbiddenError):
        service.get_global_summary()

def test_owner_a_cannot_compare_companies(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    with pytest.raises(ForbiddenError):
        service.get_company_comparison(["comp_textile_a", "comp_textile_b"])

def test_admin_can_query_any_company(admin_user):
    service = BusinessQueryService(repo, admin_user)
    sum_a = service.get_company_summary("comp_textile_a")
    sum_b = service.get_company_summary("comp_textile_b")
    assert sum_a["company_id"] == "comp_textile_a"
    assert sum_b["company_id"] == "comp_textile_b"

def test_admin_can_compare_companies(admin_user):
    service = BusinessQueryService(repo, admin_user)
    comp_result = service.get_company_comparison(["comp_textile_a", "comp_textile_b", "comp_textile_c"], period_months=6)
    assert comp_result["companies_count"] == 3
    assert len(comp_result["companies"]) == 3
    assert comp_result["portfolio_summary"]["total_portfolio_revenue_lakh"] > 0

def test_admin_global_summary(admin_user):
    service = BusinessQueryService(repo, admin_user)
    glob = service.get_global_summary(period_months=12)
    assert glob["companies_count"] == 10
    assert glob["portfolio_summary"]["total_portfolio_revenue_lakh"] > 0
    assert glob["portfolio_summary"]["top_revenue_performer"] is not None

def test_sales_and_profit_trends(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    sales = service.get_sales_trend(months=6)
    profit = service.get_profit_trend(months=6)
    assert sales["period_months"] == 6
    assert len(sales["series"]) == 6
    assert profit["period_months"] == 6
    assert len(profit["series"]) == 6

def test_top_products_retrieval(owner_a_user):
    service = BusinessQueryService(repo, owner_a_user)
    prods = service.get_top_products(limit=3)
    assert len(prods) > 0
    assert "category_name" in prods[0]
    assert prods[0]["total_revenue_lakh"] > 0
