"""
schema_service.py
=================
Dynamic Schema Discovery, Relationship Analysis, and Safe SQL Execution
for TexVantage AI.

Implements Section 16 of the Master Business Intelligence & Reasoning Prompt:
- Automatically discovers live schema (tables, views, columns, keys, types).
- No hardcoded table restrictions or static schemas.
- In-memory caching with on-demand refresh & change detection.
- Dynamic relationship discovery & join safety validation.
- Safe read-only execution with tenant isolation and row capping.
"""

from typing import List, Dict, Any, Optional, Tuple, Set
import logging
import re
import time
from datetime import datetime, date, timezone
from sqlalchemy import text, inspect
from ...repositories.base import IDataRepository
from ...schemas.auth import AuthenticatedUser
from ...core.exceptions import ForbiddenError, BadRequestError

logger = logging.getLogger(__name__)

# Business domain mapping heuristics based on table naming patterns
DOMAIN_PATTERNS = {
    "Finance & Accounts": [
        "account", "ledger", "voucher", "bank", "payment", "receipt", "tax", "gst",
        "financial", "cogs", "cost", "overhead", "journal", "balance", "credit", "debit"
    ],
    "Sales & Commercial": [
        "invoice", "sales", "buyer", "customer", "order", "quotation", "export",
        "retail", "shipment", "dispatch", "agent", "pricing", "commercial"
    ],
    "Procurement & Sourcing": [
        "purchase", "supplier", "vendor", "po_", "requisition", "sourcing",
        "material_req", "yarn_purchase", "fabric_purchase", "accessory"
    ],
    "Production & Manufacturing": [
        "production", "cutting", "sewing", "finishing", "knitting", "weaving", "dyeing",
        "plancard", "job_ord", "work_order", "capacity", "machine", "line", "process",
        "bundle", "barcode", "shift", "efficiency"
    ],
    "Inventory & Warehousing": [
        "stock", "store", "item", "inventory", "yarn", "fabric", "trim",
        "godown", "warehouse", "movement", "issue", "receipt", "batch"
    ],
    "Quality & Compliance": [
        "quality", "inspection", "defect", "rejection", "grade", "audit",
        "testing", "lab_test", "qlty", "standard", "compliance"
    ],
    "Human Resources & Labor": [
        "employee", "attendance", "payroll", "salary", "worker", "operator",
        "department", "designation", "overtime", "leave"
    ],
    "Master Data & Configuration": [
        "company", "division", "unit", "country", "city", "state", "currency",
        "color", "size", "style", "category", "uom", "season"
    ],
    "Platform AI & Analytics": [
        "ai_companies", "ai_monthly_financials", "ai_product_metrics", "ai_datasets",
        "ai_conversations", "ai_messages", "ai_artifacts", "ai_users", "ai_audit_logs"
    ]
}


