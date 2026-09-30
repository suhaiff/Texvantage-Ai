"""
TexVantage AI — SQL Server ERP Data Seeder
==========================================
Seeds the texvantage SQL Server database with the 10 mock Indian textile mill companies,
12 months of monthly_financials (120 rows), and 60 months × 10 categories of product_metrics (600 rows).

This restores the original ERP dataset:
  companies        : 10 rows (C001–C010)
  monthly_financials: 120 rows (12 months × 10 companies)
  product_metrics  : 600 rows (60 months × 10 companies, 5 categories each)

Run from the project root or scripts/ directory:
  python scripts/seed_mssql_erp_data.py

Requires ODBC Driver 18 for SQL Server and pyodbc.
Uses Windows Authentication (Trusted Connection) by default.
Set DATABASE_URL environment variable to override the connection string.
"""

import os
import sys
import math
from datetime import date, datetime, timezone
from pathlib import Path

# ── Add backend to path ─────────────────────────────────────────────────────
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.company import Company
from app.models.user import User
from app.models.financials import MonthlyFinancials
from app.models.product import ProductMetric
from app.models.dataset import Dataset, DatasetColumn
from app.core.security import get_password_hash

# ── Connection ───────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://@localhost/texvantage"
    "?driver=ODBC+Driver+18+for+SQL+Server"
    "&Trusted_Connection=yes"
    "&TrustServerCertificate=yes"
)

