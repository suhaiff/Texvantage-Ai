from datetime import date
from typing import List, Dict, Any
from ..core.security import get_password_hash
from ..models.company import Company
from ..models.user import User
from ..models.financials import MonthlyFinancials
from ..models.product import ProductMetric
from ..models.dataset import Dataset, DatasetColumn

# Hash once for seed demo accounts
DEMO_ADMIN_PASSWORD_HASH = get_password_hash("admin123")
DEMO_OWNER_PASSWORD_HASH = get_password_hash("owner123")

COMPANIES_DATA = [
    {
        "id": "comp_textile_a",
        "name": "Textile A (Apex Spinners)",
        "code": "TEX-A",
        "specialization": "High-Volume Cotton Yarn & Blended Ring Spun",
        "city": "Coimbatore",
        "state": "Tamil Nadu",
        "founded_year": 1998,
        "annual_capacity_description": "24,000 Metric Tons Combed Cotton / Year",
        "revenue_base": 310.0, # in Lakhs (₹3.10 Cr/mo)
        "margin_base": 15.5,
        "growth_factor": 1.02,
        "vol_base": 420000, # kg
    },
    {
        "id": "comp_textile_b",
        "name": "Textile B (Boutique Silks & Jacquard)",
        "code": "TEX-B",
        "specialization": "Luxury Mulberry Silk & High-End Jacquard Weaves",
        "city": "Surat",
        "state": "Gujarat",
        "founded_year": 2005,
        "annual_capacity_description": "3.5 Million Meters Luxury Jacquard Fabric / Year",
        "revenue_base": 215.0,
        "margin_base": 30.5, # Premium luxury margin
        "growth_factor": 1.03,
        "vol_base": 85000, # meters
    },
    {
        "id": "comp_textile_c",
        "name": "Textile C (Crest Organic Cottons)",
        "code": "TEX-C",
        "specialization": "GOTS-Certified Organic Knits & Sustainable Textiles",
        "city": "Tirupur",
        "state": "Tamil Nadu",
        "founded_year": 2012,
        "annual_capacity_description": "18 Million Knitted Garment Pieces / Year",
        "revenue_base": 180.0,
        "margin_base": 21.0,
        "growth_factor": 1.06, # Fast Growth champion
        "vol_base": 250000,
    },
    {
        "id": "comp_textile_d",
        "name": "Textile D (Delta Synthetic Mills)",
        "code": "TEX-D",
        "specialization": "Polyester Filament & Legacy Suiting Weaves",
        "city": "Bhilwara",
        "state": "Rajasthan",
        "founded_year": 1992,
        "annual_capacity_description": "12,000 Metric Tons Polyester Blends / Year",
        "revenue_base": 195.0,
        "margin_base": 11.0,
        "growth_factor": 0.97, # Declining revenue / margin compression
        "vol_base": 310000,
    },
    {
        "id": "comp_textile_e",
        "name": "Textile E (Empire Denim Fabrics)",
        "code": "TEX-E",
        "specialization": "Heavy Ring-Spun Indigo Denim & Stretch Twill",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "founded_year": 2001,
        "annual_capacity_description": "45 Million Meters Premium Denim / Year",
        "revenue_base": 290.0,
        "margin_base": 13.5,
        "growth_factor": 1.01, # High volume production powerhouse
        "vol_base": 550000,
    },
    {
        "id": "comp_textile_f",
        "name": "Textile F (Frontier Technical Textiles)",
        "code": "TEX-F",
        "specialization": "Medical Non-Wovens, Geotextiles & Fire-Retardant Fabric",
        "city": "Pune",
        "state": "Maharashtra",
        "founded_year": 2016,
        "annual_capacity_description": "8 Million Square Meters Engineered Technical Textiles",
        "revenue_base": 165.0,
        "margin_base": 27.0, # High margin technical niche
        "growth_factor": 1.05,
        "vol_base": 120000,
    },
    {
        "id": "comp_textile_g",
        "name": "Textile G (Grace Home Furnishings)",
        "code": "TEX-G",
        "specialization": "Jacquard Curtains, Terry Towels & Premium Bed Linen",
        "city": "Panipat",
        "state": "Haryana",
        "founded_year": 2008,
        "annual_capacity_description": "15 Million Home Furnishing Units / Year",
        "revenue_base": 240.0,
        "margin_base": 18.0,
        "growth_factor": 1.02, # Steady home export
        "vol_base": 320000,
    },
    {
        "id": "comp_textile_h",
        "name": "Textile H (Heritage Handloom Weavers)",
        "code": "TEX-H",
        "specialization": "Handwoven Banarasi Brocades & Artisan Pashmina",
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "founded_year": 1985,
        "annual_capacity_description": "40,000 Handwoven Heirloom Pieces / Year",
        "revenue_base": 95.0,
        "margin_base": 25.5,
        "growth_factor": 1.015, # Niche artisan heritage
        "vol_base": 15000,
    },
    {
        "id": "comp_textile_i",
        "name": "Textile I (Imperial Woolen Mills)",
        "code": "TEX-I",
        "specialization": "Fine Worsted Merino Wool & Winter Suiting",
        "city": "Ludhiana",
        "state": "Punjab",
        "founded_year": 1996,
        "annual_capacity_description": "6,000 Metric Tons Worsted Spun Wool / Year",
        "revenue_base": 175.0,
        "margin_base": 19.5,
        "growth_factor": 1.02,
        "vol_base": 140000,
    },
    {
        "id": "comp_textile_j",
        "name": "Textile J (Jupiter Garment Exports)",
        "code": "TEX-J",
        "specialization": "Global Fast-Fashion Apparel & High-Speed Sewing Lines",
        "city": "Bengaluru",
        "state": "Karnataka",
        "founded_year": 2010,
        "annual_capacity_description": "30 Million Export Garment Units / Year",
        "revenue_base": 335.0,
        "margin_base": 11.5, # High turnover, thin export margin
        "growth_factor": 1.025,
        "vol_base": 620000,
    }
]

