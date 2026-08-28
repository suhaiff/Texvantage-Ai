import pytest
import io
import json
import openpyxl
from datetime import date
from fastapi.testclient import TestClient
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.repositories.dev_repo import repo
from app.services.ingestion.csv_parser import CSVParser
from app.services.ingestion.json_parser import JSONParser
from app.services.ingestion.excel_parser import ExcelParser
from app.services.ingestion.validator import IngestionValidator, parse_number_value, parse_date_value
from app.services.ingestion.normalizer import IngestionNormalizer
from app.schemas.auth import AuthenticatedUser
from app.services.ai.orchestrator import AIOrchestrator
from app.services.ai.mock_provider import MockAIProvider

client = TestClient(app)



# 1. Parser Unit Tests
def test_csv_parser_valid():
    csv_content = b"Period,Sales Amount,Cost of Goods,Units Sold\n2026-07-01,350.50,245.0,42000\n2026-08-01,365.20,250.0,44000\n"
    parser = CSVParser()
    parsed = parser.parse(csv_content, "monthly_sales.csv")
    assert parsed.total_rows == 2
    assert "Period" in parsed.headers
    assert "Sales Amount" in parsed.headers
    assert parsed.file_format == "CSV"
    assert "revenue" in parsed.detected_mappings.values()
    assert "date" in parsed.detected_mappings.values()

def test_json_parser_valid():
    data = [
        {"transaction_date": "2026-07-01", "revenue_lakh": 310.0, "cogs": 210.0, "category": "Denim 14oz"},
        {"transaction_date": "2026-08-01", "revenue_lakh": 340.0, "cogs": 230.0, "category": "Denim 11oz"}
    ]
    json_bytes = json.dumps(data).encode("utf-8")
    parser = JSONParser()
    parsed = parser.parse(json_bytes, "records.json")
    assert parsed.total_rows == 2
    assert parsed.file_format == "JSON"
    assert "revenue" in parsed.detected_mappings.values()
    assert "date" in parsed.detected_mappings.values()

def test_excel_parser_valid():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "SalesData"
    ws.append(["Month", "Sales", "COGS", "Quantity"])
    ws.append(["2026-07-01", 280.5, 190.0, 35000])
    ws.append(["2026-08-01", 295.0, 200.0, 37000])
    
    excel_stream = io.BytesIO()
    wb.save(excel_stream)
    excel_bytes = excel_stream.getvalue()

    parser = ExcelParser()
    parsed = parser.parse(excel_bytes, "quarterly_data.xlsx")
    assert parsed.total_rows == 2
    assert parsed.file_format == "XLSX"
    assert "Month" in parsed.headers
    assert "Sales" in parsed.headers

# 2. Validation & Number Parsing Unit Tests
def test_numeric_value_parsing():
    assert parse_number_value("340.50") == 340.50
    assert parse_number_value("₹ 1,250.00") == 1250.00
    assert parse_number_value("45.2 Lakhs") == 45.2
    assert parse_number_value("2.5 Cr") == 250.0 # 2.5 * 100
    assert parse_number_value("150k") == 1.5 # 150 * 0.01
    assert parse_number_value("N/A") is None
    assert parse_number_value("invalid_str") is None

def test_date_value_parsing():
    res1 = parse_date_value("2026-07-15")
    assert res1 is not None
    assert res1[0] == 2026 and res1[1] == 7 and res1[3] == "Jul 2026"

    res2 = parse_date_value("Aug 2026")
    assert res2 is not None
    assert res2[0] == 2026 and res2[1] == 8 and res2[3] == "Aug 2026"

    assert parse_date_value("invalid_date") is None

def test_validator_detects_missing_mandatory_mapping():
    validator = IngestionValidator()
    rows = [{"ColA": "2026-07-01", "ColB": "100"}]
    # Mapping missing revenue
    res = validator.validate(rows, {"ColA": "date"})
    assert not res.is_valid
    assert any("revenue" in err.lower() for err in res.errors)

