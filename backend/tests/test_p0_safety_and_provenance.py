import pytest
import os
import io
import json
from datetime import date
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.models.financials import MonthlyFinancials
from app.models.product import ProductMetric
from app.models.dataset import Dataset, DatasetColumn
from app.models.audit import AuditLog
from app.services.ingestion.normalizer import IngestionNormalizer
from app.services.ai.orchestrator import AIOrchestrator
from app.services.ai.gemini import GeminiProvider
from app.services.ai.mock_provider import MockAIProvider
from app.services.ai.tools import ToolRegistry
from app.repositories.dev_repo import DevRepository, repo
from app.schemas.auth import AuthenticatedUser
from app.core.config import settings

# ---------------------------------------------------------------------------
# P0-1: DATA INTEGRITY — NO FABRICATED VALUES
# ---------------------------------------------------------------------------

def test_1_revenue_only_dataset_does_not_invent_cogs():
    normalizer = IngestionNormalizer()
    rows = [{
        "year": 2026,
        "month": 7,
        "period_date": date(2026, 7, 1),
        "month_name": "Jul 2026",
        "revenue_lakh": 500.0,
        "raw_row": {}
    }]
    financials, products, start_d, end_d = normalizer.normalize("comp_textile_a", rows, "ds_1")
    assert len(financials) == 1
    assert financials[0].revenue_lakh == 500.0
    assert financials[0].cogs_lakh is None  # MUST NOT BE FABRICATED (no 0.72 multiplier)

def test_2_revenue_only_dataset_does_not_invent_units():
    normalizer = IngestionNormalizer()
    rows = [{
        "year": 2026,
        "month": 7,
        "period_date": date(2026, 7, 1),
        "month_name": "Jul 2026",
        "revenue_lakh": 500.0,
        "raw_row": {}
    }]
    financials, products, start_d, end_d = normalizer.normalize("comp_textile_a", rows, "ds_1")
    assert financials[0].units_sold is None  # MUST NOT BE FABRICATED (no 350 multiplier)
    assert financials[0].units_produced is None
    assert financials[0].orders_count is None
    assert financials[0].avg_order_value_inr is None
    assert financials[0].raw_material_cost_lakh is None
    assert financials[0].energy_cost_lakh is None

def test_3_revenue_plus_cogs_calculates_gross_profit_correctly():
    normalizer = IngestionNormalizer()
    rows = [{
        "year": 2026,
        "month": 7,
        "period_date": date(2026, 7, 1),
        "month_name": "Jul 2026",
        "revenue_lakh": 500.0,
        "cogs_lakh": 300.0,
        "raw_row": {}
    }]
    financials, products, start_d, end_d = normalizer.normalize("comp_textile_a", rows, "ds_1")
    assert financials[0].revenue_lakh == 500.0
    assert financials[0].cogs_lakh == 300.0
    assert financials[0].gross_profit_lakh == 200.0
    assert financials[0].profit_margin_pct == 40.0

def test_4_5_missing_cogs_results_in_unavailable_gross_profit_and_margin():
    normalizer = IngestionNormalizer()
    rows = [{
        "year": 2026,
        "month": 7,
        "period_date": date(2026, 7, 1),
        "month_name": "Jul 2026",
        "revenue_lakh": 500.0,
        "raw_row": {}
    }]
    financials, products, start_d, end_d = normalizer.normalize("comp_test_a", rows, "ds_1")
    assert financials[0].gross_profit_lakh is None
    assert financials[0].profit_margin_pct is None

def test_6_missing_units_results_in_unavailable_units_in_tools(monkeypatch):
    monkeypatch.setattr(settings, "SEED_DEMO_DATA", False)
    user = AuthenticatedUser(
        id="user_owner_custom",
        email="owner.custom@test.local",
        name="Owner Custom",
        role="OWNER",
        company_id="comp_test_units_missing"
    )
    test_repo = DevRepository("sqlite:///:memory:")
    comp = Company(id="comp_test_units_missing", name="Test Co", code="TC", specialization="Denim", city="Surat", state="Gujarat", founded_year=2010, annual_capacity_description="10k")
    test_record = MonthlyFinancials(
        id="fin_test_missing_units",
        company_id="comp_test_units_missing",
        dataset_id="ds_test",
        year=2026,
        month=7,
        period_date=date(2026, 7, 1),
        month_name="Jul 2026",
        revenue_lakh=500.0,
        cogs_lakh=None,
        gross_profit_lakh=None,
        profit_margin_pct=None,
        units_sold=None
    )
    with test_repo.SessionLocal() as session:
        session.add(comp)
        session.commit()
        test_repo.upsert_financials_and_products("comp_test_units_missing", [test_record], [])

    result = ToolRegistry.execute_tool(
        tool_name="calculate_metric",
        arguments={"metric_type": "units", "company_id": "comp_test_units_missing"},
        user=user,
        repository=test_repo
    )
    assert result["status"] == "unavailable"
    assert result["value"] is None

# ---------------------------------------------------------------------------
# P0-2: AI PROVIDER SAFETY — NO SILENT MOCK FALLBACK
# ---------------------------------------------------------------------------

