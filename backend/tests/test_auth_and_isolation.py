import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.repositories.dev_repo import repo

client = TestClient(app)

def test_health_endpoint():
    """Verify healthcheck and database initialization."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["companies_seeded"] == 10
    assert data["tenant_isolation"] == "enforced_server_side"

def test_admin_login():
    """Verify Admin authentication and JWT token issuance."""
    response = client.post("/api/auth/login", json={
        "email": "admin@demo.local",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["email"] == "admin@demo.local"

def test_owner_a_login():
    """Verify Owner A authentication and company association."""
    response = client.post("/api/auth/login", json={
        "email": "owner.a@demo.local",
        "password": "owner123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "OWNER"
    assert data["user"]["company_id"] == "comp_textile_a"

def test_invalid_login_rejected():
    """Verify bad credentials return 401 Unauthorized."""
    response = client.post("/api/auth/login", json={
        "email": "admin@demo.local",
        "password": "wrong_password"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_unauthenticated_request_rejected():
    """Verify accessing protected routes without token returns 401."""
    response = client.get("/api/companies")
    assert response.status_code == 401

def test_admin_lists_all_companies():
    """Verify Admin can see all 10 companies across the portfolio."""
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@demo.local",
        "password": "admin123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/companies", headers=headers)
    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 10
    company_codes = [c["code"] for c in companies]
    assert "TEX-A" in company_codes
    assert "TEX-B" in company_codes
    assert "TEX-J" in company_codes

def test_owner_lists_only_own_company():
    """Verify Owner A ONLY sees Company A in company listings."""
    login_resp = client.post("/api/auth/login", json={
        "email": "owner.a@demo.local",
        "password": "owner123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/companies", headers=headers)
    assert response.status_code == 200
    companies = response.json()
    assert len(companies) == 1
    assert companies[0]["id"] == "comp_textile_a"
    assert companies[0]["code"] == "TEX-A"

def test_owner_can_access_own_company_detail():
    """Verify Owner A can access Company A drilldown."""
    login_resp = client.post("/api/auth/login", json={
        "email": "owner.a@demo.local",
        "password": "owner123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/companies/comp_textile_a", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "comp_textile_a"
    assert data["name"] == "Textile A (Apex Spinners)"
    assert data["latest_metrics"] is not None

def test_critical_security_owner_cannot_access_other_company():
    """
    CRITICAL SECURITY TEST:
    Verify Owner A attempting to access Company B receives HTTP 403 Forbidden.
    """
    login_resp = client.post("/api/auth/login", json={
        "email": "owner.a@demo.local",
        "password": "owner123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to breach tenant boundary
    response = client.get("/api/companies/comp_textile_b", headers=headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]

def test_admin_can_access_any_company_detail():
    """Verify Admin has global authorization to view any company."""
    login_resp = client.post("/api/auth/login", json={
        "email": "admin@demo.local",
        "password": "admin123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response_a = client.get("/api/companies/comp_textile_a", headers=headers)
    assert response_a.status_code == 200
    
    response_b = client.get("/api/companies/comp_textile_b", headers=headers)
    assert response_b.status_code == 200

def test_repository_tenant_scoping():
    """Verify repository layer strictly honors authorized_company_ids."""
    # Query scoped to comp_textile_a
    records_a = repo.get_monthly_financials(authorized_company_ids=["comp_textile_a"])
    assert len(records_a) == 12
    for r in records_a:
        assert r.company_id == "comp_textile_a"

    # Query with empty list returns nothing
    empty_records = repo.get_monthly_financials(authorized_company_ids=[])
    assert len(empty_records) == 0

def test_demo_switcher():
    """Verify demo persona switcher creates valid JWT tokens."""
    resp_admin = client.post("/api/auth/demo-switch", json={"target_role": "ADMIN"})
    assert resp_admin.status_code == 200
    assert resp_admin.json()["user"]["role"] == "ADMIN"

    resp_owner_c = client.post("/api/auth/demo-switch", json={"target_role": "OWNER", "company_id": "comp_textile_c"})
    assert resp_owner_c.status_code == 200
    assert resp_owner_c.json()["user"]["role"] == "OWNER"
    assert resp_owner_c.json()["user"]["company_id"] == "comp_textile_c"
