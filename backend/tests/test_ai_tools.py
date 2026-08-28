import pytest
from app.repositories.dev_repo import repo
from app.services.ai.tools import ToolRegistry, TOOL_DEFINITIONS
from app.schemas.auth import AuthenticatedUser

@pytest.fixture
def admin_user(test_environment):
    return AuthenticatedUser(
        id="user_admin_01",
        email="admin@test.local",
        name="Global Admin",
        role="ADMIN",
        company_id=None,
        authorized_company_ids=[f"comp_test_{c}" for c in "abcdefghij"]
    )

@pytest.fixture
def owner_a_user(test_environment):
    return AuthenticatedUser(
        id="user_owner_a",
        email="owner.a@test.local",
        name="Owner A",
        role="OWNER",
        company_id="comp_test_a",
        authorized_company_ids=["comp_test_a"]
    )

def test_tool_registry_available_tools(owner_a_user, admin_user):
    admin_tools = ToolRegistry.get_available_tools(admin_user)
    owner_tools = ToolRegistry.get_available_tools(owner_a_user)

    admin_names = {t["name"] for t in admin_tools}
    owner_names = {t["name"] for t in owner_tools}

    assert "compare_companies" in admin_names
    assert "get_global_summary" in admin_names
    # Owner must not have cross-company comparison / global tools in their tool definitions
    assert "compare_companies" not in owner_names
    assert "get_global_summary" not in owner_names
    assert "query_business_data" in owner_names
    assert "calculate_metric" in owner_names

def test_owner_executes_calculate_metric(owner_a_user, test_environment):
    # Calculate revenue
    res_rev = ToolRegistry.execute_tool(
        tool_name="calculate_metric",
        arguments={"metric_type": "revenue", "period": "latest"},
        user=owner_a_user,
        repository=repo
    )
    assert res_rev["status"] == "success"
    assert res_rev["metric"] == "revenue_lakh"
    assert res_rev["value"] > 0

    # Calculate margin
    res_margin = ToolRegistry.execute_tool(
        tool_name="calculate_metric",
        arguments={"metric_type": "margin", "period": "latest"},
        user=owner_a_user,
        repository=repo
    )
    assert res_margin["status"] == "success"
    assert res_margin["metric"] == "profit_margin_pct"
    assert res_margin["value"] > 0

def test_owner_cannot_query_other_company_via_tool(owner_a_user):
    # Attempting to supply comp_textile_b in tool arguments
    res = ToolRegistry.execute_tool(
        tool_name="query_business_data",
        arguments={"company_id": "comp_textile_b", "metric": "revenue_lakh"},
        user=owner_a_user,
        repository=repo
    )
    assert res["status"] == "forbidden"
    assert "Access denied" in res["error"]

def test_owner_cannot_run_compare_tool(owner_a_user):
    res = ToolRegistry.execute_tool(
        tool_name="compare_companies",
        arguments={"company_ids": ["comp_textile_a", "comp_textile_b"]},
        user=owner_a_user,
        repository=repo
    )
    assert res["status"] == "forbidden"

def test_admin_executes_compare_tool(admin_user, test_environment):
    res = ToolRegistry.execute_tool(
        tool_name="compare_companies",
        arguments={"company_ids": ["comp_test_a", "comp_test_b"]},
        user=admin_user,
        repository=repo
    )
    assert res["status"] == "success"
    assert "comparison" in res
    assert res["comparison"]["companies_count"] == 2

def test_admin_executes_global_summary_tool(admin_user, test_environment):
    res = ToolRegistry.execute_tool(
        tool_name="get_global_summary",
        arguments={"period_months": 12},
        user=admin_user,
        repository=repo
    )
    assert res["status"] == "success"
    assert res["global_summary"]["companies_count"] == 2