# ── Company Master Data ───────────────────────────────────────────────────────
COMPANIES = [
    {
        "id": "C001", "name": "Bangalore Textile Mills", "code": "BTM",
        "specialization": "Cotton Yarn & Woven Fabric",
        "city": "Bangalore", "state": "Karnataka", "founded_year": 1985,
        "annual_capacity_description": "18,000 MT Combed Cotton Yarn / Year",
        "revenue_base": 1350.0, "margin_base": 14.0, "growth_factor": 1.015,
        "vol_base": 280000,
        "categories": [
            ("Combed Cotton 40s", 0.35, "kg", 15.0, "Export Garment Brands"),
            ("Carded Cotton 30s", 0.25, "kg", 13.0, "Domestic Weavers"),
            ("Poly-Cotton Blend", 0.20, "kg", 12.5, "Uniform Manufacturers"),
            ("Grey Woven Fabric", 0.12, "meters", 11.5, "Domestic Dye Houses"),
            ("Yarn-Dyed Checks", 0.08, "meters", 16.5, "Retail Shirting Brands"),
        ],
    },
    {
        "id": "C002", "name": "Vardhman Spinning Mills", "code": "VSM",
        "specialization": "Acrylic & Blended Yarn",
        "city": "Ludhiana", "state": "Punjab", "founded_year": 1992,
        "annual_capacity_description": "12,000 MT Acrylic Blended Yarn / Year",
        "revenue_base": 1180.0, "margin_base": 12.5, "growth_factor": 1.01,
        "vol_base": 220000,
        "categories": [
            ("Acrylic Bright Yarn", 0.40, "kg", 12.0, "Knitwear Manufacturers"),
            ("Wool-Acrylic Blend", 0.30, "kg", 14.5, "Winter Apparel Brands"),
            ("Polypropylene BCF", 0.15, "kg", 10.5, "Carpet Weavers"),
            ("Fancy Tweed Yarn", 0.10, "kg", 18.0, "Boutique Fashion Houses"),
            ("Mélange Cotton-Acrylic", 0.05, "kg", 13.0, "Export Fleece Producers"),
        ],
    },
    {
        "id": "C003", "name": "Mumbai Fabric Works", "code": "MFW",
        "specialization": "Woven Shirting & Suiting Fabric",
        "city": "Mumbai", "state": "Maharashtra", "founded_year": 1978,
        "annual_capacity_description": "40 Million Meters Shirting / Year",
        "revenue_base": 1560.0, "margin_base": 16.0, "growth_factor": 1.02,
        "vol_base": 350000,
        "categories": [
            ("Premium Shirting 60s", 0.38, "meters", 18.0, "Branded Shirt Manufacturers"),
            ("Poly-Viscose Suiting", 0.28, "meters", 14.5, "Tailoring Chains"),
            ("Cotton Poplin Fabric", 0.20, "meters", 15.0, "School Uniform Makers"),
            ("Dobby Weave Shirting", 0.09, "meters", 20.0, "Designer Labels"),
            ("Stretch Twill Fabric", 0.05, "meters", 17.0, "Trousers Manufacturers"),
        ],
    },
    {
        "id": "C004", "name": "Gujarat Cotton Textiles", "code": "GCT",
        "specialization": "Raw Cotton Processing & Ginning",
        "city": "Ahmedabad", "state": "Gujarat", "founded_year": 1995,
        "annual_capacity_description": "30,000 MT Ginned Cotton / Year",
        "revenue_base": 1040.0, "margin_base": 10.5, "growth_factor": 1.005,
        "vol_base": 600000,
        "categories": [
            ("Long Staple Ginned Cotton", 0.45, "kg", 10.0, "Spinning Mills"),
            ("Short Staple Cotton Linters", 0.30, "kg", 8.5, "Non-woven Manufacturers"),
            ("Cottonseed Oil", 0.15, "liters", 12.0, "Edible Oil Processors"),
            ("Cotton Cake Feed", 0.07, "kg", 7.0, "Animal Feed Companies"),
            ("Organic Raw Cotton", 0.03, "kg", 15.0, "Organic Textile Mills"),
        ],
    },
    {
        "id": "C005", "name": "Coimbatore Yarn Industries", "code": "CYI",
        "specialization": "Fine Count Cotton Yarn",
        "city": "Coimbatore", "state": "Tamil Nadu", "founded_year": 2001,
        "annual_capacity_description": "15,000 MT Fine Count Yarn / Year",
        "revenue_base": 1290.0, "margin_base": 15.5, "growth_factor": 1.025,
        "vol_base": 240000,
        "categories": [
            ("60s Combed Cotton Yarn", 0.40, "kg", 17.0, "Hosiery Manufacturers"),
            ("80s Extra Fine Yarn", 0.25, "kg", 22.0, "Luxury Fabric Mills"),
            ("40s Semi-Combed Yarn", 0.20, "kg", 14.0, "Woven Fabric Producers"),
            ("Ring-Spun 100s Yarn", 0.10, "kg", 28.0, "Premium Knitwear Brands"),
            ("Open-End 20s Yarn", 0.05, "kg", 11.0, "Denim Manufacturers"),
        ],
    },
    {
        "id": "C006", "name": "Surat Synthetic Textiles", "code": "SST",
        "specialization": "Polyester & Synthetic Fabric",
        "city": "Surat", "state": "Gujarat", "founded_year": 2003,
        "annual_capacity_description": "60 Million Meters Synthetic Fabric / Year",
        "revenue_base": 1120.0, "margin_base": 11.0, "growth_factor": 1.012,
        "vol_base": 480000,
        "categories": [
            ("Polyester Georgette", 0.35, "meters", 10.5, "Saree & Dress Material Traders"),
            ("Satin Charmeuse Fabric", 0.25, "meters", 13.0, "Bridal Wear Manufacturers"),
            ("Chiffon Crepe Fabric", 0.20, "meters", 11.5, "Ladies Garment Makers"),
            ("Lycra Spandex Blend", 0.12, "meters", 15.0, "Activewear Brands"),
            ("Polyester Interlock Knit", 0.08, "meters", 9.5, "Uniform Manufacturers"),
        ],
    },
    {
        "id": "C007", "name": "Kolkata Jute & Textile Mills", "code": "KJTM",
        "specialization": "Jute Products & Technical Textiles",
        "city": "Kolkata", "state": "West Bengal", "founded_year": 1968,
        "annual_capacity_description": "8,000 MT Jute Products / Year",
        "revenue_base": 680.0, "margin_base": 13.0, "growth_factor": 1.008,
        "vol_base": 120000,
        "categories": [
            ("Jute Hessian Fabric", 0.40, "meters", 12.5, "Packaging Industries"),
            ("Jute Shopping Bags", 0.25, "units", 16.0, "Eco Brand Retailers"),
            ("Jute Carpet Backing", 0.20, "meters", 11.0, "Carpet Manufacturers"),
            ("Jute Twine & Rope", 0.10, "kg", 13.5, "Agricultural Traders"),
            ("Geo-Jute Erosion Control", 0.05, "meters", 18.0, "Infrastructure Projects"),
        ],
    },
    {
        "id": "C008", "name": "Delhi Technical Fabrics", "code": "DTF",
        "specialization": "Technical Textiles & Protective Fabric",
        "city": "Delhi", "state": "Delhi", "founded_year": 2008,
        "annual_capacity_description": "5 Million Meters Technical Textiles / Year",
        "revenue_base": 890.0, "margin_base": 20.0, "growth_factor": 1.03,
        "vol_base": 95000,
        "categories": [
            ("FR Protective Fabric", 0.38, "meters", 22.0, "Defense & Safety Sectors"),
            ("Medical Non-Woven", 0.28, "meters", 25.0, "Healthcare Manufacturers"),
            ("Industrial Filter Fabric", 0.18, "meters", 18.5, "Chemical & Process Plants"),
            ("Aerospace Composite Textile", 0.10, "meters", 30.0, "Aerospace OEMs"),
            ("Ballistic Weave Fabric", 0.06, "meters", 28.0, "Defense Equipment Makers"),
        ],
    },
    {
        "id": "C009", "name": "Tiruppur Garment Textiles", "code": "TGT",
        "specialization": "Knitted Garments & Hosiery Export",
        "city": "Tiruppur", "state": "Tamil Nadu", "founded_year": 1999,
        "annual_capacity_description": "25 Million Garment Pieces / Year",
        "revenue_base": 1450.0, "margin_base": 13.5, "growth_factor": 1.02,
        "vol_base": 520000,
        "categories": [
            ("Plain T-Shirts Export", 0.35, "units", 12.5, "Global Fast Fashion Brands"),
            ("Polo Shirts Export", 0.28, "units", 14.0, "US & EU Retail Chains"),
            ("Fleece Hoodies", 0.18, "units", 13.0, "Sportswear Brands"),
            ("Infant Bodysuits", 0.12, "units", 15.5, "Childrenswear Exporters"),
            ("Athletic Shorts", 0.07, "units", 11.5, "Fitness Apparel Labels"),
        ],
    },
    {
        "id": "C010", "name": "Indore Cotton Processing", "code": "ICP",
        "specialization": "Cotton Seed Delinting & Processing",
        "city": "Indore", "state": "Madhya Pradesh", "founded_year": 2005,
        "annual_capacity_description": "20,000 MT Cotton Processing / Year",
        "revenue_base": 920.0, "margin_base": 11.5, "growth_factor": 1.01,
        "vol_base": 400000,
        "categories": [
            ("Acid Delinted Cotton Seed", 0.40, "kg", 11.0, "Seed Companies"),
            ("Linted Cotton Seed", 0.30, "kg", 9.5, "Oil Mills"),
            ("Cottonseed Oil Refined", 0.15, "liters", 14.0, "FMCG & Edible Oil"),
            ("Cotton Seed Cake", 0.10, "kg", 8.0, "Dairy & Poultry Feed"),
            ("Compost Organic Manure", 0.05, "kg", 12.0, "Agri Input Companies"),
        ],
    },
]

