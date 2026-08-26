import uuid
from typing import List, Dict, Any, Tuple, Optional
from datetime import date
from ...models.financials import MonthlyFinancials
from ...models.product import ProductMetric

class IngestionNormalizer:
    """
    Transforms validated ingested rows into normalized MonthlyFinancials
    and ProductMetric entities ready for relational persistence.
    Strictly preserves source values and calculates deterministic derivations
    only when required source metrics are provided. Never invents synthetic values.
    """

    def normalize(
        self,
        company_id: str,
        validated_rows: List[Dict[str, Any]],
        dataset_id: str
    ) -> Tuple[List[MonthlyFinancials], List[ProductMetric], Optional[date], Optional[date]]:
        if not validated_rows:
            return [], [], None, None

        # Group rows by (year, month)
        grouped_by_month: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
        for r in validated_rows:
            key = (r["year"], r["month"])
            grouped_by_month.setdefault(key, []).append(r)

        financials: List[MonthlyFinancials] = []
        product_metrics: List[ProductMetric] = []
        all_dates: List[date] = []

        for (year, month), rows in grouped_by_month.items():
            period_date = rows[0]["period_date"]
            month_name = rows[0]["month_name"]
            all_dates.append(period_date)

            total_revenue = sum(r["revenue_lakh"] for r in rows)
            
            # COGS: aggregate if provided, otherwise None (DO NOT ESTIMATE OR INVENT)
            cogs_values = [r["cogs_lakh"] for r in rows if r.get("cogs_lakh") is not None]
            total_cogs = round(sum(cogs_values), 2) if cogs_values else None

            # Gross Profit: aggregate if provided, or derive from Revenue - COGS if COGS exists
            profit_values = [r["gross_profit_lakh"] for r in rows if r.get("gross_profit_lakh") is not None]
            if profit_values:
                total_gp = round(sum(profit_values), 2)
            elif total_cogs is not None:
                total_gp = round(total_revenue - total_cogs, 2)
            else:
                total_gp = None

            # Margin %: calculate only if Gross Profit is deterministically available
            if total_gp is not None and total_revenue > 0:
                margin_pct = round((total_gp / total_revenue * 100.0), 2)
            else:
                margin_pct = None

            # Operating Expenses: aggregate if provided, otherwise None
            opex_values = [r["operating_expenses_lakh"] for r in rows if r.get("operating_expenses_lakh") is not None]
            opex = round(sum(opex_values), 2) if opex_values else None

            # Net Profit: derive from GP - OpEx if both exist, or aggregate if provided directly
            net_profit_values = [r["net_profit_lakh"] for r in rows if r.get("net_profit_lakh") is not None]
            if net_profit_values:
                net_profit = round(sum(net_profit_values), 2)
            elif total_gp is not None and opex is not None:
                net_profit = round(total_gp - opex, 2)
            else:
                net_profit = None

            # Units Sold: aggregate if provided, otherwise None
            unit_values = [r["units_sold"] for r in rows if r.get("units_sold") is not None]
            units_sold = int(sum(unit_values)) if unit_values else None

            # Units Produced: aggregate if provided, otherwise None
            produced_values = [r["units_produced"] for r in rows if r.get("units_produced") is not None]
            units_produced = int(sum(produced_values)) if produced_values else None

            # Orders Count: aggregate if provided, otherwise None
            order_values = [r["orders_count"] for r in rows if r.get("orders_count") is not None]
            orders_count = int(sum(order_values)) if order_values else None

            # AOV: derive if revenue and orders_count are both available
            avg_aov = round((total_revenue * 100000.0) / orders_count, 2) if (orders_count and orders_count > 0) else None

            # Capacity Utilization: average if provided, otherwise None
            capacity_values = [r["capacity_utilization_pct"] for r in rows if r.get("capacity_utilization_pct") is not None]
            capacity_util = round(sum(capacity_values) / len(capacity_values), 1) if capacity_values else None

            # Raw Material Cost: aggregate if provided, otherwise None
            raw_mat_values = [r["raw_material_cost_lakh"] for r in rows if r.get("raw_material_cost_lakh") is not None]
            raw_material_cost = round(sum(raw_mat_values), 2) if raw_mat_values else None

            # Energy Cost: aggregate if provided, otherwise None
            energy_values = [r["energy_cost_lakh"] for r in rows if r.get("energy_cost_lakh") is not None]
            energy_cost = round(sum(energy_values), 2) if energy_values else None

            fin_id = f"fin_{company_id}_{year}_{month:02d}"
            fin_entity = MonthlyFinancials(
                id=fin_id,
                company_id=company_id,
                dataset_id=dataset_id,
                year=year,
                month=month,
                period_date=period_date,
                month_name=month_name,
                revenue_lakh=round(total_revenue, 2),
                cogs_lakh=total_cogs,
                gross_profit_lakh=total_gp,
                profit_margin_pct=margin_pct,
                operating_expenses_lakh=opex,
                net_profit_lakh=net_profit,
                units_produced=units_produced,
                units_sold=units_sold,
                orders_count=orders_count,
                avg_order_value_inr=avg_aov,
                capacity_utilization_pct=capacity_util,
                raw_material_cost_lakh=raw_material_cost,
                energy_cost_lakh=energy_cost
            )
            financials.append(fin_entity)

            # Product breakdown
            prod_grouped: Dict[str, List[Dict[str, Any]]] = {}
            for r in rows:
                cat = r.get("category_name")
                if cat:
                    prod_grouped.setdefault(cat, []).append(r)

            for cat_name, p_rows in prod_grouped.items():
                p_rev = sum(pr["revenue_lakh"] for pr in p_rows)
                p_unit_values = [pr["units_sold"] for pr in p_rows if pr.get("units_sold") is not None]
                p_units = float(sum(p_unit_values)) if p_unit_values else None
                p_margin = margin_pct
                p_segment = p_rows[0].get("customer_segment")

                prod_metric = ProductMetric(
                    id=f"prod_{company_id}_{year}_{month:02d}_{uuid.uuid4().hex[:6]}",
                    company_id=company_id,
                    dataset_id=dataset_id,
                    category_name=cat_name,
                    year=year,
                    month=month,
                    sales_volume_units=p_units,
                    unit_of_measure="kg",
                    revenue_lakh=round(p_rev, 2),
                    profit_margin_pct=p_margin,
                    top_customer_segment=p_segment
                )
                product_metrics.append(prod_metric)

        start_date = min(all_dates) if all_dates else None
        end_date = max(all_dates) if all_dates else None

        return financials, product_metrics, start_date, end_date
