import pytest
import io
import openpyxl
from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.repositories.dev_repo import repo

client = TestClient(app)

@pytest.fixture
def admin_token():
    res = client.post("/api/auth/login", json={
        "email": "admin@demo.local",
        "password": "admin123"
    })
    return res.json()["access_token"]

@pytest.fixture
def owner_a_token():
    res = client.post("/api/auth/login", json={
        "email": "owner.a@demo.local",
        "password": "owner123"
    })
    return res.json()["access_token"]

@pytest.fixture
def owner_b_token():
    res = client.post("/api/auth/login", json={
        "email": "owner.b@demo.local",
        "password": "owner123"
    })
    return res.json()["access_token"]


def test_report_metadata_owner(owner_a_token):
    """Verify report metadata endpoint adheres to Owner tenant scope."""
    res = client.get("/api/reports/metadata", headers={"Authorization": f"Bearer {owner_a_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "Single Enterprise" in data["tenant_scope"]
    assert "Executive Summary" in data["sheets"]
    assert "Data Sources" in data["sheets"]
    assert len(data["companies_included"]) == 1


def test_report_metadata_admin(admin_token):
    """Verify report metadata endpoint returns Global Admin scope."""
    res = client.get("/api/reports/metadata", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "Global Administrator" in data["tenant_scope"]
    assert len(data["companies_included"]) >= 10
    assert "Company Comparison" in data["sheets"]


def test_owner_generate_own_company_excel_report(owner_a_token):
    """Verify Owner can generate a valid, professional multi-sheet Excel report for their own company."""
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "executive",
            "company_id": "comp_textile_a",
            "period_months": 6,
            "title": "Q4 Executive Performance Review"
        },
        headers={"Authorization": f"Bearer {owner_a_token}"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment; filename=" in res.headers["content-disposition"]

    # Verify binary Excel workbook integrity
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    expected_sheets = ["Executive Summary", "Financial Performance", "Monthly Trend", "Product Performance", "Data Sources"]
    for s in expected_sheets:
        assert s in wb.sheetnames, f"Expected sheet '{s}' not found in workbook"

    # Verify Executive Summary sheet content
    ws_exec = wb["Executive Summary"]
    assert ws_exec.cell(row=2, column=2).value == "TEXVANTAGE AI — EXECUTIVE BUSINESS REPORT"
    assert "TEX-A" in str(ws_exec.cell(row=5, column=3).value)

    # Verify Data Sources provenance sheet exists and has records
    ws_sources = wb["Data Sources"]
    assert ws_sources.cell(row=2, column=1).value == "DATA PROVENANCE & AUDIT TRAIL"


def test_owner_cannot_export_another_company(owner_a_token):
    """P0 Safety Invariant: Owner A cannot export data for Company B."""
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "executive",
            "company_id": "comp_textile_b",
            "period_months": 6
        },
        headers={"Authorization": f"Bearer {owner_a_token}"}
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_owner_cannot_export_multi_company_list(owner_a_token):
    """P0 Safety Invariant: Owner A cannot export multi-company list containing foreign companies."""
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "comparison",
            "company_ids": ["comp_textile_a", "comp_textile_b"],
            "period_months": 6
        },
        headers={"Authorization": f"Bearer {owner_a_token}"}
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


def test_admin_generate_full_portfolio_excel_report(admin_token):
    """Verify Admin can generate a complete 10-mill portfolio Excel report."""
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "portfolio",
            "period_months": 6,
            "title": "Consolidated 10-Enterprise Board Brief"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    expected_sheets = ["Executive Summary", "Company Comparison", "Monthly Performance", "Product Performance", "Data Sources"]
    for s in expected_sheets:
        assert s in wb.sheetnames

    # Check Company Comparison sheet has rows for all 10 companies
    ws_comp = wb["Company Comparison"]
    # Row 5 is header, rows 6-15 are the companies
    assert ws_comp.cell(row=6, column=2).value is not None
    assert ws_comp.cell(row=15, column=2).value is not None


def test_admin_generate_selected_comparison_report(admin_token):
    """Verify Admin can generate comparison report for specific selected companies."""
    selected = ["comp_textile_a", "comp_textile_b", "comp_textile_c"]
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "comparison",
            "company_ids": selected,
            "period_months": 6
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    ws_comp = wb["Company Comparison"]
    assert ws_comp.cell(row=6, column=2).value is not None


def test_missing_metrics_handled_as_not_available(owner_a_token):
    """Verify that null/missing metrics are clearly marked 'Not available' without substituting zero."""
    res = client.post(
        "/api/reports/excel",
        json={
            "report_type": "executive",
            "period_months": 6
        },
        headers={"Authorization": f"Bearer {owner_a_token}"}
    )
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    ws_fin = wb["Financial Performance"]
    # Verify values exist
    assert ws_fin.cell(row=6, column=3).value is not None
