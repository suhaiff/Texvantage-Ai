from typing import List, Dict, Any, Optional
import json
from ...schemas.auth import AuthenticatedUser
from ...repositories.base import IDataRepository
from ...core.exceptions import ForbiddenError, NotFoundError, BadRequestError
from ..analytics.query_service import BusinessQueryService
from ..analytics.metrics import (
    calculate_gross_profit,
    calculate_net_profit,
    calculate_profit_margin,
    calculate_average_order_value,
    calculate_growth_rate,
    compute_financial_aggregate
)

# 1. TOOL SCHEMAS FOR GEMINI FUNCTION DECLARATIONS
TOOL_DEFINITIONS = [
    {
        "name": "query_business_data",
        "description": "Queries historical monthly financial records, revenues, profits, and units for the authorized textile company or filter range.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "metric": {
                    "type": "STRING",
                    "description": "The specific metric to inspect (e.g. 'revenue_lakh', 'gross_profit_lakh', 'profit_margin_pct', 'units_sold', 'orders_count', 'all')"
                },
                "period": {
                    "type": "STRING",
                    "description": "Optional period filter such as 'last_month', 'last_3_months', 'last_6_months', 'all'"
                },
                "company_id": {
                    "type": "STRING",
                    "description": "Target company ID (e.g. 'comp_textile_a'). If user is OWNER, this is automatically validated against their assigned company."
                }
            },
            "required": []
        }
    },
    {
        "name": "calculate_metric",
        "description": "Calculates deterministic business metrics (gross profit, net profit, profit margin %, AOV, MoM growth %, total revenue) directly from verified database records.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "metric_type": {
                    "type": "STRING",
                    "description": "The metric to calculate: 'revenue', 'gross_profit', 'net_profit', 'margin', 'growth', 'units', 'orders', 'aov'"
                },
                "period": {
                    "type": "STRING",
                    "description": "Period scope: 'latest', 'previous', 'ytd', or 'all'"
                },
                "company_id": {
                    "type": "STRING",
                    "description": "Target company identifier."
                }
            },
            "required": ["metric_type"]
        }
    },
    {
        "name": "compare_companies",
        "description": "ADMIN ONLY: Compares financial performance, revenue, margin %, and growth across multiple companies.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_ids": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                    "description": "List of company IDs to compare side-by-side (e.g. ['comp_textile_a', 'comp_textile_b'])"
                },
                "period_months": {
                    "type": "INTEGER",
                    "description": "Number of months of historical data to compare (e.g. 6 or 12)"
                }
            },
            "required": ["company_ids"]
        }
    },
    {
        "name": "get_company_summary",
        "description": "Retrieves the complete executive summary, KPIs, peak months, and annual performance for an authorized company.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_id": {
                    "type": "STRING",
                    "description": "The company ID to retrieve (e.g. 'comp_textile_a')"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_global_summary",
        "description": "ADMIN ONLY: Retrieves the global portfolio aggregate KPIs, total revenue across all companies, and top performers.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "period_months": {
                    "type": "INTEGER",
                    "description": "Number of months to aggregate (e.g. 6 or 12)"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_sales_trend",
        "description": "Retrieves chronological month-by-month sales revenue, units sold, and growth rates.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_id": {
                    "type": "STRING",
                    "description": "Target company ID"
                },
                "months": {
                    "type": "INTEGER",
                    "description": "Number of recent months (default 6)"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_profit_trend",
        "description": "Retrieves chronological profit and margin percentages over time.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_id": {
                    "type": "STRING",
                    "description": "Target company ID"
                },
                "months": {
                    "type": "INTEGER",
                    "description": "Number of recent months (default 6)"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_top_products",
        "description": "Retrieves top product and fabric categories ranked by revenue and profit margin.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_id": {
                    "type": "STRING",
                    "description": "Target company ID"
                },
                "limit": {
                    "type": "INTEGER",
                    "description": "Number of top categories to return (default 5)"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_uploaded_datasets_info",
        "description": "Retrieves information about uploaded business datasets, dates of uploads, total record counts, status, and covered historical date periods.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "company_id": {
                    "type": "STRING",
                    "description": "Target company ID"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_database_schema",
        "description": "Reflects the database to retrieve all table names, column names, and data types. Use this to understand the schema before generating SQL queries.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "execute_sql_query",
        "description": "Executes a raw SQL query on the database. NEVER execute DELETE or UPDATE statements.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "The SELECT query to execute."
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "render_custom_chart",
        "description": "Renders a custom React chart component in the UI. Pass the SQL query results directly into data_points.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING"},
                "chart_type": {"type": "STRING", "description": "bar, line, area, or pie"},
                "x_key": {"type": "STRING", "description": "The exact key in data_points used for the x-axis"},
                "series": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                    "description": "Array of keys to be plotted on the y-axis"
                },
                "data_points": {
                    "type": "ARRAY",
                    "items": {"type": "OBJECT"},
                    "description": "The raw JSON array of records returned by execute_sql_query"
                }
            },
            "required": ["title", "chart_type", "x_key", "series", "data_points"]
        }
    }
]

