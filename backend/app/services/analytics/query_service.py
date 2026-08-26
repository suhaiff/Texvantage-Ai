from typing import List, Optional, Dict, Any
from datetime import date
from ...repositories.base import IDataRepository
from ...schemas.auth import AuthenticatedUser
from ...core.exceptions import ForbiddenError, NotFoundError, BadRequestError
from .metrics import (
    compute_financial_aggregate,
    compute_mom_growth,
    find_highest_lowest_periods,
    calculate_growth_rate
)
from .comparison import compare_multiple_companies

class BusinessQueryService:
    """
    Business Query and Data Grounding Service.
    Enforces strict server-side tenant isolation context on every query.
    Never trusts AI-generated company identifiers.
    """

    def __init__(self, repository: IDataRepository, user: AuthenticatedUser):
        self.repository = repository
        self.user = user

    def _resolve_company_scope(self, target_company_id: Optional[str] = None) -> str:
        """
        Validates target company against user authorization context.
        Returns the resolved authorized company ID.
        """
        if not self.user.is_admin():
            if not self.user.company_id:
                raise ForbiddenError("User has no associated company context")
            if target_company_id and target_company_id != self.user.company_id:
                raise ForbiddenError(f"Access denied: User is not authorized to query company '{target_company_id}'.")
            return self.user.company_id
        
        # Admin
        if target_company_id:
            return target_company_id
        
        # If Admin gave no specific target, default to first available company or raise
        all_comps = self.repository.get_companies()
        if not all_comps:
            raise NotFoundError("No companies registered in the system")
        return all_comps[0].id

    def get_company_summary(self, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves company summary KPI card data with peak months and 12-month aggregations.
        """
        comp_id = self._resolve_company_scope(company_id)
        company = self.repository.get_company_by_id(comp_id)
        if not company:
            raise NotFoundError(f"Company '{comp_id}' not found")

        financials = self.repository.get_monthly_financials([comp_id])
        financials.sort(key=lambda r: r.period_date)

        agg = compute_financial_aggregate(financials)
        mom = compute_mom_growth(financials)
        peaks = find_highest_lowest_periods(financials)

        latest_record = financials[-1] if financials else None
        prev_record = financials[-2] if len(financials) >= 2 else None

        mom_rev_growth = calculate_growth_rate(
            latest_record.revenue_lakh if latest_record else 0.0,
            prev_record.revenue_lakh if prev_record else 0.0
        ) if prev_record and latest_record else 0.0

        return {
            "company_id": company.id,
            "company_name": company.name,
            "code": company.code,
            "specialization": company.specialization,
            "city": company.city,
            "state": company.state,
            "founded_year": company.founded_year,
            "capacity_description": company.annual_capacity_description,
            "period_months": len(financials),
            "latest_month": latest_record.month_name if latest_record else "N/A",
            "latest_monthly_revenue_lakh": latest_record.revenue_lakh if latest_record else 0.0,
            "latest_profit_margin_pct": latest_record.profit_margin_pct if latest_record else 0.0,
            "latest_units_sold": latest_record.units_sold if latest_record else 0,
            "latest_capacity_utilization_pct": latest_record.capacity_utilization_pct if latest_record else 0.0,
            "mom_revenue_growth_pct": mom_rev_growth,
            "annual_aggregate": agg,
            "peaks_and_troughs": peaks
        }

    def get_monthly_financials(
        self,
        company_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves detailed monthly financial statements for authorized company.
        """
        comp_id = self._resolve_company_scope(company_id)
        records = self.repository.get_monthly_financials(
            authorized_company_ids=[comp_id],
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        records.sort(key=lambda r: r.period_date)

        return [
            {
                "id": r.id,
                "company_id": r.company_id,
                "year": r.year,
                "month": r.month,
                "month_name": r.month_name,
                "period_date": r.period_date.isoformat(),
                "revenue_lakh": r.revenue_lakh,
                "cogs_lakh": r.cogs_lakh,
                "gross_profit_lakh": r.gross_profit_lakh,
                "profit_margin_pct": r.profit_margin_pct,
                "operating_expenses_lakh": r.operating_expenses_lakh,
                "net_profit_lakh": r.net_profit_lakh,
                "units_produced": r.units_produced,
                "units_sold": r.units_sold,
                "orders_count": r.orders_count,
                "avg_order_value_inr": r.avg_order_value_inr,
                "capacity_utilization_pct": r.capacity_utilization_pct
            }
            for r in records
        ]

    def get_sales_trend(self, company_id: Optional[str] = None, months: int = 6) -> Dict[str, Any]:
        """
        Retrieves chronological sales and unit volume trends.
        """
        comp_id = self._resolve_company_scope(company_id)
        financials = self.repository.get_monthly_financials([comp_id])
        financials.sort(key=lambda r: r.period_date)

        if months and len(financials) > months:
            financials = financials[-months:]

        mom_series = compute_mom_growth(financials)
        total_rev = round(sum(f.revenue_lakh for f in financials), 2)
        avg_rev = round(total_rev / len(financials), 2) if financials else 0.0

        return {
            "company_id": comp_id,
            "period_months": len(financials),
            "total_period_revenue_lakh": total_rev,
            "avg_monthly_revenue_lakh": avg_rev,
            "series": [
                {
                    "month": m["period"],
                    "revenue_lakh": m["revenue_lakh"],
                    "units_sold": m["units_sold"],
                    "growth_pct": m["revenue_growth_pct"],
                    "change_lakh": m["revenue_change_lakh"]
                }
                for m in mom_series
            ]
        }

    def get_profit_trend(self, company_id: Optional[str] = None, months: int = 6) -> Dict[str, Any]:
        """
        Retrieves chronological profit and margin trends.
        """
        comp_id = self._resolve_company_scope(company_id)
        financials = self.repository.get_monthly_financials([comp_id])
        financials.sort(key=lambda r: r.period_date)

        if months and len(financials) > months:
            financials = financials[-months:]

        mom_series = compute_mom_growth(financials)
        total_profit = round(sum(f.gross_profit_lakh for f in financials), 2)
        total_rev = round(sum(f.revenue_lakh for f in financials), 2)
        avg_margin = round((total_profit / total_rev * 100.0), 2) if total_rev > 0 else 0.0

        return {
            "company_id": comp_id,
            "period_months": len(financials),
            "total_period_gross_profit_lakh": total_profit,
            "avg_margin_pct": avg_margin,
            "series": [
                {
                    "month": m["period"],
                    "gross_profit_lakh": m["gross_profit_lakh"],
                    "profit_margin_pct": m["profit_margin_pct"],
                    "profit_growth_pct": m["profit_growth_pct"]
                }
                for m in mom_series
            ]
        }

    def get_product_metrics(
        self,
        company_id: Optional[str] = None,
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves category/product breakdowns.
        """
        comp_id = self._resolve_company_scope(company_id)
        products = self.repository.get_product_metrics([comp_id], year=year, month=month)
        return [
            {
                "id": p.id,
                "company_id": p.company_id,
                "category_name": p.category_name,
                "year": p.year,
                "month": p.month,
                "sales_volume_units": p.sales_volume_units,
                "unit_of_measure": p.unit_of_measure,
                "revenue_lakh": p.revenue_lakh,
                "profit_margin_pct": p.profit_margin_pct,
                "top_customer_segment": p.top_customer_segment
            }
            for p in products
        ]

    def get_top_products(self, company_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top revenue-generating categories.
        """
        comp_id = self._resolve_company_scope(company_id)
        products = self.repository.get_product_metrics([comp_id])
        
        # Aggregate by category across all recorded periods
        category_map: Dict[str, Dict[str, Any]] = {}
        for p in products:
            if p.category_name not in category_map:
                category_map[p.category_name] = {
                    "category_name": p.category_name,
                    "total_revenue_lakh": 0.0,
                    "total_volume_units": 0,
                    "unit_of_measure": p.unit_of_measure,
                    "top_customer_segment": p.top_customer_segment,
                    "margins": []
                }
            category_map[p.category_name]["total_revenue_lakh"] += p.revenue_lakh
            category_map[p.category_name]["total_volume_units"] += p.sales_volume_units
            category_map[p.category_name]["margins"].append(p.profit_margin_pct)

        ranked = []
        for cat, data in category_map.items():
            avg_m = round(sum(data["margins"]) / len(data["margins"]), 2) if data["margins"] else 0.0
            ranked.append({
                "category_name": cat,
                "total_revenue_lakh": round(data["total_revenue_lakh"], 2),
                "total_volume_units": data["total_volume_units"],
                "unit_of_measure": data["unit_of_measure"],
                "avg_margin_pct": avg_m,
                "top_customer_segment": data["top_customer_segment"]
            })

        ranked.sort(key=lambda x: x["total_revenue_lakh"], reverse=True)
        return ranked[:limit]

    def get_company_comparison(
        self,
        company_ids: List[str],
        period_months: int = 6
    ) -> Dict[str, Any]:
        """
        ADMIN ONLY: Compares 2 or more companies side-by-side.
        Rejects OWNER role immediately.
        """
        if not self.user.is_admin():
            raise ForbiddenError("Cross-company comparison is restricted to Global Administrators.")

        if not company_ids:
            raise BadRequestError("Please specify at least 2 company IDs to compare.")

        # Check that all requested company IDs exist
        companies = [self.repository.get_company_by_id(cid) for cid in company_ids]
        valid_companies = [c for c in companies if c is not None]
        if len(valid_companies) < len(company_ids):
            missing = set(company_ids) - {c.id for c in valid_companies}
            raise NotFoundError(f"Companies not found: {missing}")

        all_fin = self.repository.get_monthly_financials(authorized_company_ids=company_ids)
        fin_map: Dict[str, List] = {cid: [] for cid in company_ids}
        for f in all_fin:
            if f.company_id in fin_map:
                fin_map[f.company_id].append(f)
        for cid in fin_map:
            fin_map[cid].sort(key=lambda r: r.period_date)

        return compare_multiple_companies(valid_companies, fin_map, period_months=period_months)

    def get_global_summary(self, period_months: int = 6) -> Dict[str, Any]:
        """
        ADMIN ONLY: Aggregates portfolio metrics across all 10 companies.
        Rejects OWNER role immediately.
        """
        if not self.user.is_admin():
            raise ForbiddenError("Global portfolio analytics is restricted to Global Administrators.")

        companies = self.repository.get_companies()
        comp_ids = [c.id for c in companies]
        all_fin = self.repository.get_monthly_financials(authorized_company_ids=comp_ids)
        
        fin_map: Dict[str, List] = {cid: [] for cid in comp_ids}
        for f in all_fin:
            if f.company_id in fin_map:
                fin_map[f.company_id].append(f)
        for cid in fin_map:
            fin_map[cid].sort(key=lambda r: r.period_date)

        return compare_multiple_companies(companies, fin_map, period_months=period_months)

    def get_uploaded_datasets_info(self, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves information on uploaded datasets, file formats, record counts,
        date ranges, and status for the authorized company scope.
        """
        comp_id = self._resolve_company_scope(company_id)
        datasets = self.repository.get_datasets_by_company(comp_id)
        financials = self.repository.get_monthly_financials([comp_id])
        
        if not datasets and not financials:
            return {
                "company_id": comp_id,
                "dataset_count": 0,
                "total_records": 0,
                "date_range": "No data found",
                "datasets": []
            }

        ds_list = [
            {
                "id": d.id,
                "name": d.dataset_name,
                "filename": d.original_filename,
                "file_format": d.file_format,
                "record_count": d.record_count,
                "status": d.status,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "date_range_start": d.date_range_start.isoformat() if d.date_range_start else None,
                "date_range_end": d.date_range_end.isoformat() if d.date_range_end else None
            }
            for d in datasets
        ]

        # Determine overall ledger period
        dates = [f.period_date for f in financials]
        min_date = min(dates).strftime("%b %Y") if dates else "N/A"
        max_date = max(dates).strftime("%b %Y") if dates else "N/A"

        return {
            "company_id": comp_id,
            "dataset_count": len(datasets),
            "total_records": sum(d.record_count for d in datasets) or len(financials),
            "historical_ledger_months": len(financials),
            "date_range": f"{min_date} to {max_date}",
            "latest_month": max_date,
            "earliest_month": min_date,
            "datasets": ds_list
        }