# 12 months of data: Jan 2025 – Dec 2025
MONTHS_SEQUENCE = [
    (2025, 1, "Jan 2025"), (2025, 2, "Feb 2025"), (2025, 3, "Mar 2025"),
    (2025, 4, "Apr 2025"), (2025, 5, "May 2025"), (2025, 6, "Jun 2025"),
    (2025, 7, "Jul 2025"), (2025, 8, "Aug 2025"), (2025, 9, "Sep 2025"),
    (2025, 10, "Oct 2025"), (2025, 11, "Nov 2025"), (2025, 12, "Dec 2025"),
]


def build_entities():
    companies, users, financials, products, datasets = [], [], [], [], []

    admin = User(
        id="user_admin_erp",
        email="admin@texvantage.local",
        password_hash=get_password_hash("Admin@2025"),
        name="Jeevan Admin",
        role="ADMIN",
        company_id=None,
        job_title="Platform Administrator",
    )
    users.append(admin)

    for idx, cd in enumerate(COMPANIES):
        comp = Company(
            id=cd["id"],
            name=cd["name"],
            code=cd["code"],
            specialization=cd["specialization"],
            city=cd["city"],
            state=cd["state"],
            founded_year=cd["founded_year"],
            annual_capacity_description=cd["annual_capacity_description"],
        )
        companies.append(comp)

        owner = User(
            id=f"user_owner_{cd['id'].lower()}",
            email=f"owner.{cd['code'].lower()}@texvantage.local",
            password_hash=get_password_hash("Owner@2025"),
            name=f"Owner of {cd['name']}",
            role="OWNER",
            company_id=cd["id"],
            job_title="Managing Director",
        )
        users.append(owner)

        base_rev = cd["revenue_base"]
        base_margin = cd["margin_base"]
        growth = cd["growth_factor"]
        base_vol = cd["vol_base"]

        for month_idx, (yr, mo, mo_name) in enumerate(MONTHS_SEQUENCE):
            month_mult = growth ** month_idx
            # Realistic seasonality: festive bump Q4, slight dip Jun-Jul
            seasonality = (
                1.05 if mo in (10, 11, 12) else
                0.97 if mo in (6, 7) else
                1.01
            )
            rev = round(base_rev * month_mult * seasonality, 2)
            margin = round(
                base_margin
                + (0.25 * month_idx if growth > 1.0 else -0.35 * month_idx)
                + (0.5 if mo == 12 else 0.0),
                2
            )
            margin = max(6.0, min(40.0, margin))
            cogs = round(rev * (1 - margin / 100.0), 2)
            gross_profit = round(rev - cogs, 2)
            opex = round(rev * 0.055, 2)
            net_profit = round(gross_profit - opex, 2)
            units_sold = int(base_vol * month_mult * seasonality)
            units_produced = int(units_sold * 1.04)
            orders = max(10, int((rev * 100000) / 800000))
            aov = round((rev * 100000) / max(1, orders), 2)
            cap_util = min(96.0, round(70.0 + margin / 2.0 + month_idx * 0.75, 1))

            fin = MonthlyFinancials(
                id=f"fin_{cd['id']}_{yr}_{mo:02d}",
                company_id=cd["id"],
                year=yr,
                month=mo,
                period_date=date(yr, mo, 1),
                month_name=mo_name,
                revenue_lakh=rev,
                cogs_lakh=cogs,
                gross_profit_lakh=gross_profit,
                profit_margin_pct=margin,
                operating_expenses_lakh=opex,
                net_profit_lakh=net_profit,
                units_produced=units_produced,
                units_sold=units_sold,
                orders_count=orders,
                avg_order_value_inr=aov,
                capacity_utilization_pct=cap_util,
                raw_material_cost_lakh=round(cogs * 0.72, 2),
                energy_cost_lakh=round(cogs * 0.18, 2),
            )
            financials.append(fin)

        # Product metrics for all 12 months × 5 categories = 60 per company
        latest_rev_base = base_rev * (growth ** 11) * 1.01  # Dec 2025 approx
        for month_idx, (yr, mo, mo_name) in enumerate(MONTHS_SEQUENCE):
            month_mult = growth ** month_idx
            seasonality = (
                1.05 if mo in (10, 11, 12) else
                0.97 if mo in (6, 7) else
                1.01
            )
            period_rev = base_rev * month_mult * seasonality

            for c_idx, (cat_name, split, uom, cat_margin, cust_seg) in enumerate(cd["categories"]):
                prod_rev = round(period_rev * split, 2)
                prod = ProductMetric(
                    id=f"prod_{cd['id']}_{yr}_{mo:02d}_{c_idx + 1}",
                    company_id=cd["id"],
                    year=yr,
                    month=mo,
                    category_name=cat_name,
                    sales_volume_units=round(base_vol * split * month_mult * seasonality, 1),
                    unit_of_measure=uom,
                    revenue_lakh=prod_rev,
                    profit_margin_pct=cat_margin,
                    top_customer_segment=cust_seg,
                )
                products.append(prod)

        # One Dataset record per company
        dset = Dataset(
            id=f"ds_{cd['id']}_fy25",
            company_id=cd["id"],
            uploaded_by=f"user_owner_{cd['id'].lower()}",
            filename=f"{cd['code']}_FY2025_Master_Ledger.xlsx",
            original_filename=f"{cd['code']}_FY2025_Master_Ledger.xlsx",
            dataset_name="FY 2025 Master Production & Sales Ledger",
            file_format="XLSX",
            file_type="EXCEL",
            file_size=52000,
            file_size_bytes=52000,
            record_count=12,
            status="COMPLETED",
            description="Verified monthly financials and product metrics for FY 2025.",
            date_range_start=date(2025, 1, 1),
            date_range_end=date(2025, 12, 31),
        )
        datasets.append(dset)

    return companies, users, financials, products, datasets


