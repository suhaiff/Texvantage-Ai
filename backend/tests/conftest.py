"""
Test configuration for TexVantage AI backend.

IMPORTANT: Tests MUST NOT touch the production SQL Server database.
All test fixtures use an isolated SQLite in-memory DevRepository so the
live texvantage SQL Server data is never modified by the test suite.

The global ``repo`` singleton and the FastAPI dependency ``get_repository``
are both overridden here so that every test—including API-level tests via
TestClient—exclusively hits the isolated SQLite database.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

# ── Force test environment BEFORE importing app modules ─────────────────────
os.environ.setdefault("APP_ENV", "test")

from app.main import app
from app.repositories.dev_repo import DevRepository
from app.models.user import User
from app.models.company import Company
from app.models.financials import MonthlyFinancials
from app.models.product import ProductMetric
from datetime import date
from app.core.security import get_password_hash, create_access_token
from app.core.dependencies import get_repository

# ---------------------------------------------------------------------------
# Isolated SQLite test repository (never touches SQL Server)
# ---------------------------------------------------------------------------
# Use a fixed temp file so test processes share the same schema within a run.
_TEST_DB_URL = "sqlite:///./texvantage_test_runtime.db"
test_repo = DevRepository(db_url=_TEST_DB_URL)

# Patch the production singleton so imports of `repo` in tests also hit SQLite
import app.repositories.dev_repo as _dev_repo_module
import app.repositories as _repo_pkg
import app.api.datasets as _datasets_api
import app.main as _main_module
_dev_repo_module.repo = test_repo
_repo_pkg.repo = test_repo
_datasets_api.repo = test_repo     # datasets.py imports repo directly
_main_module.repo = test_repo       # main.py uses repo for health check

# Override the FastAPI dependency so TestClient API calls hit SQLite too
app.dependency_overrides[get_repository] = lambda: test_repo

# Keep a module-level alias for backward compat with tests that do
# ``from app.repositories.dev_repo import repo``
repo = test_repo

@pytest.fixture(scope="function", autouse=True)
def clean_db():
    """Wipe the database clean before each test to ensure complete isolation."""
    with repo.SessionLocal() as session:
        session.execute(text("DELETE FROM audit_logs"))
        session.execute(text("DELETE FROM product_metrics"))
        session.execute(text("DELETE FROM monthly_financials"))
        session.execute(text("DELETE FROM dataset_columns"))
        session.execute(text("DELETE FROM datasets"))
        session.execute(text("DELETE FROM messages"))
        session.execute(text("DELETE FROM conversations"))
        session.execute(text("DELETE FROM users"))
        session.execute(text("DELETE FROM companies"))
        session.commit()
    yield

@pytest.fixture
def test_environment():
    """
    Bootstraps a standard isolated test environment:
    - 1 ADMIN user
    - 2 OWNER users with 2 Companies (comp_test_a, comp_test_b)
    """
    with repo.SessionLocal() as session:
        # Create Companies
        comp_a = Company(
            id="comp_test_a", name="Test Company A", code="TCA",
            specialization="Testing", city="Test City", state="Test State", founded_year=2020
        )
        comp_b = Company(
            id="comp_test_b", name="Test Company B", code="TCB",
            specialization="Testing", city="Test City", state="Test State", founded_year=2021
        )
        session.add(comp_a)
        session.add(comp_b)
        session.commit()
        
        # Create Users
        password_hash = get_password_hash("testpassword")
        
        admin_user = User(
            id="user_admin", email="admin@test.local", password_hash=password_hash,
            name="Test Admin", role="ADMIN", company_id=None, job_title="Admin"
        )
        owner_a = User(
            id="user_owner_a", email="owner.a@test.local", password_hash=password_hash,
            name="Test Owner A", role="OWNER", company_id="comp_test_a", job_title="Owner"
        )
        owner_b = User(
            id="user_owner_b", email="owner.b@test.local", password_hash=password_hash,
            name="Test Owner B", role="OWNER", company_id="comp_test_b", job_title="Owner"
        )
        
        session.add(admin_user)
        session.add(owner_a)
        session.add(owner_b)

        # Create basic financials for comp_test_a
        for m in range(1, 13):
            fin = MonthlyFinancials(
                id=f"fin_a_{m}", company_id="comp_test_a",
                year=2026, month=m, period_date=date(2026, m, 1), month_name=f"Month {m} 2026",
                revenue_lakh=100.0, cogs_lakh=60.0, gross_profit_lakh=40.0,
                profit_margin_pct=40.0, operating_expenses_lakh=10.0, net_profit_lakh=30.0,
                units_produced=1000, units_sold=1000, orders_count=100, avg_order_value_inr=10000.0,
                capacity_utilization_pct=85.0
            )
            session.add(fin)
            
            prod = ProductMetric(
                id=f"prod_a_{m}", company_id="comp_test_a",
                year=2026, month=m,
                category_name="Testing Category", top_customer_segment="B2B",
                sales_volume_units=1000, unit_of_measure="kg", revenue_lakh=100.0, 
                profit_margin_pct=40.0
            )
            session.add(prod)

        # Create basic financials for comp_test_b
        for m in range(1, 7):
            fin = MonthlyFinancials(
                id=f"fin_b_{m}", company_id="comp_test_b",
                year=2026, month=m, period_date=date(2026, m, 1), month_name=f"Month {m} 2026",
                revenue_lakh=200.0, cogs_lakh=120.0, gross_profit_lakh=80.0,
                profit_margin_pct=40.0, operating_expenses_lakh=20.0, net_profit_lakh=60.0,
                units_produced=2000, units_sold=2000, orders_count=200, avg_order_value_inr=10000.0,
                capacity_utilization_pct=90.0
            )
            session.add(fin)

        session.commit()

    # Provide a helper dictionary or object
    return {
        "admin": {"email": "admin@test.local", "password": "testpassword", "id": "user_admin"},
        "owner_a": {"email": "owner.a@test.local", "password": "testpassword", "id": "user_owner_a", "company_id": "comp_test_a"},
        "owner_b": {"email": "owner.b@test.local", "password": "testpassword", "id": "user_owner_b", "company_id": "comp_test_b"}
    }

@pytest.fixture
def get_auth_token(test_environment):
    """Returns a helper function to quickly generate JWT tokens for test users."""
    def _get_token(email: str) -> str:
        with repo.SessionLocal() as session:
            user = repo.get_user_by_email(email)
            if not user:
                raise ValueError(f"User {email} not found in test environment.")
            token = create_access_token(data={
                "sub": user.id,
                "email": user.email,
                "role": user.role,
                "company_id": user.company_id
            })
            return token
    return _get_token