# 3. Normalizer & Historical Accumulation Tests
def test_normalizer_accumulates_and_creates_entities():
    normalizer = IngestionNormalizer()
    validated_rows = [
        {
            "year": 2026,
            "month": 7,
            "period_date": date(2026, 7, 1),
            "month_name": "Jul 2026",
            "revenue_lakh": 320.0,
            "cogs_lakh": 220.0,
            "gross_profit_lakh": 100.0,
            "units_sold": 45000,
            "category_name": "Organic Cotton",
            "customer_segment": "Export Brands",
            "raw_row": {}
        },
        {
            "year": 2026,
            "month": 8,
            "period_date": date(2026, 8, 1),
            "month_name": "Aug 2026",
            "revenue_lakh": 340.0,
            "cogs_lakh": 230.0,
            "gross_profit_lakh": 110.0,
            "units_sold": 48000,
            "category_name": "Organic Cotton",
            "customer_segment": "Export Brands",
            "raw_row": {}
        }
    ]
    financials, products, start_d, end_d = normalizer.normalize("comp_test_a", validated_rows, "ds_test_1")
    assert len(financials) == 2
    assert financials[0].revenue_lakh == 320.0
    assert financials[1].revenue_lakh == 340.0
    assert start_d == date(2026, 7, 1)
    assert end_d == date(2026, 8, 1)

# 4. End-to-End API Ingestion Tests
def test_owner_upload_csv_preview_and_import(test_environment, get_auth_token):
    owner_token = get_auth_token("owner.a@test.local")
    headers = {"Authorization": f"Bearer {owner_token}"}

    # A. Upload CSV
    csv_bytes = b"Date,Sales Revenue,Direct Cost,Units\n2026-07-01,315.00,210.00,45000\n2026-08-01,335.50,225.00,48000\n"
    files = {"file": ("july_august_sales.csv", csv_bytes, "text/csv")}
    data = {"dataset_name": "Q3 Historical Upload"}

    upload_res = client.post("/api/datasets/upload", headers=headers, files=files, data=data)
    assert upload_res.status_code == 200, upload_res.text
    upload_data = upload_res.json()
    dataset_id = upload_data["dataset_id"]
    assert upload_data["total_rows"] == 2
    assert len(upload_data["columns"]) == 4

    # B. Preview Dataset
    preview_res = client.get(f"/api/datasets/{dataset_id}/preview", headers=headers)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["dataset_id"] == dataset_id
    assert len(preview_data["sample_rows"]) == 2

    # C. Apply Column Mapping & Ingest
    mapping_payload = {
        "mapping": {
            "Date": "date",
            "Sales Revenue": "revenue",
            "Direct Cost": "cogs",
            "Units": "units_sold"
        },
        "mode": "APPEND"
    }
    map_res = client.post(f"/api/datasets/{dataset_id}/mapping", headers=headers, json=mapping_payload)
    assert map_res.status_code == 200, map_res.text
    ingest_result = map_res.json()
    assert ingest_result["status"] == "COMPLETED"
    assert ingest_result["records_imported"] == 2

    # D. Verify Ledger now contains updated records
    fin_res = client.get("/api/analytics/financials", headers=headers)
    assert fin_res.status_code == 200
    fin_list = fin_res.json()
    # Check that Aug 2026 record has the updated 335.50
    aug_rec = next((f for f in fin_list if f["month"] == 8 and f["year"] == 2026), None)
    assert aug_rec is not None
    assert aug_rec["revenue_lakh"] == 335.50

# 5. Repeated Uploads Accumulate Historical Business Periods
def test_repeated_uploads_accumulate_periods(test_environment, get_auth_token):
    owner_token = get_auth_token("owner.b@test.local")
    headers = {"Authorization": f"Bearer {owner_token}"}

    # Upload Dataset 1: Sept 2026
    csv_sept = b"Period_Date,Revenue,Cost\n2026-09-01,420.00,290.00\n"
    up1 = client.post("/api/datasets/upload", headers=headers, files={"file": ("sept.csv", csv_sept, "text/csv")})
    ds1_id = up1.json()["dataset_id"]
    client.post(f"/api/datasets/{ds1_id}/mapping", headers=headers, json={"mapping": {"Period_Date": "date", "Revenue": "revenue", "Cost": "cogs"}, "mode": "APPEND"})

    # Upload Dataset 2: Oct 2026
    csv_oct = b"Period_Date,Revenue,Cost\n2026-10-01,445.00,305.00\n"
    up2 = client.post("/api/datasets/upload", headers=headers, files={"file": ("oct.csv", csv_oct, "text/csv")})
    ds2_id = up2.json()["dataset_id"]
    client.post(f"/api/datasets/{ds2_id}/mapping", headers=headers, json={"mapping": {"Period_Date": "date", "Revenue": "revenue", "Cost": "cogs"}, "mode": "APPEND"})

    # Verify both Sept and Oct are present in company B's financials
    fin_res = client.get("/api/analytics/financials", headers=headers)
    fin_list = fin_res.json()
    months = [f["month_name"] for f in fin_list]
    assert "Sep 2026" in months
    assert "Oct 2026" in months

