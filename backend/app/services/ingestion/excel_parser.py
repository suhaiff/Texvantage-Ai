import io
from typing import List, Dict, Any
from datetime import datetime, date
import openpyxl
from .base import BaseParser, ParsedData, ColumnInfo
from .detector import detect_column_type, suggest_business_field

class ExcelParser(BaseParser):
    """Parser for Microsoft Excel (.xlsx, .xls) files using openpyxl."""

    def parse(self, file_bytes: bytes, filename: str) -> ParsedData:
        try:
            workbook = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
        except Exception as e:
            raise ValueError(f"Failed to read Excel file '{filename}': {str(e)}")

        sheet_names = workbook.sheetnames
        if not sheet_names:
            raise ValueError("Excel file contains no worksheets.")

        # Read the active sheet
        sheet = workbook.active
        all_rows = list(sheet.iter_rows(values_only=True))
        
        # Filter completely empty rows
        raw_rows = [r for r in all_rows if any(cell is not None and str(cell).strip() != "" for cell in r)]

        if not raw_rows:
            raise ValueError(f"Excel sheet '{sheet.title}' is empty.")

        # First row is headers
        header_row = raw_rows[0]
        cleaned_headers: List[str] = []
        seen_headers = set()
        for idx, h in enumerate(header_row):
            h_str = str(h).strip() if h is not None else f"Column_{idx+1}"
            if not h_str:
                h_str = f"Column_{idx+1}"
            orig = h_str
            c = 1
            while h_str in seen_headers:
                h_str = f"{orig}_{c}"
                c += 1
            seen_headers.add(h_str)
            cleaned_headers.append(h_str)

        # Parse data rows
        data_rows = raw_rows[1:]
        dict_rows: List[Dict[str, Any]] = []
        for r in data_rows:
            row_dict = {}
            for idx, col_name in enumerate(cleaned_headers):
                cell_val = r[idx] if idx < len(r) else None
                # Format dates / numbers if openpyxl parsed them to datetime/date
                if isinstance(cell_val, (datetime, date)):
                    cell_val = cell_val.strftime("%Y-%m-%d")
                elif cell_val is not None:
                    cell_val = str(cell_val).strip()
                else:
                    cell_val = ""
                row_dict[col_name] = cell_val
            dict_rows.append(row_dict)

        # Analyze columns
        columns_info: List[ColumnInfo] = []
        detected_mappings: Dict[str, str] = {}

        for col_name in cleaned_headers:
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
        if len(dict_rows) == 0:
            warnings.append(f"Worksheet '{sheet.title}' has headers but 0 data rows.")
        if len(sheet_names) > 1:
            warnings.append(f"Workbook has multiple sheets ({', '.join(sheet_names)}). Parsed active sheet '{sheet.title}'.")
        if "revenue" not in detected_mappings.values():
            warnings.append("No revenue or sales column was automatically detected. Please confirm mapping.")
        if "date" not in detected_mappings.values():
            warnings.append("No date or period column was automatically detected. Please confirm mapping.")

        file_fmt = "XLSX" if filename.lower().endswith(".xlsx") else "XLS"

        return ParsedData(
            filename=filename,
            file_format=file_fmt,
            columns=columns_info,
            headers=cleaned_headers,
            rows=dict_rows,
            total_rows=len(dict_rows),
            detected_mappings=detected_mappings,
            warnings=warnings
        )
