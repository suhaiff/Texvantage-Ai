import os
from typing import Tuple
from .base import BaseParser, ParsedData
from .csv_parser import CSVParser
from .excel_parser import ExcelParser
from .json_parser import JSONParser
from .validator import IngestionValidator, ValidationResult
from .normalizer import IngestionNormalizer

def get_parser_for_file(filename: str) -> BaseParser:
    """Return appropriate parser based on file extension."""
    ext = os.path.splitext(filename)[1].lower()
    if ext in (".xlsx", ".xls"):
        return ExcelParser()
    elif ext in (".csv", ".tsv", ".txt"):
        return CSVParser()
    elif ext in (".json",):
        return JSONParser()
    else:
        raise ValueError(f"Unsupported file format '{ext}'. Supported formats: .xlsx, .xls, .csv, .json")

__all__ = [
    "BaseParser",
    "ParsedData",
    "CSVParser",
    "ExcelParser",
    "JSONParser",
    "IngestionValidator",
    "ValidationResult",
    "IngestionNormalizer",
    "get_parser_for_file"
]
