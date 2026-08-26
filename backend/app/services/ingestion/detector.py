import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date

# Keywords mapping for automated business field suggestion
FIELD_KEYWORDS = {
    "date": [
        "date", "transaction_date", "period", "period_date", "month", "month_name",
        "month_year", "invoice_date", "billing_period", "year_month", "timestamp"
    ],
    "revenue": [
        "revenue", "sales", "sales_revenue", "turnover", "total_sales",
        "revenue_lakh", "sales_amount", "gross_revenue", "billing", "invoiced_amount",
        "sales_inr", "income"
    ],
    "cogs": [
        "cogs", "cost_of_goods_sold", "cost", "cost_of_sales", "production_cost",
        "direct_cost", "manufacturing_cost", "cogs_lakh", "raw_material_cost"
    ],
    "gross_profit": [
        "gross_profit", "profit", "gross_margin", "gp", "gp_lakh", "profit_lakh",
        "gross_profit_lakh", "operating_profit"
    ],
    "net_profit": [
        "net_profit", "net_margin", "pat", "profit_after_tax", "bottom_line",
        "net_income", "net_profit_lakh"
    ],
    "units_sold": [
        "units_sold", "units", "quantity", "qty", "volume", "sales_volume",
        "quantity_sold", "meters_sold", "kg_sold", "volume_units", "sales_qty"
    ],
    "units_produced": [
        "units_produced", "production", "produced", "output", "production_volume",
        "production_qty", "manufactured_units"
    ],
    "category_name": [
        "category", "category_name", "product", "product_name", "product_category",
        "fabric_type", "yarn_type", "item_name", "sku", "product_line"
    ],
    "customer_segment": [
        "customer", "customer_segment", "target_market", "buyer_type", "segment",
        "market", "client_type", "sales_channel"
    ]
}

def detect_column_type(values: List[Any]) -> str:
    """Infer dominant data type across sample values."""
    non_null_values = [v for v in values if v is not None and str(v).strip() != ""]
    if not non_null_values:
        return "string"

    number_count = 0
    date_count = 0
    currency_count = 0

    for val in non_null_values[:50]: # Sample up to 50 items
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            number_count += 1
            continue

        s = str(val).strip()
        
        # Check currency pattern (e.g. ₹ 100, $500, Rs. 50,000, 15.5L)
        if re.match(r"^[\$₹£€]|(?:Rs\.?|INR)\s*[\d,.]+|[\d,.]+\s*(?:Lakhs?|Cr|L)$", s, re.IGNORECASE):
            currency_count += 1
            continue

        # Check numeric string (e.g. "123.45", "-50", "1,200")
        clean_num = s.replace(",", "").replace("%", "")
        try:
            float(clean_num)
            number_count += 1
            continue
        except ValueError:
            pass

        # Check date string
        if is_date_string(s):
            date_count += 1
            continue

    total = len(non_null_values[:50])
    if currency_count / total >= 0.5:
        return "currency"
    if number_count / total >= 0.6:
        return "number"
    if date_count / total >= 0.5:
        return "date"

    return "string"

def is_date_string(val: str) -> bool:
    """Check if a string represents a known date/month format."""
    if not isinstance(val, str):
        return False
    
    val = val.strip()
    date_formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d",
        "%b %Y", "%B %Y", "%Y-%m", "%m-%Y", "%b-%y", "%b-%Y",
        "%d %b %Y", "%d %B %Y", "%Y%m%d"
    ]
    for fmt in date_formats:
        try:
            datetime.strptime(val, fmt)
            return True
        except ValueError:
            pass
    return False

def suggest_business_field(column_name: str, detected_type: str) -> Optional[str]:
    """Match column name against recognized business fields."""
    normalized_name = re.sub(r"[^a-zA-Z0-9]", "_", column_name.lower()).strip("_")
    
    # Direct match first
    for field, keywords in FIELD_KEYWORDS.items():
        if normalized_name in keywords:
            return field

    # Substring / word boundary match
    tokens = normalized_name.split("_")
    for field, keywords in FIELD_KEYWORDS.items():
        for keyword in keywords:
            if keyword in normalized_name or any(t == keyword for t in tokens):
                # Type sanity check
                if field == "date" and detected_type in ("date", "string"):
                    return field
                elif field in ("revenue", "cogs", "gross_profit", "net_profit", "units_sold", "units_produced") and detected_type in ("number", "currency", "string"):
                    return field
                elif field in ("category_name", "customer_segment") and detected_type == "string":
                    return field

    return None