# 12 months: Sep 2025 to Aug 2026
MONTHS_SEQUENCE = [
    (2025, 9, "Sep 2025"),
    (2025, 10, "Oct 2025"),
    (2025, 11, "Nov 2025"),
    (2025, 12, "Dec 2025"),
    (2026, 1, "Jan 2026"),
    (2026, 2, "Feb 2026"),
    (2026, 3, "Mar 2026"),
    (2026, 4, "Apr 2026"),
    (2026, 5, "May 2026"),
    (2026, 6, "Jun 2026"),
    (2026, 7, "Jul 2026"),
    (2026, 8, "Aug 2026"),
]

PRODUCT_CATEGORIES_MAP = {
    "comp_textile_a": [
        ("Combed Cotton 40s Ring Spun", 0.45, "kg", 16.0, "Tier-1 Garment Knitters"),
        ("Carded Cotton 30s Weaving Yarn", 0.35, "kg", 13.5, "Domestic Powerloom Weavers"),
        ("Poly-Cotton 65/35 Blend Yarn", 0.20, "kg", 18.0, "Export Uniform Manufacturers")
    ],
    "comp_textile_b": [
        ("Mulberry Silk Brocade Fabric", 0.50, "meters", 34.0, "Couture Bridal Designers"),
        ("Silk-Zari Jacquard Saree Fabric", 0.30, "meters", 29.0, "National Retail Showroom Chains"),
        ("Organza Silk Dress Material", 0.20, "meters", 26.5, "Export Luxury Boutiques")
    ],
    "comp_textile_c": [
        ("GOTS Certified Organic Single Jersey", 0.55, "kg", 22.5, "European Sustainable Brands"),
        ("Organic Cotton Interlock Knit", 0.25, "kg", 20.0, "Childrenswear Export Brands"),
        ("Recycled Cotton Fleece Fabric", 0.20, "kg", 19.0, "Athleisure Apparel Labels")
    ],
    "comp_textile_d": [
        ("Polyester Texturized Yarn 150D", 0.50, "kg", 8.5, "Mass Market Powerloom Clusters"),
        ("Poly-Viscose Suiting Fabric", 0.30, "meters", 10.0, "Domestic School Uniform Makers"),
        ("Microfiber Synthetic Drapes", 0.20, "meters", 7.0, "Budget Hospitality Suppliers")
    ],
    "comp_textile_e": [
        ("14.5 oz Heavyweight Indigo Denim", 0.40, "meters", 15.0, "Global Jeans Brands"),
        ("11.0 oz Stretch Comfort Denim", 0.40, "meters", 13.5, "Youth Casualwear Labels"),
        ("Bull Denim Dyed Twill", 0.20, "meters", 11.0, "Workwear & Utility Apparel")
    ],
    "comp_textile_f": [
        ("Medical Grade Spunbond Non-Woven", 0.45, "meters", 28.5, "Healthcare & Surgical Equipment"),
        ("Flame Retardant Aramid Weave", 0.30, "meters", 31.0, "Defense & Industrial Safety"),
        ("Polypropylene Geotextile Matting", 0.25, "meters", 22.0, "Highway & Infrastructure Projects")
    ],
    "comp_textile_g": [
        ("Egyptian Cotton 400TC Bed Linen", 0.40, "units", 20.5, "Luxury Hotel Chains & US Retail"),
        ("Zero-Twist Cotton Bath Towels", 0.35, "units", 17.0, "Home Decor Department Stores"),
        ("Woven Jacquard Cushion Covers", 0.25, "units", 16.5, "E-Commerce Home Brands")
    ],
    "comp_textile_h": [
        ("Pure Katan Silk Banarasi Saree", 0.60, "units", 28.0, "Direct Bridal Retailers"),
        ("Handspun Pashmina Shawls", 0.25, "units", 24.5, "Luxury Export Emporiums"),
        ("Zari Brocade Stoles & Dupattas", 0.15, "units", 21.0, "Artisan Boutique Galleries")
    ],
    "comp_textile_i": [
        ("Super 120s Worsted Suiting Wool", 0.50, "meters", 22.0, "Bespoke Tailoring & Suiting Brands"),
        ("Merino Wool Knitwear Yarn", 0.30, "kg", 18.5, "Winterwear Apparel Manufacturers"),
        ("Wool-Cashmere Blend Overcoat Fabric", 0.20, "meters", 17.0, "Premium Outerwear Brands")
    ],
    "comp_textile_j": [
        ("Cotton Pique Polo Shirts", 0.45, "units", 12.0, "US & EU Retail Apparel Chains"),
        ("French Terry Hoodies & Joggers", 0.35, "units", 11.5, "Global Fast Fashion Brands"),
        ("Basic Crewneck T-Shirts", 0.20, "units", 10.0, "High-Volume Private Label Promoters")
    ]
}

