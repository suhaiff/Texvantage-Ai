from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class ColumnInfo(BaseModel):
    name: str
    detected_type: str # "string", "number", "date", "currency"
    suggested_field: Optional[str] = None
    sample_values: List[Any] = []
    null_count: int = 0
    total_count: int = 0

class ParsedData(BaseModel):
    filename: str
    file_format: str # "XLSX", "XLS", "CSV", "JSON"
    columns: List[ColumnInfo]
    headers: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    detected_mappings: Dict[str, str] = {}
    warnings: List[str] = []

class BaseParser(ABC):
    """Abstract parser interface for data files."""

    @abstractmethod
    def parse(self, file_bytes: bytes, filename: str) -> ParsedData:
        """Parse raw file bytes into structured ParsedData."""
        pass
