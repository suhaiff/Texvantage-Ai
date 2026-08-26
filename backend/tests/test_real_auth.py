import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.repositories.dev_repo import repo
from sqlalchemy import text

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    # Clean the database before each test
    with repo.SessionLocal() as session:
        session.execute(text("DELETE FROM audit_logs"))
        session.execute(text("DELETE FROM monthly_financials"))
        session.execute(text("DELETE FROM users"))
        session.execute(text("DELETE FROM companies"))
        session.commit()
    yield

def test_unauthenticated_access_rejected():
    """AUTH-001: Unauthenticated user cannot access protected endpoint."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_registration_creates_owner():
    """AUTH-005, AUTH-006: Registration creates Company + User, public registration cannot create ADMIN."""
    response = client.post("/api/auth/register", json={
        "full_name": "Test Owner",
        "company_name": "Test Company",
        "email": "owner@test.com",
        "password": "password123",
        "confirm_password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] is not None
    assert data["user"]["email"] == "owner@test.com"
    assert data["user"]["role"] == "OWNER"
    assert data["user"]["company_name"] == "Test Company"
    assert data["user"]["company_id"] is not None

def test_invalid_password_rejected():
    """AUTH-003: Invalid password rejected (during registration and login)."""
    # Mismatched confirm password
    response = client.post("/api/auth/register", json={
        "full_name": "Test Owner",
        "company_name": "Test Company",
        "email": "owner2@test.com",
        "password": "password123",
        "confirm_password": "password456"
    })
    assert response.status_code == 400
    
    # Register successfully first
    client.post("/api/auth/register", json={
        "full_name": "Test Owner",
        "company_name": "Test Company",
        "email": "owner3@test.com",
        "password": "password123",
        "confirm_password": "password123"
    })
    
    # Wrong password on login
    login_resp = client.post("/api/auth/login", json={
        "email": "owner3@test.com",
        "password": "wrongpassword"
    })
    assert login_resp.status_code == 401

def test_duplicate_email_rejected():
    """AUTH-004: Duplicate email rejected."""
    payload = {
        "full_name": "Test Owner",
        "company_name": "Test Company",
        "email": "duplicate@test.com",
        "password": "password123",
        "confirm_password": "password123"
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 200
    
    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 400

def test_demo_switcher_removed():
    """AUTH-010: Demo persona switch endpoint no longer works."""
    response = client.post("/api/auth/demo-switch", json={
        "target_role": "ADMIN"
    })
    assert response.status_code == 404

def test_owner_tenant_isolation():
    """AUTH-008: Owner cannot access another company."""
    # Register Owner A
    r1 = client.post("/api/auth/register", json={
        "full_name": "Owner A",
        "company_name": "Company A",
        "email": "ownera@test.com",
        "password": "password123",
        "confirm_password": "password123"
    })
    token_a = r1.json()["access_token"]
    
    # Register Owner B
    r2 = client.post("/api/auth/register", json={
        "full_name": "Owner B",
        "company_name": "Company B",
        "email": "ownerb@test.com",
        "password": "password123",
        "confirm_password": "password123"
    })
    comp_b_id = r2.json()["user"]["company_id"]
    
    # Owner A tries to fetch Company B datasets
    response = client.get(
        f"/api/datasets?company_id={comp_b_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    # The API either returns 403 or silently scopes to A's datasets.
    # In TenantGuard, it usually returns 403 if explicitly requesting another company's ID
    assert response.status_code in (403, 401)
