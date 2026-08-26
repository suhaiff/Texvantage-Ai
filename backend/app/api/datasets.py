import os
import uuid
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, Request

from ..core.dependencies import get_current_user, TenantGuard
from ..core.exceptions import BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError
from ..models.user import User
from ..models.dataset import Dataset, DatasetColumn
from ..models.audit import AuditLog
from ..schemas.dataset import (
    DatasetResponse,
    DatasetPreviewResponse,
    DetectedColumn,
    ColumnMappingRequest,
    IngestionResultResponse
)
from ..repositories.dev_repo import repo
from ..services.ingestion import (
    get_parser_for_file,
    IngestionValidator,
    IngestionNormalizer
)

router = APIRouter(prefix="/datasets", tags=["Datasets"])

UPLOAD_STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../storage/uploads"))
os.makedirs(UPLOAD_STORAGE_DIR, exist_ok=True)

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 # 25 MB
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".json"}

@router.post("/upload", response_model=DatasetPreviewResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    company_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and parse an enterprise dataset (Excel, CSV, JSON).
    Strictly scoped to authorized company via TenantGuard.
    """
    # 1. Determine Target Company via TenantGuard
    if current_user.role == "OWNER":
        if not current_user.company_id:
            raise ForbiddenError("User is not assigned to a company.")
        target_company_id = current_user.company_id
    else: # ADMIN
        target_company_id = company_id or (current_user.company_id or "comp_textile_a")
        # Validate target company exists
        target_company = repo.get_company_by_id(target_company_id)
        if not target_company:
            raise NotFoundError(f"Target company '{target_company_id}' not found.")

    # 2. Validate File Name & Extension
    original_filename = file.filename or "uploaded_dataset"
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestError(
            f"Unsupported file format '{ext}'. Supported formats: .xlsx, .xls, .csv, .json"
        )

    # 3. Read File Content & Check Size
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size == 0:
        raise BadRequestError("Uploaded file is empty (0 bytes).")
    if file_size > MAX_FILE_SIZE_BYTES:
        raise BadRequestError(f"File size ({file_size / (1024*1024):.2f}MB) exceeds maximum limit of 25MB.")

    # 4. Safe Temporary Storage
    dataset_id = f"ds_{uuid.uuid4().hex[:10]}"
    safe_filename = f"{dataset_id}_{original_filename.replace(' ', '_')}"
    saved_path = os.path.join(UPLOAD_STORAGE_DIR, safe_filename)

    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    # 5. Parse Data & Detect Columns
    try:
        parser = get_parser_for_file(original_filename)
        parsed = parser.parse(file_bytes, original_filename)
    except Exception as e:
        # Clean up file on parse failure
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise BadRequestError(f"Failed to parse {ext.upper()} file: {str(e)}")

    # 6. Create & Persist Dataset Metadata
    name = dataset_name.strip() if dataset_name and dataset_name.strip() else original_filename
    file_fmt = parsed.file_format

    dataset_entity = Dataset(
        id=dataset_id,
        company_id=target_company_id,
        uploaded_by=current_user.id,
        filename=safe_filename,
        original_filename=original_filename,
        dataset_name=name,
        file_format=file_fmt,
        file_type=file_fmt,
        file_size=file_size,
        file_size_bytes=file_size,
        status="UPLOADED",
        record_count=parsed.total_rows,
        description=description,
        stored_path=saved_path,
        uploaded_at=datetime.now(timezone.utc)
    )

    # Columns
    cols: List[DatasetColumn] = []
    for c in parsed.columns:
        col_id = f"col_{uuid.uuid4().hex[:8]}"
        cols.append(DatasetColumn(
            id=col_id,
            dataset_id=dataset_id,
            column_name=c.name,
            data_type=c.detected_type,
            suggested_field=c.suggested_field,
            sample_value=str(c.sample_values[0]) if c.sample_values else None
        ))
    dataset_entity.columns = cols

    repo.save_dataset(dataset_entity)

    # 7. Audit Log
    repo.log_audit(AuditLog(
        id=f"aud_{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        company_id=target_company_id,
        action="DATASET_UPLOAD",
        endpoint="/api/datasets/upload",
        details=f"Uploaded dataset '{name}' ({original_filename}, {parsed.total_rows} rows, {file_size} bytes)"
    ))

    # 8. Build Response
    detected_cols = [
        DetectedColumn(
            name=c.name,
            detected_type=c.detected_type,
            suggested_field=c.suggested_field,
            sample_values=c.sample_values
        )
        for c in parsed.columns
    ]

    return DatasetPreviewResponse(
        dataset_id=dataset_id,
        filename=original_filename,
        file_format=file_fmt,
        total_rows=parsed.total_rows,
        columns=detected_cols,
        sample_rows=parsed.rows[:15],
        detected_mappings=parsed.detected_mappings,
        validation_warnings=parsed.warnings,
        status="UPLOADED"
    )

@router.get("/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def get_dataset_preview(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Fetch preview and column detection information for an uploaded dataset.
    TenantGuard enforced.
    """
    dataset = repo.get_dataset_by_id(dataset_id)
    if not dataset:
        raise NotFoundError(f"Dataset '{dataset_id}' not found.")

    # Strict Tenant Access Check
    TenantGuard.enforce_company_access(current_user, dataset.company_id)

    # Check stored file
    if not dataset.stored_path or not os.path.exists(dataset.stored_path):
        # Fallback to column metadata
        detected_cols = [
            DetectedColumn(
                name=c.column_name,
                detected_type=c.data_type,
                suggested_field=c.suggested_field,
                sample_values=[c.sample_value] if c.sample_value else []
            )
            for c in dataset.columns
        ]
        return DatasetPreviewResponse(
            dataset_id=dataset.id,
            filename=dataset.original_filename,
            file_format=dataset.file_format,
            total_rows=dataset.record_count,
            columns=detected_cols,
            sample_rows=[],
            detected_mappings={c.column_name: c.suggested_field for c in dataset.columns if c.suggested_field},
            validation_warnings=["Source raw file is no longer in temporary storage; viewing cached metadata."],
            status=dataset.status
        )

    with open(dataset.stored_path, "rb") as f:
        file_bytes = f.read()

    parser = get_parser_for_file(dataset.original_filename)
    parsed = parser.parse(file_bytes, dataset.original_filename)

    detected_cols = [
        DetectedColumn(
            name=c.name,
            detected_type=c.detected_type,
            suggested_field=c.suggested_field,
            sample_values=c.sample_values
        )
        for c in parsed.columns
    ]

    return DatasetPreviewResponse(
        dataset_id=dataset.id,
        filename=dataset.original_filename,
        file_format=dataset.file_format,
        total_rows=parsed.total_rows,
        columns=detected_cols,
        sample_rows=parsed.rows[:15],
        detected_mappings=parsed.detected_mappings,
        validation_warnings=parsed.warnings,
        status=dataset.status
    )

@router.post("/{dataset_id}/mapping", response_model=IngestionResultResponse)
def apply_mapping_and_import(
    dataset_id: str,
    payload: ColumnMappingRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Apply confirmed column mapping, validate records, normalize data,
    and persist into the relational analytical engine (MonthlyFinancials & ProductMetrics).
    """
    dataset = repo.get_dataset_by_id(dataset_id)
    if not dataset:
        raise NotFoundError(f"Dataset '{dataset_id}' not found.")

    # TenantGuard
    TenantGuard.enforce_company_access(current_user, dataset.company_id)

    if not dataset.stored_path or not os.path.exists(dataset.stored_path):
        raise BadRequestError("Uploaded raw file not found for processing.")

    # 1. Update status to PROCESSING
    dataset.status = "PROCESSING"
    repo.save_dataset(dataset)

    # 2. Parse file
    try:
        with open(dataset.stored_path, "rb") as f:
            file_bytes = f.read()

        parser = get_parser_for_file(dataset.original_filename)
        parsed = parser.parse(file_bytes, dataset.original_filename)
    except Exception as e:
        dataset.status = "FAILED"
        dataset.error_message = f"Parse failed: {str(e)}"
        repo.save_dataset(dataset)
        raise BadRequestError(f"Failed to re-parse file: {str(e)}")

    # 3. Validate Rows with Mapping
    validator = IngestionValidator()
    validation_res = validator.validate(parsed.rows, payload.mapping)

    if not validation_res.is_valid:
        dataset.status = "FAILED"
        dataset.error_message = "; ".join(validation_res.errors)
        repo.save_dataset(dataset)
        raise BadRequestError(f"Validation failed: {'; '.join(validation_res.errors)}")

    # 4. Normalize Rows into Domain Entities
    normalizer = IngestionNormalizer()
    financials, products, start_date, end_date = normalizer.normalize(
        company_id=dataset.company_id,
        validated_rows=validation_res.validated_rows,
        dataset_id=dataset.id
    )

    # 5. Persist into Analytical Ledger (APPEND or REPLACE)
    mode = payload.mode.upper()
    repo.upsert_financials_and_products(
        company_id=dataset.company_id,
        financials=financials,
        products=products,
        mode=mode
    )

    # 6. Update Dataset Model State
    dataset.status = "COMPLETED"
    dataset.record_count = len(validation_res.validated_rows)
    dataset.processed_at = datetime.now(timezone.utc)
    dataset.date_range_start = start_date
    dataset.date_range_end = end_date
    dataset.mapping_config = json.dumps(payload.mapping)
    dataset.error_message = None
    repo.save_dataset(dataset)

    # 7. Audit Log
    repo.log_audit(AuditLog(
        id=f"aud_{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        company_id=dataset.company_id,
        action="DATASET_IMPORTED",
        endpoint=f"/api/datasets/{dataset_id}/mapping",
        details=f"Successfully imported {len(validation_res.validated_rows)} rows across {len(financials)} monthly ledger periods ({mode} mode)."
    ))

    msg = f"Successfully ingested {len(validation_res.validated_rows)} records into business analytics ledger. Data is now available to the AI Advisor."

    return IngestionResultResponse(
        dataset_id=dataset.id,
        status="COMPLETED",
        records_imported=len(validation_res.validated_rows),
        date_range_start=start_date,
        date_range_end=end_date,
        financial_records_created=len(financials),
        product_metrics_created=len(products),
        message=msg
    )

@router.get("", response_model=List[DatasetResponse])
def list_datasets(
    company_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """
    List datasets for authorized companies.
    OWNER: Returns only their company's datasets.
    ADMIN: Returns all datasets or filtered by company_id.
    """
    if current_user.role == "OWNER":
        if company_id and company_id != current_user.company_id:
            raise ForbiddenError("Access to this company's data is strictly forbidden.")
        if not current_user.company_id:
            return []
        authorized_ids = [current_user.company_id]
    else: # ADMIN
        if company_id:
            authorized_ids = [company_id]
        else:
            all_comps = repo.get_companies()
            authorized_ids = [c.id for c in all_comps]

    datasets = repo.get_datasets(authorized_ids)
    
    # Format response
    response_items = []
    for d in datasets:
        cols = [
            {"id": c.id, "column_name": c.column_name, "data_type": c.data_type, "suggested_field": c.suggested_field, "sample_value": c.sample_value}
            for c in d.columns
        ]
        response_items.append(
            DatasetResponse(
                id=d.id,
                company_id=d.company_id,
                company_name=d.company.name if d.company else d.company_id,
                uploaded_by=d.uploaded_by,
                filename=d.filename,
                original_filename=d.original_filename,
                dataset_name=d.dataset_name,
                file_format=d.file_format,
                file_type=d.file_type,
                record_count=d.record_count,
                file_size=d.file_size,
                file_size_bytes=d.file_size_bytes,
                status=d.status,
                description=d.description,
                uploaded_at=d.uploaded_at,
                processed_at=d.processed_at,
                error_message=d.error_message,
                date_range_start=d.date_range_start,
                date_range_end=d.date_range_end,
                columns=cols
            )
        )
    return response_items

@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a dataset. TenantGuard enforced.
    """
    dataset = repo.get_dataset_by_id(dataset_id)
    if not dataset:
        raise NotFoundError(f"Dataset '{dataset_id}' not found.")

    TenantGuard.enforce_company_access(current_user, dataset.company_id)

    # Clean up stored raw file if exists
    if dataset.stored_path and os.path.exists(dataset.stored_path):
        try:
            os.remove(dataset.stored_path)
        except Exception:
            pass

    company_check = dataset.company_id if current_user.role == "OWNER" else None
    success = repo.delete_dataset(dataset_id, current_user.id, company_check)

    repo.log_audit(AuditLog(
        id=f"aud_{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        company_id=dataset.company_id,
        action="DATASET_DELETE",
        endpoint=f"/api/datasets/{dataset_id}",
        details=f"Deleted dataset '{dataset.dataset_name}' ({dataset.original_filename})"
    ))

    return {
        "success": success,
        "message": f"Dataset '{dataset.dataset_name}' deleted successfully.",
        "dataset_id": dataset_id
    }
