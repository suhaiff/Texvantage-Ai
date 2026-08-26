from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class DatasetColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    column_name: str
    data_type: str
    suggested_field: Optional[str] = None
    sample_value: Optional[str] = None

class DetectedColumn(BaseModel):
    name: str
    detected_type: str # "string", "number", "date", "currency"
    suggested_field: Optional[str] = None # "date", "revenue", "cogs", "profit", "units_sold", "category"
    sample_values: List[Any] = []

class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    company_name: Optional[str] = None
    uploaded_by: Optional[str] = None
    filename: str
    original_filename: str
    dataset_name: str
    file_format: str
    file_type: Optional[str] = None
    record_count: int
    file_size: int = 0
    file_size_bytes: int = 0
    status: str # "UPLOADED", "PROCESSING", "COMPLETED", "FAILED"
    description: Optional[str] = None
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    columns: List[DatasetColumnResponse] = []

class DatasetPreviewResponse(BaseModel):
    dataset_id: str
    filename: str
    file_format: str
    total_rows: int
    columns: List[DetectedColumn]
    sample_rows: List[Dict[str, Any]]
    detected_mappings: Dict[str, str] = {} # source_column -> target_business_field
    validation_warnings: List[str] = []
    status: str

class ColumnMappingRequest(BaseModel):
    mapping: Dict[str, str] # e.g. { "Sales Amount": "revenue", "Period": "date", "COGS": "cogs" }
    mode: str = Field(default="APPEND", description="APPEND or REPLACE") # APPEND, REPLACE

class IngestionResultResponse(BaseModel):
    dataset_id: str
    status: str
    records_imported: int
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    financial_records_created: int
    product_metrics_created: int
    message: str
