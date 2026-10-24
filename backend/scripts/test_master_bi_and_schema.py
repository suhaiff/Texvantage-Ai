"""
test_master_bi_and_schema.py
=============================
Mandatory Future-Schema & Master BI Acceptance Test Suite
Implements Section 16.H of the Master Business Intelligence & Reasoning Prompt:
12 Comprehensive Scenarios for Dynamic Schema Evolution, Relationship Discovery,
and Evidence-Based Grounding.
"""

import sys
import os
sys.path.insert(0, os.path.abspath("."))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import json
import time
from sqlalchemy import text, create_engine
from backend.app.core.config import settings
from backend.app.repositories.dev_repo import DevRepository
from backend.app.schemas.auth import AuthenticatedUser
from backend.app.services.analytics.schema_service import SchemaService
from backend.app.services.ai.tools import ToolRegistry

class SchemaAcceptanceTester:
    def __init__(self):
        self.engine = create_engine(settings.DATABASE_URL)
        self.repo = DevRepository()
        self.schema_svc = SchemaService(self.repo)
        self.admin_user = AuthenticatedUser(
            id="user_admin",
            name="Executive Admin",
            role="ADMIN",
            email="admin@texvantage.com",
            company_id="comp_textile_a"
        )
        self.owner_user = AuthenticatedUser(
            id="user_owner",
            name="Mill Owner",
            role="OWNER",
            email="owner@texvantage.com",
            company_id="comp_textile_b"
        )
        self.results = []

    def log_result(self, scenario_num: int, title: str, expected: str, actual: str, passed: bool):
        status = "PASS" if passed else "FAIL"
        self.results.append({
            "scenario": scenario_num,
            "title": title,
            "expected": expected,
            "actual": actual,
            "status": status
        })
        print(f"[{status}] Scenario {scenario_num}: {title}")
        print(f"   Expected: {expected}")
        print(f"   Actual:   {actual}\n")

    def cleanup_test_tables(self):
        """Removes test tables created during acceptance testing."""
        drop_statements = [
            "IF OBJECT_ID('Test_OrderItems', 'U') IS NOT NULL DROP TABLE Test_OrderItems;",
            "IF OBJECT_ID('Test_ProductionOrders', 'U') IS NOT NULL DROP TABLE Test_ProductionOrders;",
            "IF OBJECT_ID('Test_CustomerFeedback', 'U') IS NOT NULL DROP TABLE Test_CustomerFeedback;",
            "IF OBJECT_ID('Test_EmployeeAttendance', 'U') IS NOT NULL DROP TABLE Test_EmployeeAttendance;"
        ]
        with self.engine.connect() as conn:
            for stmt in drop_statements:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as e:
                    pass

    def run_all_tests(self):
        print("================================================================================")
        print("TEXVANTAGE AI — SECTION 16.H MANDATORY FUTURE-SCHEMA ACCEPTANCE SUITE")
        print("================================================================================\n")

        self.cleanup_test_tables()

        try:
            # ── Scenario 1: Add new table with several columns and verify discoverability ──
            with self.engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE Test_ProductionOrders (
                        OrderID INT PRIMARY KEY,
                        ItemCode VARCHAR(50) NOT NULL,
                        TargetQuantity INT NOT NULL,
                        ProducedQuantity INT NOT NULL,
                        Status VARCHAR(20) NOT NULL
                    );
                    INSERT INTO Test_ProductionOrders VALUES (101, 'FAB-COTTON-01', 5000, 4850, 'Completed');
                    INSERT INTO Test_ProductionOrders VALUES (102, 'FAB-DENIM-02', 8000, 7200, 'In_Progress');
                    INSERT INTO Test_ProductionOrders VALUES (103, 'YRN-SPIN-03', 12000, 12000, 'Completed');
                """))
                conn.commit()

            self.schema_svc.invalidate_cache()
            found_tables = self.schema_svc.search_tables(keyword="Test_ProductionOrders")
            s1_passed = len(found_tables) > 0 and found_tables[0]["name"] == "Test_ProductionOrders"
            s1_actual = f"Discovered table '{found_tables[0]['name']}' in domain '{found_tables[0]['domain']}'" if s1_passed else "Table not discovered"
            self.log_result(
                1,
                "Add new table and verify live discoverability",
                "Table Test_ProductionOrders is discovered dynamically with domain classification",
                s1_actual,
                s1_passed
            )

            # ── Scenario 2: Ask question about that table without modifying prompts or source ──
            inspect_res = ToolRegistry.execute_tool(
                "inspect_table_schema",
                {"table_names": ["Test_ProductionOrders"], "include_samples": True},
                self.admin_user,
                self.repo
            )
            tbl_info = inspect_res.get("tables", {}).get("Test_ProductionOrders", {})
            cols = [c["name"] for c in tbl_info.get("columns", [])]
            pks = tbl_info.get("primary_keys", [])
            s2_passed = ("OrderID" in pks and "TargetQuantity" in cols and len(tbl_info.get("sample_rows", [])) == 3)
            s2_actual = f"Columns: {cols}, PKs: {pks}, Rows: {len(tbl_info.get('sample_rows', []))}"
            self.log_result(
                2,
                "Query unknown table without modifying application prompts or code",
                "Returns exact schema, primary key 'OrderID', and 3 sample rows",
                s2_actual,
                s2_passed
            )

            # ── Scenario 3: Add numeric column to existing table and verify live schema ──
            with self.engine.connect() as conn:
                conn.execute(text("ALTER TABLE Test_ProductionOrders ADD DefectRate NUMERIC(5,2);"))
                conn.execute(text("UPDATE Test_ProductionOrders SET DefectRate = 2.45 WHERE OrderID = 101;"))
                conn.commit()

            self.schema_svc.invalidate_cache()
            updated_info = self.schema_svc.inspect_table("Test_ProductionOrders")
            updated_cols = [c["name"] for c in updated_info.get("columns", [])]
            s3_passed = "DefectRate" in updated_cols
            s3_actual = f"Newly added column DefectRate found in schema: {s3_passed}"
            self.log_result(
                3,
                "Add column to existing table and verify live schema update",
                "Column 'DefectRate' appears in schema definition immediately after cache refresh",
                s3_actual,
                s3_passed
            )

            # ── Scenario 4: Add table linked by foreign key and test valid multi-table query ──
            with self.engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE Test_OrderItems (
                        ItemID INT PRIMARY KEY,
                        OrderID INT NOT NULL,
                        ColorCode VARCHAR(30),
                        Pieces INT,
                        CONSTRAINT FK_TestOrderItem_Order FOREIGN KEY (OrderID) REFERENCES Test_ProductionOrders(OrderID)
                    );
                    INSERT INTO Test_OrderItems VALUES (1, 101, 'Indigo Blue', 2500);
                    INSERT INTO Test_OrderItems VALUES (2, 101, 'Navy Blue', 2350);
                    INSERT INTO Test_OrderItems VALUES (3, 102, 'Charcoal', 7200);
                """))
                conn.commit()

            self.schema_svc.invalidate_cache()
            join_res = self.schema_svc.validate_join("Test_OrderItems", "Test_ProductionOrders", "OrderID", "OrderID")
            s4_passed = join_res.get("is_valid") is True and join_res.get("has_foreign_key") is True
            s4_actual = f"Valid: {join_res.get('is_valid')}, Has FK: {join_res.get('has_foreign_key')}, Cardinality: {join_res.get('cardinality')}"
            self.log_result(
                4,
                "Add table linked by foreign key and test valid multi-table join",
                "Join confirmed by declared foreign key constraint with cardinality analysis",
                s4_actual,
                s4_passed
            )

            # ── Scenario 5: Add table without foreign keys and verify AI does not invent join ──
            with self.engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE Test_CustomerFeedback (
                        FeedbackID INT PRIMARY KEY,
                        Rating INT,
                        Comment VARCHAR(255)
                    );
                    INSERT INTO Test_CustomerFeedback VALUES (1, 5, 'Exceptional fabric quality');
                    INSERT INTO Test_CustomerFeedback VALUES (2, 4, 'Timely dispatch');
                """))
                conn.commit()

            self.schema_svc.invalidate_cache()
            unlinked_join = self.schema_svc.validate_join("Test_CustomerFeedback", "Test_ProductionOrders", "Rating", "ProducedQuantity")
            s5_passed = (unlinked_join.get("has_foreign_key") is False)
            s5_actual = f"Has FK: {unlinked_join.get('has_foreign_key')}, Recommendation: {unlinked_join.get('recommendation')}"
            self.log_result(
                5,
                "Add table without foreign keys and verify join caution",
                "System flags that no foreign key exists and warns against ungrounded join",
                s5_actual,
                s5_passed
            )

            # ── Scenario 6: Rename or remove a column and verify stale queries detected ──
            with self.engine.connect() as conn:
                conn.execute(text("ALTER TABLE Test_ProductionOrders DROP COLUMN DefectRate;"))
                conn.commit()

            self.schema_svc.invalidate_cache()
            stale_query_res = self.schema_svc.execute_safe_query(
                "SELECT OrderID, DefectRate FROM Test_ProductionOrders",
                self.admin_user
            )
            s6_passed = stale_query_res.get("status") == "error" and ("DefectRate" in stale_query_res.get("error", "") or "Invalid column" in stale_query_res.get("error", ""))
            s6_actual = f"Query status: {stale_query_res.get('status')}, Error captured: {stale_query_res.get('error')[:60]}..."
            self.log_result(
                6,
                "Remove column and verify stale query detection",
                "Query referencing dropped column fails explicitly with clear database diagnostic",
                s6_actual,
                s6_passed
            )

            # ── Scenario 7: Add a new business domain unrelated to existing tables ──
            with self.engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE Test_EmployeeAttendance (
                        EmployeeID INT PRIMARY KEY,
                        EmployeeName VARCHAR(100),
                        ShiftType VARCHAR(20),
                        HoursWorked NUMERIC(4,2),
                        AttendanceDate DATE
                    );
                    INSERT INTO Test_EmployeeAttendance VALUES (501, 'Ramesh Kumar', 'Morning', 8.5, '2026-10-01');
                    INSERT INTO Test_EmployeeAttendance VALUES (502, 'Suresh Patel', 'Evening', 8.0, '2026-10-01');
                """))
                conn.commit()

            self.schema_svc.invalidate_cache()
            hr_table = self.schema_svc.inspect_table("Test_EmployeeAttendance")
            s7_passed = hr_table.get("domain") == "Human Resources & Labor"
            s7_actual = f"Domain dynamically categorized as: '{hr_table.get('domain')}'"
            self.log_result(
                7,
                "Add new business domain (HR & Labor) and verify dynamic categorization",
                "Table classified under 'Human Resources & Labor' domain automatically",
                s7_actual,
                s7_passed
            )

            # ── Scenario 8: Ask question involving both old and newly added tables ──
            all_comps = self.repo.get_companies()
            target_comp_id = all_comps[0].id if all_comps else "comp_fbs_1"
            cross_query = f"""
                SELECT 
                    c.name AS CompanyName,
                    p.ItemCode,
                    p.ProducedQuantity
                FROM ai_companies c
                CROSS JOIN Test_ProductionOrders p
                WHERE p.OrderID = 101 AND c.id = '{target_comp_id}'
            """
            cross_res = self.schema_svc.execute_safe_query(cross_query, self.admin_user)
            s8_passed = cross_res.get("status") == "success" and cross_res.get("row_count") == 1
            s8_actual = f"Status: {cross_res.get('status')}, Records returned: {cross_res.get('row_count')}, Execution ms: {cross_res.get('execution_time_ms')}"
            self.log_result(
                8,
                "Query combining old platform tables and newly added schema",
                "Executes multi-table query seamlessly combining platform and new tables",
                s8_actual,
                s8_passed
            )

            # ── Scenario 9: Introduce unmatched identifiers and verify anomaly detection ──
            # Insert unmatched order in items table (with FK check temporarily disabled for test)
            with self.engine.connect() as conn:
                conn.execute(text("ALTER TABLE Test_OrderItems NOCHECK CONSTRAINT FK_TestOrderItem_Order;"))
                conn.execute(text("INSERT INTO Test_OrderItems VALUES (999, 99999, 'Phantom Color', 100);"))
                conn.execute(text("ALTER TABLE Test_OrderItems CHECK CONSTRAINT FK_TestOrderItem_Order;"))
                conn.commit()

            anomaly_join = self.schema_svc.validate_join("Test_OrderItems", "Test_ProductionOrders", "OrderID", "OrderID")
            unmatched_pct = anomaly_join.get("unmatched_left_pct", 0)
            s9_passed = unmatched_pct > 0.0
            s9_actual = f"Detected unmatched rate: {unmatched_pct}%, Recommendation: {anomaly_join.get('recommendation')}"
            self.log_result(
                9,
                "Detect unmatched foreign key identifiers",
                "Identifies unmatched records percentage and recommends join adjustments",
                s9_actual,
                s9_passed
            )

            # ── Scenario 10: Restrict access and test database permissions & security ──
            # Attempt mutation (DELETE) and sensitive credential access
            try:
                self.schema_svc.execute_safe_query("DELETE FROM Test_ProductionOrders", self.admin_user)
                s10_mutation_blocked = False
            except Exception as e:
                s10_mutation_blocked = True

            try:
                self.schema_svc.execute_safe_query("SELECT password_hash FROM ai_users", self.admin_user)
                s10_creds_blocked = False
            except Exception as e:
                s10_creds_blocked = True

            s10_passed = s10_mutation_blocked and s10_creds_blocked
            s10_actual = f"Mutation blocked: {s10_mutation_blocked}, Credentials access blocked: {s10_creds_blocked}"
            self.log_result(
                10,
                "Security & read-only permission enforcement",
                "Blocks mutations (DELETE/DROP) and prohibits access to sensitive auth credentials",
                s10_actual,
                s10_passed
            )

            # ── Scenario 11: Refresh schema metadata and verify existing reports continue ──
            refresh_res = ToolRegistry.execute_tool(
                "refresh_database_schema",
                {},
                self.admin_user,
                self.repo
            )
            # Verify core calculation metric tool still operates normally
            metric_res = ToolRegistry.execute_tool(
                "calculate_metric",
                {"metric_type": "revenue", "period": "latest", "company_id": target_comp_id},
                self.admin_user,
                self.repo
            )
            s11_passed = refresh_res.get("status") == "success" and metric_res.get("status") == "success"
            s11_actual = f"Refresh status: {refresh_res.get('status')}, Metric value: INR {metric_res.get('value')} Lakh ({metric_res.get('month')})"
            self.log_result(
                11,
                "Refresh schema metadata and verify existing BI tools continue working",
                "Schema cache refreshes cleanly and deterministic financial calculations execute without regression",
                s11_actual,
                s11_passed
            )

            # ── Scenario 12: Ask about unknown or inaccessible table ──
            unknown_res = self.schema_svc.inspect_table("NonExistent_GhostTable_999", include_samples=False)
            s12_passed = unknown_res.get("status") == "error" and ("does not exist" in unknown_res.get("error", "").lower() or "cannot be inspected" in unknown_res.get("error", "").lower() or "invalid object" in unknown_res.get("error", "").lower())
            s12_actual = f"Status: {unknown_res.get('status')}, Error: {unknown_res.get('error')}"
            self.log_result(
                12,
                "Ask about unknown or non-existent table",
                "System accurately explains that table does not exist rather than hallucinating",
                s12_actual,
                s12_passed
            )

        finally:
            self.cleanup_test_tables()

        # ── Summary Report ──
        print("================================================================================")
        print("ACCEPTANCE TEST SUITE SUMMARY REPORT")
        print("================================================================================")
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["status"] == "PASS")
        failed_tests = total_tests - passed_tests

        print(f"Total Scenarios Tested: {total_tests}")
        print(f"Passed:                 {passed_tests}")
        print(f"Failed:                 {failed_tests}")
        print(f"Pass Rate:              {(passed_tests/total_tests)*100:.1f}%\n")

        return passed_tests == total_tests

if __name__ == "__main__":
    tester = SchemaAcceptanceTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