class SchemaService:
    """
    Central engine for discovering, inspecting, and querying live database tables.
    """

    _catalog_cache: Optional[List[Dict[str, Any]]] = None
    _catalog_timestamp: float = 0.0
    _table_cache: Dict[str, Dict[str, Any]] = {}
    CACHE_TTL_SECONDS = 300.0  # 5 minutes default cache

    def __init__(self, repository: IDataRepository):
        self.repository = repository
        self.engine = repository.engine
        self.dialect_name = self.engine.dialect.name.lower()

    def invalidate_cache(self) -> None:
        """Forces immediate eviction of schema caches."""
        SchemaService._catalog_cache = None
        SchemaService._catalog_timestamp = 0.0
        SchemaService._table_cache.clear()
        logger.info("Schema discovery cache invalidated.")

    def _classify_domain(self, table_name: str) -> str:
        tbl_lower = table_name.lower()
        if tbl_lower.startswith("ai_"):
            return "Platform AI & Analytics"
        clean_tbl = tbl_lower[5:] if tbl_lower.startswith("test_") else tbl_lower
        for domain, patterns in DOMAIN_PATTERNS.items():
            if any(p in clean_tbl for p in patterns):
                return domain
        return "General ERP & Operations"

    def get_all_tables_and_views(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Discovers all accessible tables and views with schema, type, approximate row count,
        and business domain classification.
        """
        now = time.time()
        if not force_refresh and SchemaService._catalog_cache is not None:
            if (now - SchemaService._catalog_timestamp) < SchemaService.CACHE_TTL_SECONDS:
                return SchemaService._catalog_cache

        catalog: List[Dict[str, Any]] = []

        try:
            if "mssql" in self.dialect_name:
                with self.engine.connect() as conn:
                    # Query sys.objects directly without heavy partition joins - instant execution
                    sql = """
                        SELECT 
                            SCHEMA_NAME(schema_id) AS schema_name,
                            name AS table_name,
                            CASE WHEN type = 'U' THEN 'TABLE' ELSE 'VIEW' END AS table_type
                        FROM sys.objects
                        WHERE type IN ('U', 'V')
                        ORDER BY name
                    """
                    rows = conn.execute(text(sql)).fetchall()
                    for r in rows:
                        s_name, t_name, t_type = r[0], r[1], r[2]
                        catalog.append({
                            "schema": s_name,
                            "name": t_name,
                            "full_name": f"{s_name}.{t_name}" if s_name != "dbo" else t_name,
                            "type": t_type,
                            "approx_rows": 0,
                            "domain": self._classify_domain(t_name)
                        })
            else:
                # Standard ANSI fallback (PostgreSQL, SQLite, MySQL)
                inspector = inspect(self.engine)
                for tbl in inspector.get_table_names():
                    catalog.append({
                        "schema": "public",
                        "name": tbl,
                        "full_name": tbl,
                        "type": "TABLE",
                        "approx_rows": 0,
                        "domain": self._classify_domain(tbl)
                    })
                for vw in inspector.get_view_names():
                    catalog.append({
                        "schema": "public",
                        "name": vw,
                        "full_name": vw,
                        "type": "VIEW",
                        "approx_rows": 0,
                        "domain": self._classify_domain(vw)
                    })
        except Exception as e:
            logger.error(f"Failed to query database catalog: {e}")
            # Fallback to SQLAlchemy inspector if SQL Server system views fail
            try:
                inspector = inspect(self.engine)
                for tbl in inspector.get_table_names():
                    catalog.append({
                        "schema": "dbo",
                        "name": tbl,
                        "full_name": tbl,
                        "type": "TABLE",
                        "approx_rows": 0,
                        "domain": self._classify_domain(tbl)
                    })
            except Exception as e2:
                logger.error(f"Inspector fallback failed: {e2}")

        SchemaService._catalog_cache = catalog
        SchemaService._catalog_timestamp = now
        return catalog

    def search_tables(
        self,
        keyword: Optional[str] = None,
        domain: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Finds tables matching a keyword, domain, or business concept.
        """
        catalog = self.get_all_tables_and_views()
        results = []

        kw = (keyword or "").strip().lower()
        dom = (domain or "").strip().lower()

        for item in catalog:
            t_name = item["name"].lower()
            item_domain = item["domain"].lower()

            if dom and dom not in item_domain:
                continue

            if kw:
                # Match name or domain
                if kw in t_name or kw in item_domain:
                    results.append(item)
            else:
                results.append(item)

            if len(results) >= limit:
                break

        return results

    def inspect_table(self, table_name: str, include_samples: bool = True) -> Dict[str, Any]:
        """
        Retrieves detailed column definitions, primary keys, foreign keys, and safe sample rows.
        """
        # Clean table name
        clean_name = table_name.replace("[", "").replace("]", "").strip()
        if clean_name in SchemaService._table_cache:
            return SchemaService._table_cache[clean_name]

        columns: List[Dict[str, Any]] = []
        primary_keys: List[str] = []
        foreign_keys: List[Dict[str, Any]] = []
        sample_rows: List[Dict[str, Any]] = []
        row_count = 0

        try:
            if "mssql" in self.dialect_name:
                with self.engine.connect() as conn:
                    # 1. Primary keys
                    pk_sql = """
                        SELECT c.name
                        FROM sys.indexes i
                        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                        WHERE i.is_primary_key = 1 AND i.object_id = OBJECT_ID(:tbl)
                    """
                    pks = [r[0] for r in conn.execute(text(pk_sql), {"tbl": clean_name}).fetchall()]
                    primary_keys = pks

                    # 2. Columns
                    col_sql = """
                        SELECT 
                            c.name AS col_name,
                            t.name AS type_name,
                            c.max_length,
                            c.precision,
                            c.scale,
                            c.is_nullable
                        FROM sys.columns c
                        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                        WHERE c.object_id = OBJECT_ID(:tbl)
                        ORDER BY c.column_id
                    """
                    col_rows = conn.execute(text(col_sql), {"tbl": clean_name}).fetchall()
                    for cr in col_rows:
                        c_name = cr[0]
                        c_type = cr[1]
                        is_null = bool(cr[5])
                        columns.append({
                            "name": c_name,
                            "type": c_type,
                            "nullable": is_null,
                            "is_primary_key": c_name in primary_keys
                        })

                    # 3. Foreign Keys
                    fk_sql = """
                        SELECT 
                            fk.name AS fk_name,
                            c.name AS column_name,
                            OBJECT_NAME(fk.referenced_object_id) AS ref_table,
                            rc.name AS ref_column
                        FROM sys.foreign_keys fk
                        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                        INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                        INNER JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
                        WHERE fk.parent_object_id = OBJECT_ID(:tbl)
                    """
                    fk_rows = conn.execute(text(fk_sql), {"tbl": clean_name}).fetchall()
                    for f in fk_rows:
                        foreign_keys.append({
                            "name": f[0],
                            "column": f[1],
                            "referenced_table": f[2],
                            "referenced_column": f[3]
                        })

                    # 4. Row count & safe samples
                    if columns:
                        cnt_row = conn.execute(text(f"SELECT COUNT(1) FROM [{clean_name}]")).scalar()
                        row_count = int(cnt_row or 0)

                        if include_samples and row_count > 0:
                            # Avoid selecting sensitive password or secret columns
                            safe_cols = [
                                f"[{c['name']}]" for c in columns 
                                if not any(s in c['name'].lower() for s in ("password", "hash", "secret", "token"))
                            ]
                            if safe_cols:
                                sample_sql = f"SELECT TOP 5 {', '.join(safe_cols[:15])} FROM [{clean_name}]"
                                s_rows = conn.execute(text(sample_sql)).fetchall()
                                for s in s_rows:
                                    row_dict = {}
                                    for k, v in dict(s._mapping).items():
                                        if isinstance(v, (datetime, date)):
                                            row_dict[k] = v.isoformat()
                                        elif hasattr(v, "__float__") and not isinstance(v, (int, float, bool)):
                                            row_dict[k] = float(v)
                                        else:
                                            row_dict[k] = v
                                    sample_rows.append(row_dict)
            else:
                # Generic fallback via SQLAlchemy inspector
                inspector = inspect(self.engine)
                for pk in inspector.get_pk_constraint(clean_name).get("constrained_columns", []):
                    primary_keys.append(pk)
                for c in inspector.get_columns(clean_name):
                    columns.append({
                        "name": c["name"],
                        "type": str(c["type"]),
                        "nullable": c.get("nullable", True),
                        "is_primary_key": c["name"] in primary_keys
                    })
                for fk in inspector.get_foreign_keys(clean_name):
                    foreign_keys.append({
                        "name": fk.get("name", "FK"),
                        "column": fk["constrained_columns"][0] if fk["constrained_columns"] else "",
                        "referenced_table": fk.get("referred_table", ""),
                        "referenced_column": fk["referred_columns"][0] if fk["referred_columns"] else ""
                    })

                with self.engine.connect() as conn:
                    cnt_row = conn.execute(text(f"SELECT COUNT(1) FROM {clean_name}")).scalar()
                    row_count = int(cnt_row or 0)
                    if include_samples and row_count > 0:
                        s_rows = conn.execute(text(f"SELECT * FROM {clean_name} LIMIT 5")).fetchall()
                        for s in s_rows:
                            sample_rows.append(dict(s._mapping))

        except Exception as e:
            logger.error(f"Error inspecting table {clean_name}: {e}")
            return {
                "status": "error",
                "table_name": clean_name,
                "error": f"Failed to inspect table '{clean_name}': {str(e)}"
            }

        if not columns:
            return {
                "status": "error",
                "table_name": clean_name,
                "error": f"Table or view '{clean_name}' does not exist or is not accessible in the connected database."
            }

        result = {
            "status": "success",
            "table_name": clean_name,
            "domain": self._classify_domain(clean_name),
            "columns": columns,
            "primary_keys": primary_keys,
            "foreign_keys": foreign_keys,
            "row_count": row_count,
            "sample_rows": sample_rows
        }

        # Cache if successfully retrieved
        if columns:
            SchemaService._table_cache[clean_name] = result

        return result

    def validate_join(
        self,
        left_table: str,
        right_table: str,
        left_column: str,
        right_column: str
    ) -> Dict[str, Any]:
        """
        Validates join safety between two tables.
        Checks for declared foreign keys, column type compatibility, cardinality,
        unmatched records, and risk of duplicate multiplication.
        """
        clean_left = left_table.replace("[", "").replace("]", "").strip()
        clean_right = right_table.replace("[", "").replace("]", "").strip()
        clean_lcol = left_column.replace("[", "").replace("]", "").strip()
        clean_rcol = right_column.replace("[", "").replace("]", "").strip()

        left_info = self.inspect_table(clean_left, include_samples=False)
        right_info = self.inspect_table(clean_right, include_samples=False)

        if left_info.get("status") == "error":
            return {"is_valid": False, "error": f"Table '{clean_left}' does not exist or cannot be inspected."}
        if right_info.get("status") == "error":
            return {"is_valid": False, "error": f"Table '{clean_right}' does not exist or cannot be inspected."}

        # Verify columns exist
        l_col = next((c for c in left_info["columns"] if c["name"].lower() == clean_lcol.lower()), None)
        r_col = next((c for c in right_info["columns"] if c["name"].lower() == clean_rcol.lower()), None)

        if not l_col:
            return {"is_valid": False, "error": f"Column '{clean_lcol}' not found in table '{clean_left}'."}
        if not r_col:
            return {"is_valid": False, "error": f"Column '{clean_rcol}' not found in table '{clean_right}'."}

        # Check for explicit foreign keys
        has_fk = False
        fk_desc = None
        for fk in left_info.get("foreign_keys", []):
            if (fk["column"].lower() == clean_lcol.lower() and 
                fk["referenced_table"].lower() == clean_right.lower() and 
                fk["referenced_column"].lower() == clean_rcol.lower()):
                has_fk = True
                fk_desc = f"{clean_left}.{clean_lcol} -> {clean_right}.{clean_rcol} (Declared FK)"
                break

        if not has_fk:
            for fk in right_info.get("foreign_keys", []):
                if (fk["column"].lower() == clean_rcol.lower() and 
                    fk["referenced_table"].lower() == clean_left.lower() and 
                    fk["referenced_column"].lower() == clean_lcol.lower()):
                    has_fk = True
                    fk_desc = f"{clean_right}.{clean_rcol} -> {clean_left}.{clean_lcol} (Declared FK)"
                    break

        # Check data type compatibility
        l_type = l_col["type"].lower()
        r_type = r_col["type"].lower()
        is_type_compatible = (l_type == r_type or 
                              ("int" in l_type and "int" in r_type) or 
                              ("char" in l_type and "char" in r_type))

        # Test cardinality via queries
        cardinality = "Unknown"
        duplicate_risk = False
        unmatched_pct = 0.0

        try:
            with self.engine.connect() as conn:
                # Check uniqueness in right table
                q_right = text(f"""
                    SELECT 
                        COUNT(1) AS total_rows, 
                        COUNT(DISTINCT [{clean_rcol}]) AS distinct_vals 
                    FROM [{clean_right}]
                """)
                r_stats = conn.execute(q_right).fetchone()
                total_r, dist_r = (r_stats[0] or 0), (r_stats[1] or 0)

                # Check uniqueness in left table
                q_left = text(f"""
                    SELECT 
                        COUNT(1) AS total_rows, 
                        COUNT(DISTINCT [{clean_lcol}]) AS distinct_vals 
                    FROM [{clean_left}]
                """)
                l_stats = conn.execute(q_left).fetchone()
                total_l, dist_l = (l_stats[0] or 0), (l_stats[1] or 0)

                left_is_unique = (total_l > 0 and total_l == dist_l)
                right_is_unique = (total_r > 0 and total_r == dist_r)

                if left_is_unique and right_is_unique:
                    cardinality = "1:1"
                elif not left_is_unique and right_is_unique:
                    cardinality = "N:1 (Many-to-One, Safe for aggregation)"
                elif left_is_unique and not right_is_unique:
                    cardinality = "1:N (One-to-Many)"
                else:
                    cardinality = "N:M (Many-to-Many: HIGH RISK of Cartesian duplicate multiplication)"
                    duplicate_risk = True

                # Check unmatched left records
                q_unmatched = text(f"""
                    SELECT COUNT(1)
                    FROM [{clean_left}] l
                    LEFT JOIN [{clean_right}] r ON l.[{clean_lcol}] = r.[{clean_rcol}]
                    WHERE r.[{clean_rcol}] IS NULL AND l.[{clean_lcol}] IS NOT NULL
                """)
                unmatched_count = conn.execute(q_unmatched).scalar() or 0
                if total_l > 0:
                    unmatched_pct = round((unmatched_count / total_l) * 100.0, 2)

        except Exception as e:
            logger.warning(f"Error checking join cardinality: {e}")

        is_valid = is_type_compatible and not (duplicate_risk and not has_fk)

        recommendation = "Join is valid and safe."
        if has_fk:
            recommendation = f"Join verified by database constraint: {fk_desc}"
        elif duplicate_risk:
            recommendation = "CAUTION: Join exhibits Many-to-Many cardinality without declared foreign key. Aggregations may double-count values."
        elif unmatched_pct > 20:
            recommendation = f"NOTICE: {unmatched_pct}% of left records have no matching right record. Consider LEFT JOIN."

        return {
            "is_valid": is_valid,
            "has_foreign_key": has_fk,
            "foreign_key_details": fk_desc,
            "left_type": l_type,
            "right_type": r_type,
            "type_compatible": is_type_compatible,
            "cardinality": cardinality,
            "duplicate_risk": duplicate_risk,
            "unmatched_left_pct": unmatched_pct,
            "recommendation": recommendation
        }

    def execute_safe_query(
        self,
        query: str,
        user: AuthenticatedUser,
        max_rows: int = 100
    ) -> Dict[str, Any]:
        """
        Executes a read-only SELECT query securely.
        Enforces:
        - Only SELECT or WITH ... SELECT queries are permitted.
        - Blocks all DDL/DML (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC, etc.).
        - Blocks access to password hashes, auth secrets, and audit credentials.
        - Enforces tenant isolation for non-admin users.
        - Automatically caps output to max_rows (default 100).
        """
        raw_query = query.strip()
        q_lower = raw_query.lower()

        # 1. Syntax & Mutation Guard
        forbidden_keywords = [
            r"\binsert\b", r"\bupdate\b", r"\bdelete\b", r"\bdrop\b", r"\balter\b",
            r"\btruncate\b", r"\bcreate\b", r"\bexec\b", r"\bexecute\b", r"\bsp_",
            r"\bxp_", r"\bgrant\b", r"\brevoke\b", r"\bmerge\b", r"\bcommit\b",
            r"\brollback\b", r"\bkill\b", r"\bshutdown\b", r"\bopenrowset\b", r"\bopendatasource\b"
        ]
        for pattern in forbidden_keywords:
            if re.search(pattern, q_lower):
                raise BadRequestError("Security policy strictly forbids data modification, DDL, or procedural commands. Only SELECT queries are permitted.")

        # Must start with SELECT or WITH
        clean_start = re.sub(r"^/\*.*?\*/\s*", "", q_lower, flags=re.DOTALL).strip()
        clean_start = re.sub(r"^--.*?\n", "", clean_start).strip()
        if not (clean_start.startswith("select") or clean_start.startswith("with")):
            raise BadRequestError("Only read-only SELECT queries are supported.")

        # 2. Sensitive Table / Column Guard
        sensitive_keywords = ["password", "hash", "secret", "token", "credential", "auth_key"]
        for sk in sensitive_keywords:
            if sk in q_lower:
                raise ForbiddenError("Access to credentials, password hashes, or security tokens is prohibited.")

        # 3. Tenant Boundary Guard
        if not user.is_admin():
            if not user.company_id:
                raise ForbiddenError("User is not associated with any authorized enterprise context.")
            # If query touches ai_monthly_financials, ai_product_metrics, or tables with company_id, ensure tenant filtering
            if any(tbl in q_lower for tbl in ("ai_monthly_financials", "ai_product_metrics", "ai_company_knowledge", "ai_datasets")):
                if user.company_id.lower() not in q_lower and "company_id" not in q_lower:
                    raise ForbiddenError(f"Multi-tenant security policy requires queries to explicitly filter by company_id = '{user.company_id}'.")

        # 4. Limit/Top Injection to prevent huge data transfers
        final_query = raw_query
        if "mssql" in self.dialect_name:
            if not re.search(r"\bselect\s+top\s+\d+\b", q_lower) and not re.search(r"\boffset\s+\d+\s+rows\b", q_lower):
                final_query = re.sub(r"(?i)\bselect\b", f"SELECT TOP {max_rows}", raw_query, count=1)
        else:
            if not re.search(r"\blimit\s+\d+\b", q_lower):
                final_query = f"{raw_query} LIMIT {max_rows}"

        # 5. Execution
        start_time = time.time()
        try:
            with self.engine.connect() as conn:
                cursor = conn.execute(text(final_query))
                columns = list(cursor.keys())
                rows = [dict(row._mapping) for row in cursor.fetchall()]
                exec_time_ms = round((time.time() - start_time) * 1000, 2)

                # Format rows for JSON serialization (convert datetime, Decimal)
                formatted_rows = []
                for r in rows:
                    row_dict = {}
                    for k, v in r.items():
                        if isinstance(v, (datetime, )):
                            row_dict[k] = v.isoformat()
                        elif hasattr(v, "__float__"):
                            row_dict[k] = float(v)
                        else:
                            row_dict[k] = v
                    formatted_rows.append(row_dict)

                return {
                    "status": "success",
                    "columns": columns,
                    "rows": formatted_rows,
                    "row_count": len(formatted_rows),
                    "execution_time_ms": exec_time_ms,
                    "executed_query": final_query
                }
        except Exception as e:
            logger.error(f"SQL execution error on query '{final_query}': {e}")
            return {
                "status": "error",
                "error": f"SQL query execution failed: {str(e)}",
                "executed_query": final_query
            }

    def summarize_capabilities(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Summarizes the accessible business domains, major entities, and types of questions
        supported by the live connected database.
        """
        catalog = self.get_all_tables_and_views(force_refresh=force_refresh)
        domains: Dict[str, List[str]] = {}
        total_tables = 0
        total_views = 0

        for item in catalog:
            dom = item["domain"]
            if dom not in domains:
                domains[dom] = []
            if len(domains[dom]) < 10:  # store sample tables for each domain
                domains[dom].append(item["name"])
            if item["type"] == "TABLE":
                total_tables += 1
            else:
                total_views += 1

        domain_summaries = []
        for dom_name, sample_tbls in domains.items():
            domain_summaries.append({
                "domain": dom_name,
                "table_count": sum(1 for it in catalog if it["domain"] == dom_name),
                "sample_tables": sample_tbls
            })

        return {
            "status": "success",
            "database_dialect": self.dialect_name,
            "total_tables": total_tables,
            "total_views": total_views,
            "total_entities": len(catalog),
            "domains": domain_summaries,
            "sample_supported_questions": [
                "What are the top 3 highest margin mills?",
                "Show monthly sales and gross profit trends across all companies.",
                "Inspect the schema and records of any table (e.g. Invoice_Export, ProductionOrders).",
                "Compare financial performance between enterprises.",
                "Perform cross-table joins with validated relationships."
            ]
        }