# 6. TenantGuard Security Isolation on Datasets
def test_owner_security_cross_tenant_isolation(test_environment, get_auth_token):
    owner_a_token = get_auth_token("owner.a@test.local")
    owner_b_token = get_auth_token("owner.b@test.local")
    headers_a = {"Authorization": f"Bearer {owner_a_token}"}
    headers_b = {"Authorization": f"Bearer {owner_b_token}"}

    # Owner A uploads Dataset A
    csv_a = b"Date,Sales\n2026-07-01,300.0\n"
    up_a = client.post("/api/datasets/upload", headers=headers_a, files={"file": ("ds_a.csv", csv_a, "text/csv")})
    ds_a_id = up_a.json()["dataset_id"]

    # Owner A lists datasets -> sees ds_a_id
    list_a = client.get("/api/datasets", headers=headers_a).json()
    assert any(d["id"] == ds_a_id for d in list_a)

    # Owner B lists datasets -> DOES NOT see ds_a_id
    list_b = client.get("/api/datasets", headers=headers_b).json()
    assert not any(d["id"] == ds_a_id for d in list_b)

    # Owner B tries to preview Dataset A -> 403 Forbidden
    prev_b = client.get(f"/api/datasets/{ds_a_id}/preview", headers=headers_b)
    assert prev_b.status_code == 403

    # Owner B tries to map Dataset A -> 403 Forbidden
    map_b = client.post(f"/api/datasets/{ds_a_id}/mapping", headers=headers_b, json={"mapping": {"Date": "date", "Sales": "revenue"}})
    assert map_b.status_code == 403

    # Owner B tries to delete Dataset A -> 403 Forbidden
    del_b = client.delete(f"/api/datasets/{ds_a_id}", headers=headers_b)
    assert del_b.status_code == 403

    # Owner A can delete Dataset A -> 200 OK
    del_a = client.delete(f"/api/datasets/{ds_a_id}", headers=headers_a)
    assert del_a.status_code == 200

# 7. Admin Cross-Company Dataset Operations
def test_admin_cross_company_dataset_management(test_environment, get_auth_token):
    admin_token = get_auth_token("admin@test.local")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin uploads for Company A
    csv_a = b"Period,Sales\n2026-07-01,400.0\n"
    files = {"file": ("admin_upload_a.csv", csv_a, "text/csv")}
    data = {"company_id": "comp_test_a", "dataset_name": "Admin Upload for Mill A"}
    admin_up = client.post("/api/datasets/upload", headers=admin_headers, files=files, data=data)
    assert admin_up.status_code == 200
    ds_a_id = admin_up.json()["dataset_id"]

    # Admin previews Dataset A
    prev = client.get(f"/api/datasets/{ds_a_id}/preview", headers=admin_headers)
    assert prev.status_code == 200

    # Admin lists datasets filtered by company A
    list_a = client.get("/api/datasets?company_id=comp_test_a", headers=admin_headers)
    assert list_a.status_code == 200
    assert any(d["id"] == ds_a_id for d in list_a.json())

# 8. AI Integration with Ingested Datasets
def test_ai_answers_dataset_awareness(test_environment):
    user = AuthenticatedUser(
        id="user_owner_a",
        email="owner.a@test.local",
        name="Test Owner A",
        role="OWNER",
        company_id="comp_test_a"
    )
    orchestrator = AIOrchestrator(
        repository=repo,
        user=user,
        provider=MockAIProvider()
    )
    events = list(orchestrator.stream_conversation_turn(
        prompt="What datasets have I uploaded and what period does my data cover?",
        conversation_id=None
    ))
    
    event_types = [e.type for e in events]
    assert "tool_start" in event_types
    tool_event = next(e for e in events if e.type == "tool_start")
    assert tool_event.tool == "get_uploaded_datasets_info"
    assert "complete" in event_types
