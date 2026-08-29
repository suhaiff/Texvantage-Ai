from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
import uuid
import os
import pypdf

from ..core.dependencies import get_current_user
from ..schemas.auth import AuthenticatedUser
from ..models.knowledge import CompanyKnowledge
from ..repositories.dev_repo import repo

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

@router.post("/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    company_id: str = Form(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    if not user.is_admin() and user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload knowledge for this company")
        
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported for knowledge upload.")
        
    extracted_text = ""
    
    try:
        if ext == ".pdf":
            reader = pypdf.PdfReader(file.file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        elif ext == ".txt":
            content = await file.read()
            extracted_text = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
        
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in the uploaded file.")
        
    knowledge = CompanyKnowledge(
        id=f"know_{uuid.uuid4().hex[:12]}",
        company_id=company_id,
        filename=filename,
        content=extracted_text
    )
    
    with repo.SessionLocal() as session:
        session.add(knowledge)
        session.commit()
    
    return {"status": "success", "message": "Knowledge document uploaded successfully."}
