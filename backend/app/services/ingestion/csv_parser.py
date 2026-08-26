import csv
import io
from typing import List, Dict, Any
from .base import BaseParser, ParsedData, ColumnInfo
from .detector import detect_column_type, suggest_business_field

class CSVParser(BaseParser):
    """Parser for comma-separated, tab-separated, and semicolon-separated CSV files."""

    def parse(self, file_bytes: bytes, filename: str) -> ParsedData:
        # Decode bytes into text with fallback
        text_content = ""
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                text_content = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue

        if not text_content:
            raise ValueError(f"Unable to decode CSV file '{filename}'. Please ensure valid UTF-8 or text encoding.")

        # Detect delimiter
        sample_snippet = text_content[:4096]
        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(sample_snippet, delimiters=[",", "\t", ";", "|"])
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","

        reader = csv.reader(io.StringIO(text_content), delimiter=delimiter)
        raw_rows = [r for r in reader if any(cell.strip() for cell in r)]

        if not raw_rows:
            raise ValueError("CSV file is empty or contains only blank rows.")

        headers = [str(h).strip() for h in raw_rows[0]]
        # Handle duplicate or empty header names
        cleaned_headers: List[str] = []
        seen_headers = set()
        for idx, h in enumerate(headers):
            name = h if h else f"Column_{idx+1}"
            orig_name = name
            c = 1
            while name in seen_headers:
                name = f"{orig_name}_{c}"
                c += 1
            seen_headers.add(name)
            cleaned_headers.append(name)

        data_rows = raw_rows[1:]
        dict_rows: List[Dict[str, Any]] = []
        for row in data_rows:
            row_dict = {}
            for col_idx, col_name in enumerate(cleaned_headers):
                val = row[col_idx].strip() if col_idx < len(row) else ""
                row_dict[col_name] = val
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
            warnings.append("Dataset has headers but 0 data rows.")
        if "revenue" not in detected_mappings.values() and "sales" not in str(cleaned_headers).lower():
            warnings.append("No revenue or sales column was automatically detected. Please map it manually.")
        if "date" not in detected_mappings.values() and "month" not in str(cleaned_headers).lower():
            warnings.append("No date or period column was automatically detected. Please map it manually.")

        return ParsedData(
            filename=filename,
            file_format="CSV",
            columns=columns_info,
            headers=cleaned_headers,
            rows=dict_rows,
            total_rows=len(dict_rows),
            detected_mappings=detected_mappings,
            warnings=warnings
        )