# 2. TOOL EXECUTION ENGINE (WITH STRICT CONTEXT VALIDATION)
class ToolRegistry:
    """
    Central execution registry for AI tools.
    Enforces authorization context on all invocations.
    """

    @staticmethod
    def get_available_tools(user: AuthenticatedUser) -> List[Dict[str, Any]]:
        """
        Returns tool definitions available to the specific user role.
        Admin receives all tools; Owner does NOT receive cross-company comparison/global tools.
        """
        if user.is_admin():
            return TOOL_DEFINITIONS
        # Filter out ADMIN-only tools for OWNER
        restricted = {"compare_companies", "get_global_summary"}
        return [t for t in TOOL_DEFINITIONS if t["name"] not in restricted]

    @staticmethod
    def execute_tool(
        tool_name: str,
        arguments: Dict[str, Any],
        user: AuthenticatedUser,
        repository: IDataRepository
    ) -> Dict[str, Any]:
        """
        Executes a registered tool securely within the user's authorization boundary.
        """
        query_service = BusinessQueryService(repository, user)

        try:
            # 1. query_business_data
            if tool_name == "query_business_data":
                target_comp = arguments.get("company_id")
                period = arguments.get("period", "all")
                
                limit = None
                if period == "last_month":
                    limit = 1
                elif period == "last_3_months":
                    limit = 3
                elif period == "last_6_months":
                    limit = 6

                financials = query_service.get_monthly_financials(
                    company_id=target_comp,
                    limit=limit
                )
                if not financials:
                    return {"status": "not_found", "message": "No financial records found for the requested criteria."}
                
                metric = arguments.get("metric")
                if metric and metric != "all":
                    # Filter only the requested metric
                    filtered = [
                        {"month": f["month_name"], "period": f["period_date"], metric: f.get(metric)}
                        for f in financials
                    ]
                    return {"status": "success", "metric": metric, "records": filtered}

                return {"status": "success", "records": financials}

            # 2. calculate_metric
            elif tool_name == "calculate_metric":
                target_comp = arguments.get("company_id")
                metric_type = arguments.get("metric_type", "revenue").lower()
                period = arguments.get("period", "latest").lower()

                financials = query_service.get_monthly_financials(company_id=target_comp)
                if not financials:
                    return {"status": "not_found", "message": "No financial data available for calculations."}

                latest = financials[-1]
                prev = financials[-2] if len(financials) >= 2 else None

                if metric_type in ("revenue", "total_revenue"):
                    if period == "all" or period == "ytd":
                        total = round(sum(f["revenue_lakh"] for f in financials if f["revenue_lakh"] is not None), 2)
                        return {"status": "success", "metric": "total_revenue_lakh", "value": total, "unit": "Lakh INR", "period": f"Total across {len(financials)} months"}
                    return {"status": "success", "metric": "revenue_lakh", "value": latest["revenue_lakh"], "unit": "Lakh INR", "month": latest["month_name"]}

                elif metric_type in ("gross_profit", "profit"):
                    if latest.get("gross_profit_lakh") is None:
                        return {
                            "status": "unavailable",
                            "metric": "gross_profit_lakh",
                            "message": "Gross profit cannot be verified because COGS data was not provided in the uploaded dataset for this period.",
                            "value": None
                        }
                    if period == "all" or period == "ytd":
                        gp_records = [f["gross_profit_lakh"] for f in financials if f.get("gross_profit_lakh") is not None]
                        total = round(sum(gp_records), 2) if gp_records else None
                        return {"status": "success", "metric": "total_gross_profit_lakh", "value": total, "unit": "Lakh INR", "period": f"Total across {len(gp_records)} available months"}
                    return {"status": "success", "metric": "gross_profit_lakh", "value": latest["gross_profit_lakh"], "unit": "Lakh INR", "month": latest["month_name"]}

                elif metric_type in ("margin", "profit_margin"):
                    if latest.get("profit_margin_pct") is None:
                        return {
                            "status": "unavailable",
                            "metric": "profit_margin_pct",
                            "message": "Gross margin cannot be verified because COGS data was not provided for this period.",
                            "value": None
                        }
                    return {"status": "success", "metric": "profit_margin_pct", "value": latest["profit_margin_pct"], "unit": "%", "month": latest["month_name"]}

                elif metric_type == "growth":
                    if not prev:
                        return {"status": "insufficient_data", "message": "At least two months of data required to compute growth."}
                    growth = calculate_growth_rate(latest["revenue_lakh"], prev["revenue_lakh"])
                    change = round(latest["revenue_lakh"] - prev["revenue_lakh"], 2)
                    return {
                        "status": "success",
                        "metric": "revenue_growth",
                        "growth_pct": growth,
                        "change_lakh": change,
                        "current_month": latest["month_name"],
                        "previous_month": prev["month_name"],
                        "current_revenue_lakh": latest["revenue_lakh"],
                        "previous_revenue_lakh": prev["revenue_lakh"]
                    }

                elif metric_type in ("units", "units_sold"):
                    if latest.get("units_sold") is None:
                        return {
                            "status": "unavailable",
                            "metric": "units_sold",
                            "message": "Volume units data was not provided in the dataset for this period.",
                            "value": None
                        }
                    return {"status": "success", "metric": "units_sold", "value": latest["units_sold"], "unit": "Units", "month": latest["month_name"]}

                elif metric_type in ("orders", "aov"):
                    if latest.get("avg_order_value_inr") is None:
                        return {
                            "status": "unavailable",
                            "metric": "avg_order_value_inr",
                            "message": "Order count and AOV data were not provided in the dataset for this period.",
                            "value": None
                        }
                    return {"status": "success", "metric": "avg_order_value_inr", "value": latest["avg_order_value_inr"], "orders_count": latest["orders_count"], "unit": "INR"}

                else:
                    return {"status": "error", "message": f"Unsupported metric_type: '{metric_type}'"}

            # 3. compare_companies (Admin only)
            elif tool_name == "compare_companies":
                company_ids = arguments.get("company_ids", [])
                period_months = int(arguments.get("period_months", 6))
                result = query_service.get_company_comparison(company_ids, period_months)
                return {"status": "success", "comparison": result}

            # 4. get_company_summary
            elif tool_name == "get_company_summary":
                target_comp = arguments.get("company_id")
                summary = query_service.get_company_summary(target_comp)
                return {"status": "success", "company_summary": summary}

            # 5. get_global_summary (Admin only)
            elif tool_name == "get_global_summary":
                period_months = int(arguments.get("period_months", 6))
                global_sum = query_service.get_global_summary(period_months)
                return {"status": "success", "global_summary": global_sum}

            # 6. get_sales_trend
            elif tool_name == "get_sales_trend":
                target_comp = arguments.get("company_id")
                months = int(arguments.get("months", 6))
                trend = query_service.get_sales_trend(target_comp, months=months)
                return {"status": "success", "sales_trend": trend}

            # 7. get_profit_trend
            elif tool_name == "get_profit_trend":
                target_comp = arguments.get("company_id")
                months = int(arguments.get("months", 6))
                trend = query_service.get_profit_trend(target_comp, months=months)
                return {"status": "success", "profit_trend": trend}

            # 8. get_top_products
            elif tool_name == "get_top_products":
                target_comp = arguments.get("company_id")
                limit = int(arguments.get("limit", 5))
                products = query_service.get_top_products(target_comp, limit=limit)
                return {"status": "success", "top_products": products}

            # 9. get_uploaded_datasets_info
            elif tool_name == "get_uploaded_datasets_info":
                target_comp = arguments.get("company_id")
                info = query_service.get_uploaded_datasets_info(target_comp)
                return {"status": "success", "datasets_info": info}

            # 10. get_database_schema
            elif tool_name == "get_database_schema":
                from sqlalchemy import inspect
                inspector = inspect(repository.engine)
                schema = {}
                for table in inspector.get_table_names():
                    columns = []
                    for col in inspector.get_columns(table):
                        columns.append(f"{col['name']} ({col['type']})")
                    schema[table] = columns
                return {"status": "success", "schema": schema}
                
            # 11. execute_sql_query
            elif tool_name == "execute_sql_query":
                from sqlalchemy import text
                with repository.SessionLocal() as session:
                    result = session.execute(text(arguments["query"]))
                    rows = [dict(row._mapping) for row in result]
                return {"status": "success", "results": rows}
                
            # 12. render_custom_chart
            elif tool_name == "render_custom_chart":
                return {
                    "status": "success",
                    "chart_data": arguments
                }

            else:
                return {"status": "error", "message": f"Unknown tool: '{tool_name}'"}

        except ForbiddenError as e:
            return {"status": "forbidden", "error": str(e)}
        except NotFoundError as e:
            return {"status": "not_found", "error": str(e)}
        except Exception as e:
            return {"status": "error", "error": f"Tool execution failed: {str(e)}"}