def test_7_production_gemini_unavailable_does_not_invoke_mock(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    user = AuthenticatedUser(id="u1", email="admin@test.local", name="Admin", role="ADMIN", company_id=None)
    test_repo = DevRepository("sqlite:///:memory:")
    orchestrator = AIOrchestrator(test_repo, user)
    assert isinstance(orchestrator.provider, GeminiProvider)
    assert not isinstance(orchestrator.provider, MockAIProvider)

    events = list(orchestrator.stream_conversation_turn("Hello"))
    error_events = [e for e in events if e.type == "error"]
    assert len(error_events) > 0
    assert "AI service is temporarily unavailable" in error_events[0].message
    assert not isinstance(orchestrator.provider, MockAIProvider)

def test_8_production_gemini_runtime_failure_does_not_invoke_mock(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    user = AuthenticatedUser(id="u1", email="admin@test.local", name="Admin", role="ADMIN", company_id=None)
    test_repo = DevRepository("sqlite:///:memory:")
    
    class FailingGeminiProvider(GeminiProvider):
        def is_configured(self) -> bool:
            return True
        def generate_response(self, messages, tools=None, system_instruction=None):
            raise RuntimeError("Gemini API connection timeout")

    orchestrator = AIOrchestrator(test_repo, user, provider=FailingGeminiProvider())
    events = list(orchestrator.stream_conversation_turn("Tell me a joke"))
    error_events = [e for e in events if e.type == "error"]
    assert len(error_events) > 0
    assert "AI service is temporarily unavailable" in error_events[0].message
    assert not isinstance(orchestrator.provider, MockAIProvider)

def test_9_test_environment_uses_mock_provider(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "test")
    monkeypatch.setattr(settings, "AI_PROVIDER", None)
    user = AuthenticatedUser(id="u1", email="admin@test.local", name="Admin", role="ADMIN", company_id=None)
    test_repo = DevRepository("sqlite:///:memory:")
    orchestrator = AIOrchestrator(test_repo, user)
    assert isinstance(orchestrator.provider, MockAIProvider)

def test_10_explicit_mock_mode_forbidden_in_production(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")
    user = AuthenticatedUser(id="u1", email="admin@test.local", name="Admin", role="ADMIN", company_id=None)
    test_repo = DevRepository("sqlite:///:memory:")
    with pytest.raises(ValueError, match="Mock AI provider is strictly prohibited in production"):
        AIOrchestrator(test_repo, user)

# ---------------------------------------------------------------------------
# P0-3: DATASET PROVENANCE
# ---------------------------------------------------------------------------

def test_11_12_13_imported_records_get_dataset_id_and_company_id():
    normalizer = IngestionNormalizer()
    rows = [{
        "year": 2026,
        "month": 7,
        "period_date": date(2026, 7, 1),
        "month_name": "Jul 2026",
        "revenue_lakh": 350.0,
        "cogs_lakh": 240.0,
        "gross_profit_lakh": 110.0,
        "category_name": "Denim Weft",
        "customer_segment": "Domestic Weavers",
        "raw_row": {}
    }]
    target_ds_id = "ds_provenance_test_123"
    target_comp_id = "comp_textile_a"
    
    financials, products, start_d, end_d = normalizer.normalize(target_comp_id, rows, target_ds_id)
    assert len(financials) == 1
    assert financials[0].dataset_id == target_ds_id
    assert financials[0].company_id == target_comp_id

    assert len(products) == 1
    assert products[0].dataset_id == target_ds_id
    assert products[0].company_id == target_comp_id

def test_14_old_records_without_dataset_provenance_remain_valid():
    # Verify nullable dataset_id in schema
    legacy_record = MonthlyFinancials(
        id="fin_legacy_001",
        company_id="comp_textile_a",
        dataset_id=None,  # Nullable
        year=2025,
        month=1,
        period_date=date(2025, 1, 1),
        month_name="Jan 2025",
        revenue_lakh=200.0,
        cogs_lakh=140.0,
        gross_profit_lakh=60.0,
        profit_margin_pct=30.0
    )
    assert legacy_record.dataset_id is None
    assert legacy_record.revenue_lakh == 200.0

# ---------------------------------------------------------------------------
# P0-4: DATASET DELETION & CASCADE
# ---------------------------------------------------------------------------

def test_15_to_20_dataset_deletion_cleans_financials_products_columns_and_is_transactional():
    test_repo = DevRepository("sqlite:///:memory:")
    
    # Create company
    comp = Company(id="comp_test_del", name="Test Deletion Mill", code="TDM", specialization="Spinning", city="Surat", state="Gujarat", founded_year=2010, annual_capacity_description="10k spindles")
    ds_target = Dataset(id="ds_to_delete", company_id="comp_test_del", filename="data.csv", original_filename="data.csv", file_format="CSV", file_type="CSV", dataset_name="Target Dataset")
    ds_other = Dataset(id="ds_to_keep", company_id="comp_test_del", filename="data2.csv", original_filename="data2.csv", file_format="CSV", file_type="CSV", dataset_name="Other Dataset")
    
    fin_target = MonthlyFinancials(id="fin_target", company_id="comp_test_del", dataset_id="ds_to_delete", year=2026, month=7, period_date=date(2026, 7, 1), month_name="Jul 2026", revenue_lakh=300.0)
    fin_other = MonthlyFinancials(id="fin_other", company_id="comp_test_del", dataset_id="ds_to_keep", year=2026, month=8, period_date=date(2026, 8, 1), month_name="Aug 2026", revenue_lakh=400.0)
    
    prod_target = ProductMetric(id="prod_target", company_id="comp_test_del", dataset_id="ds_to_delete", category_name="Yarn", year=2026, month=7, revenue_lakh=300.0)
    prod_other = ProductMetric(id="prod_other", company_id="comp_test_del", dataset_id="ds_to_keep", category_name="Yarn", year=2026, month=8, revenue_lakh=400.0)
    
    with test_repo.SessionLocal() as session:
        session.add_all([comp, ds_target, ds_other, fin_target, fin_other, prod_target, prod_other])
        session.commit()

    # Execute deletion
    success = test_repo.delete_dataset("ds_to_delete", "user_test_admin", "comp_test_del")
    assert success is True

    # Verify target records deleted, other records preserved
    with test_repo.SessionLocal() as session:
        assert session.get(Dataset, "ds_to_delete") is None
        assert session.get(Dataset, "ds_to_keep") is not None
        
        # Financials
        assert session.get(MonthlyFinancials, "fin_target") is None
        assert session.get(MonthlyFinancials, "fin_other") is not None
        
        # Products
        assert session.get(ProductMetric, "prod_target") is None
        assert session.get(ProductMetric, "prod_other") is not None

# ---------------------------------------------------------------------------
# P0-5 & P0-6: DATABASE SAFETY & PRODUCTION SEED PROTECTION
# ---------------------------------------------------------------------------

def test_21_22_database_preserves_records_on_restart():
    db_file = "test_persistence.db"
    if os.path.exists(db_file):
        os.remove(db_file)
    
    db_url = f"sqlite:///{db_file}"
    repo1 = DevRepository(db_url)
    
    comp = Company(id="comp_survive", name="Surviving Mill", code="SM", specialization="Weaving", city="Coimbatore", state="Tamil Nadu", founded_year=2000, annual_capacity_description="500 looms")
    with repo1.SessionLocal() as session:
        session.add(comp)
        session.commit()

    # Re-instantiate repository (simulating restart)
    repo2 = DevRepository(db_url)
    with repo2.SessionLocal() as session:
        found = session.get(Company, "comp_survive")
        assert found is not None
        assert found.name == "Surviving Mill"
    
    if os.path.exists(db_file):
        os.remove(db_file)

def test_23_production_never_automatically_seeds_demo_data(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "SEED_DEMO_DATA", False)
    
    db_file = "test_prod_noseed.db"
    if os.path.exists(db_file):
        os.remove(db_file)
    
    db_url = f"sqlite:///{db_file}"
    prod_repo = DevRepository(db_url)
    
    with prod_repo.SessionLocal() as session:
        count = session.scalar(select(func.count(Company.id)))
        assert count == 0  # MUST REMAIN 0, NEVER AUTO-SEEDED IN PRODUCTION
        
    if os.path.exists(db_file):
        os.remove(db_file)

def test_24_development_explicit_seed_mode_works(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "SEED_DEMO_DATA", True)
    
    db_file = "test_dev_seed.db"
    if os.path.exists(db_file):
        os.remove(db_file)
        
    db_url = f"sqlite:///{db_file}"
    dev_repo = DevRepository(db_url)
    
    with dev_repo.SessionLocal() as session:
        count = session.scalar(select(func.count(Company.id)))
        assert count == 10  # Seeded 10 demo companies
        
    if os.path.exists(db_file):
        os.remove(db_file)

# ---------------------------------------------------------------------------
# P0-10: TENANT SECURITY
# ---------------------------------------------------------------------------

def test_25_26_owner_cannot_access_or_delete_other_company_dataset():
    test_repo = DevRepository("sqlite:///:memory:")
    comp_a = Company(id="comp_a", name="Mill A", code="MA", specialization="Spinning", city="Surat", state="Gujarat", founded_year=2010, annual_capacity_description="10k")
    comp_b = Company(id="comp_b", name="Mill B", code="MB", specialization="Spinning", city="Surat", state="Gujarat", founded_year=2010, annual_capacity_description="10k")
    ds_b = Dataset(id="ds_b", company_id="comp_b", filename="b.csv", original_filename="b.csv", file_format="CSV", file_type="CSV", dataset_name="B Data")
    
    with test_repo.SessionLocal() as session:
        session.add_all([comp_a, comp_b, ds_b])
        session.commit()

    # Owner A attempts to delete Co B dataset
    deleted = test_repo.delete_dataset("ds_b", "user_owner_a", company_id="comp_a")
    assert deleted is False  # Denied by tenant guard

    # Co B dataset must still exist
    with test_repo.SessionLocal() as session:
        assert session.get(Dataset, "ds_b") is not None
