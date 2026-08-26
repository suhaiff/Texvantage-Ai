import json
from typing import List, Dict, Any
from .base import BaseParser, ParsedData, ColumnInfo
from .detector import detect_column_type, suggest_business_field

class JSONParser(BaseParser):
    """Parser for JSON datasets."""

    def parse(self, file_bytes: bytes, filename: str) -> ParsedData:
        try:
            content_str = file_bytes.decode("utf-8")
            data = json.loads(content_str)
        except Exception as e:
            raise ValueError(f"Invalid JSON format in file '{filename}': {str(e)}")

        records: List[Dict[str, Any]] = []

        if isinstance(data, list):
            # Must be a list of objects
            for item in data:
                if isinstance(item, dict):
                    records.append(item)
                else:
                    raise ValueError("JSON array items must be objects / key-value dictionaries.")
        elif isinstance(data, dict):
            # Check for known wrapper keys
            found_list = None
            for key in ["data", "records", "rows", "items", "financials", "monthly_data", "sales"]:
                if key in data and isinstance(data[key], list):
                    found_list = data[key]
                    break
            if found_list is not None:
                for item in found_list:
                    if isinstance(item, dict):
                        records.append(item)
            else:
                # Single record dict or dictionary of records
                if all(isinstance(v, dict) for v in data.values()):
                    records = list(data.values())
                else:
                    records = [data]
        else:
            raise ValueError("Root JSON element must be an array of objects or an object containing an array.")

        if not records:
            raise ValueError(f"JSON file '{filename}' contains 0 records.")

        # Collect all unique keys across all records
        all_keys = []
        seen = set()
        for r in records:
            for k in r.keys():
                k_str = str(k).strip()
                if k_str not in seen:
                    seen.add(k_str)
                    all_keys.append(k_str)

        # Standardize dict rows
        dict_rows: List[Dict[str, Any]] = []
        for r in records:
            row_dict = {}
            for k in all_keys:
                val = r.get(k)
                if val is not None and not isinstance(val, (dict, list)):
                    row_dict[k] = str(val).strip()
                elif val is not None:
                    row_dict[k] = json.dumps(val)
                else:
                    row_dict[k] = ""
            dict_rows.append(row_dict)

        # Analyze columns
        columns_info: List[ColumnInfo] = []
        detected_mappings: Dict[str, str] = {}

        for col_name in all_keys:
            col_values = [r.get(col_name) for r in dict_rows]
            detected_type = detect_column_type(col_values)
            suggested_field = suggest_business_field(col_name, detected_type)

            sample_vals = [v for v in col_values if v is not None and str(v).strip() != ""][:5]
            null_count = sum(1 for v in col_values if v is None or str(v).strip() == "")

            col_info = ColumnInfo(
                name=col_name,
                detected_type=detected_type,
                suggested_field=suggested_field,
                sample_values=sample_vals,
                null_count=null_count,
                total_count=len(dict_rows)
            )
            columns_info.append(col_info)
            if suggested_field:
                detected_mappings[col_name] = suggested_field

        warnings: List[str] = []
        if "revenue" not in detected_mappings.values():
            warnings.append("No revenue or sales key was automatically detected. Please confirm mapping.")
        if "date" not in detected_mappings.values():
            warnings.append("No date or period key was automatically detected. Please confirm mapping.")

        return ParsedData(
            filename=filename,
            file_format="JSON",
            columns=columns_info,
            headers=all_keys,
            rows=dict_rows,
            total_rows=len(dict_rows),
            detected_mappings=detected_mappings,
            warnings=warnings
        )