def generate_seed_entities():
    """Generates all in-memory seed models for initial database population."""
    companies: List[Company] = []
    users: List[User] = []
    financials: List[MonthlyFinancials] = []
    products: List[ProductMetric] = []
    datasets: List[Dataset] = []

    # 1. Seed Global Administrator
    admin_user = User(
        id="user_admin",
        email="admin@demo.local",
        password_hash=DEMO_ADMIN_PASSWORD_HASH,
        name="Alexander Sterling",
        role="ADMIN",
        company_id=None,
        job_title="Chief Investment & Operations Director"
    )
    users.append(admin_user)

    # 2. Seed Companies, Owners, Financials, and Products
    owner_letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]
    owner_names = [
        "Rajesh V. Singhania", "Pooja B. Mehta", "Karthik Subramanian",
        "Deepak Agarwal", "Suresh R. Patel", "Dr. Ananya Joshi",
        "Vikram Sethi", "Pandit Mukund Sharma", "Harpreet S. Gill", "Sunil K. Gowda"
    ]

    for idx, cdata in enumerate(COMPANIES_DATA):
        comp = Company(
            id=cdata["id"],
            name=cdata["name"],
            code=cdata["code"],
            specialization=cdata["specialization"],
            city=cdata["city"],
            state=cdata["state"],
            founded_year=cdata["founded_year"],
            annual_capacity_description=cdata["annual_capacity_description"]
        )
        companies.append(comp)

        # Seed Owner User
        letter = owner_letters[idx]
        owner_user = User(
            id=f"user_owner_{letter}",
            email=f"owner.{letter}@demo.local",
            password_hash=DEMO_OWNER_PASSWORD_HASH,
            name=owner_names[idx],
            role="OWNER",
            company_id=cdata["id"],
            job_title="Managing Director & Owner"
        )
        users.append(owner_user)

        # Generate 12 Months of realistic financials
        base_rev = cdata["revenue_base"]
        base_margin = cdata["margin_base"]
        growth = cdata["growth_factor"]
        base_vol = cdata["vol_base"]

        for month_idx, (yr, mo, mo_name) in enumerate(MONTHS_SEQUENCE):
            # Apply growth compounding and slight seasonality
            month_multiplier = (growth ** month_idx)
            # Add realistic minor seasonal fluctuations
            seasonality = 1.0 + (0.04 if mo in [10, 11, 12, 3] else -0.02 if mo in [6, 7] else 0.01)
            
            rev = round(base_rev * month_multiplier * seasonality, 2)
            margin = round(base_margin + (0.3 if growth > 1.0 else -0.4) * month_idx + (0.5 if mo == 8 else 0.0), 2)
            margin = max(5.0, min(42.0, margin)) # Clamp to realistic bounds
            
            cogs = round(rev * (1 - (margin / 100.0)), 2)
            gross_profit = round(rev - cogs, 2)
            opex = round(rev * 0.05, 2)
            net_profit = round(gross_profit - opex, 2)
            
            units_sold = int(base_vol * month_multiplier * seasonality)
            units_produced = int(units_sold * 1.04) # slightly higher production to maintain stock
            orders = int(max(15, (rev * 100000) / 750000)) # ~7.5L avg order value
            aov = round((rev * 100000) / max(1, orders), 2)
            
            cap_util = min(98.0, round(72.0 + (margin / 2.0) + (month_idx * 0.8 if growth > 1.0 else -month_idx * 1.1), 1))

            fin = MonthlyFinancials(
                id=f"fin_{cdata['id']}_{yr}_{mo}",
                company_id=cdata["id"],
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
                energy_cost_lakh=round(cogs * 0.18, 2)
            )
            financials.append(fin)

        # Generate Product category performance for latest period (Aug 2026)
        cat_configs = PRODUCT_CATEGORIES_MAP.get(cdata["id"], [])
        latest_rev = financials[-1].revenue_lakh
        for c_idx, (cat_name, split, uom, cat_margin, cust_segment) in enumerate(cat_configs):
            prod_rev = round(latest_rev * split, 2)
            pmetric = ProductMetric(
                id=f"prod_{cdata['id']}_2026_8_{c_idx+1}",
                company_id=cdata["id"],
                category_name=cat_name,
                year=2026,
                month=8,
                sales_volume_units=round(base_vol * split * (growth ** 11), 1),
                unit_of_measure=uom,
                revenue_lakh=prod_rev,
                profit_margin_pct=cat_margin,
                top_customer_segment=cust_segment
            )
            products.append(pmetric)

        # Seed sample baseline uploaded dataset
        dset = Dataset(
            id=f"dataset_{cdata['id']}_fy26",
            company_id=cdata["id"],
            filename=f"{cdata['code']}_FY2025_26_Master_Ledger.xlsx",
            original_filename=f"{cdata['code']}_FY2025_26_Master_Ledger.xlsx",
            dataset_name="FY 2025-2026 Master Production & Sales Ledger",
            file_format="XLSX",
            file_type="EXCEL",
            record_count=12,
            file_size=48200,
            file_size_bytes=48200,
            status="COMPLETED",
            description="Verified monthly sales, COGS, units and category metrics dataset.",
            uploaded_by=f"user_owner_{letter}"
        )
        col1 = DatasetColumn(id=f"col_{dset.id}_1", dataset_id=dset.id, column_name="Period_Month", data_type="date", sample_value="2026-08-01")
        col2 = DatasetColumn(id=f"col_{dset.id}_2", dataset_id=dset.id, column_name="Revenue_Lakh", data_type="currency", sample_value="342.50")
        col3 = DatasetColumn(id=f"col_{dset.id}_3", dataset_id=dset.id, column_name="Gross_Profit_Lakh", data_type="currency", sample_value="53.10")
        col4 = DatasetColumn(id=f"col_{dset.id}_4", dataset_id=dset.id, column_name="Units_Sold", data_type="number", sample_value="480000")
        col5 = DatasetColumn(id=f"col_{dset.id}_5", dataset_id=dset.id, column_name="Profit_Margin_Pct", data_type="number", sample_value="15.5")
        dset.columns = [col1, col2, col3, col4, col5]
        datasets.append(dset)

    return companies, users, financials, products, datasets