def main():
    print("=" * 65)
    print("  TexVantage AI — SQL Server ERP Data Seeder")
    print("=" * 65)
    print(f"\nConnecting to: {DATABASE_URL[:60]}...")

    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
    Session = sessionmaker(bind=engine)

    # Verify connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("  [OK] Connected to SQL Server successfully.")
    except Exception as exc:
        print(f"\n  [ERROR] Cannot connect to SQL Server:\n  {exc}")
        sys.exit(1)

    print("\nBuilding seed entities...")
    companies, users, financials, products, datasets = build_entities()
    print(f"  Companies   : {len(companies)}")
    print(f"  Users       : {len(users)}")
    print(f"  Financials  : {len(financials)}")
    print(f"  Products    : {len(products)}")
    print(f"  Datasets    : {len(datasets)}")

    with Session() as session:
        # Check for existing data
        existing = session.scalar(
            __import__("sqlalchemy", fromlist=["select"]).select(
                __import__("sqlalchemy", fromlist=["func"]).func.count(Company.id)
            )
        )
        if existing and existing > 0:
            print(f"\n  Found {existing} existing company rows.")
            resp = input("  Overwrite all data? This will DELETE existing rows first. [y/N]: ").strip().lower()
            if resp != "y":
                print("  Aborted. No changes made.")
                return

            print("\n  Clearing existing data (FK-safe order)...")
            for tbl in [
                "message_artifacts", "artifacts", "messages", "conversations",
                "audit_logs", "dataset_columns", "datasets",
                "product_metrics", "monthly_financials", "users", "companies",
            ]:
                session.execute(text(f"DELETE FROM {tbl}"))
            session.commit()
            print("  [OK] Cleared.")

        print("\nInserting seed data...")
        session.add_all(companies);  session.commit();  print(f"  Companies inserted: {len(companies)}")
        session.add_all(users);      session.commit();  print(f"  Users inserted:     {len(users)}")
        session.add_all(datasets);   session.commit();  print(f"  Datasets inserted:  {len(datasets)}")
        session.add_all(financials); session.commit();  print(f"  Financials inserted:{len(financials)}")
        session.add_all(products);   session.commit();  print(f"  Products inserted:  {len(products)}")

    # Verify
    with Session() as session:
        c_count = session.scalar(
            __import__("sqlalchemy", fromlist=["select"]).select(
                __import__("sqlalchemy", fromlist=["func"]).func.count(Company.id)
            )
        )
        f_count = session.scalar(
            __import__("sqlalchemy", fromlist=["select"]).select(
                __import__("sqlalchemy", fromlist=["func"]).func.count(MonthlyFinancials.id)
            )
        )
        p_count = session.scalar(
            __import__("sqlalchemy", fromlist=["select"]).select(
                __import__("sqlalchemy", fromlist=["func"]).func.count(ProductMetric.id)
            )
        )

    print(f"\n{'=' * 65}")
    print(f"  Verification:")
    print(f"    companies         : {c_count}  (expected: 10)")
    print(f"    monthly_financials: {f_count}  (expected: 120)")
    print(f"    product_metrics   : {p_count}  (expected: 600)")
    print(f"{'=' * 65}")
    if c_count == 10 and f_count == 120 and p_count == 600:
        print("\n  [OK] SQL Server ERP data seeded successfully!")
        print("\n  You can now start the backend:")
        print("    cd backend")
        print("    uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload")
    else:
        print("\n  [WARNING] Row counts do not match expected values!")


if __name__ == "__main__":
    main()
