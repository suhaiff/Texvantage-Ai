import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date

class ValidationResult:
    def __init__(self, is_valid: bool, errors: List[str], warnings: List[str], validated_rows: List[Dict[str, Any]]):
        self.is_valid = is_valid
        self.errors = errors
        self.warnings = warnings
        self.validated_rows = validated_rows

def parse_number_value(val: Any) -> Optional[float]:
    """Extract clean float from various number/currency representations."""
    if val is None:
        return None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return float(val)

    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "nan", "na", "n/a", "-"):
        return None

    # Handle Indian Lakhs/Crores notation if appended
    multiplier = 1.0
    if re.search(r"crores?|cr\.?$", s, re.IGNORECASE):
        multiplier = 100.0 # 1 Cr = 100 Lakhs
        s = re.sub(r"crores?|cr\.?$", "", s, flags=re.IGNORECASE)
    elif re.search(r"lakhs?|lac|l\.?$", s, re.IGNORECASE):
        multiplier = 1.0 # Lakhs is our base unit for revenue/profit
        s = re.sub(r"lakhs?|lac|l\.?$", "", s, flags=re.IGNORECASE)
    elif re.search(r"k$", s, re.IGNORECASE):
        multiplier = 0.01 # 1k = 0.01 Lakh
        s = re.sub(r"k$", "", s, flags=re.IGNORECASE)
    elif re.search(r"m$", s, re.IGNORECASE):
        multiplier = 10.0 # 1M = 10 Lakhs
        s = re.sub(r"m$", "", s, flags=re.IGNORECASE)

    # Clean currency symbols and commas
    cleaned = re.sub(r"[\$₹£€,\s]", "", s)
    try:
        val_float = float(cleaned) * multiplier
        return val_float
    except ValueError:
        return None

def parse_date_value(val: Any) -> Optional[Tuple[int, int, date, str]]:
    """
    Parse a date/period string into (year, month, period_date, month_name).
    e.g. "2026-08-01", "Aug 2026", "2026-08", "08/15/2026"
    """
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        y = val.year
        m = val.month
        p_date = date(y, m, 1)
        m_name = p_date.strftime("%b %Y")
        return (y, m, p_date, m_name)

    s = str(val).strip()
    if not s:
        return None

    formats = [
        ("%Y-%m-%d", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%d-%m-%Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%m/%d/%Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%d/%m/%Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%Y/%m/%d", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%Y-%m", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%m-%Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%b %Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%B %Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%b-%y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%b-%Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%d %b %Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
        ("%d %B %Y", lambda dt: (dt.year, dt.month, date(dt.year, dt.month, 1), dt.strftime("%b %Y"))),
    ]

    for fmt, extractor in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return extractor(dt)
        except ValueError:
            pass

    return None

class IngestionValidator:
    """Validates raw dataset rows according to column mappings."""

    def validate(self, rows: List[Dict[str, Any]], mapping: Dict[str, str]) -> ValidationResult:
        errors: List[str] = []
        warnings: List[str] = []
        validated_rows: List[Dict[str, Any]] = []

        # Invert mapping to find source column for each target field
        # mapping: { "Source Column": "target_field" }
        target_to_source = {v: k for k, v in mapping.items() if v}

        if "date" not in target_to_source:
            errors.append("Validation failed: A 'date' or 'period' column mapping is mandatory.")

        if "revenue" not in target_to_source and "sales" not in target_to_source:
            errors.append("Validation failed: A 'revenue' or 'sales' column mapping is mandatory.")

        if errors:
            return ValidationResult(is_valid=False, errors=errors, warnings=warnings, validated_rows=[])

        date_col = target_to_source.get("date")
        revenue_col = target_to_source.get("revenue") or target_to_source.get("sales")
        cogs_col = target_to_source.get("cogs")
        profit_col = target_to_source.get("gross_profit") or target_to_source.get("profit")
        units_col = target_to_source.get("units_sold") or target_to_source.get("units")
        category_col = target_to_source.get("category_name") or target_to_source.get("product")
        segment_col = target_to_source.get("customer_segment")

        invalid_dates_count = 0
        invalid_rev_count = 0

        for row_idx, r in enumerate(rows):
            # Validate Date
            raw_date = r.get(date_col)
            parsed_date_tuple = parse_date_value(raw_date)
            if not parsed_date_tuple:
                invalid_dates_count += 1
                if invalid_dates_count <= 3:
                    warnings.append(f"Row {row_idx + 1}: Unrecognized date value '{raw_date}' in column '{date_col}'.")
                continue

            # Validate Revenue
            raw_rev = r.get(revenue_col)
            parsed_rev = parse_number_value(raw_rev)
            if parsed_rev is None or parsed_rev < 0:
                invalid_rev_count += 1
                if invalid_rev_count <= 3:
                    warnings.append(f"Row {row_idx + 1}: Invalid revenue numeric value '{raw_rev}' in column '{revenue_col}'.")
                continue

            # Parse optional fields
            parsed_cogs = parse_number_value(r.get(cogs_col)) if cogs_col else None
            parsed_profit = parse_number_value(r.get(profit_col)) if profit_col else None
            parsed_units = parse_number_value(r.get(units_col)) if units_col else None
            category_val = str(r.get(category_col)).strip() if category_col and r.get(category_col) else "Textile Core Line"
            segment_val = str(r.get(segment_col)).strip() if segment_col and r.get(segment_col) else "Domestic & Export"

            validated_rows.append({
                "year": parsed_date_tuple[0],
                "month": parsed_date_tuple[1],
                "period_date": parsed_date_tuple[2],
                "month_name": parsed_date_tuple[3],
                "revenue_lakh": parsed_rev,
                "cogs_lakh": parsed_cogs,
                "gross_profit_lakh": parsed_profit,
                "units_sold": int(parsed_units) if parsed_units is not None else None,
                "category_name": category_val,
                "customer_segment": segment_val,
                "raw_row": r
            })

        if invalid_dates_count > 3:
            warnings.append(f"{invalid_dates_count} rows had invalid or missing date values and were skipped.")
        if invalid_rev_count > 3:
            warnings.append(f"{invalid_rev_count} rows had invalid or non-numeric revenue values and were skipped.")

        if not validated_rows:
            errors.append("Validation failed: No valid business rows could be extracted with the selected column mapping.")
            return ValidationResult(is_valid=False, errors=errors, warnings=warnings, validated_rows=[])

        return ValidationResult(is_valid=True, errors=[], warnings=warnings, validated_rows=validated_rows)
