from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from ..core.config import settings
from ..core.security import verify_password, create_access_token
from ..core.exceptions import UnauthorizedError, BadRequestError, ForbiddenError
from ..core.dependencies import get_current_user, get_repository
from ..repositories.base import IDataRepository
from ..models.user import User as UserModel
from ..schemas.auth import LoginRequest, RegisterRequest, AuthResponse, UserResponse, AuthenticatedUser
from ..models.audit import AuditLog
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=AuthResponse)
def login(
    req: LoginRequest,
    repository: IDataRepository = Depends(get_repository)
):
    """
    Authenticate user via email and bcrypt-hashed password.
    Returns JWT access token with role and company identity.
    """
    user = repository.get_user_by_email(req.email)
    if not user or not verify_password(req.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    # Generate JWT
    token = create_access_token(data={
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "company_id": user.company_id
    })

    # Log audit
    repository.log_audit(AuditLog(
        id=f"audit_{uuid.uuid4().hex[:12]}",
        user_id=user.id,
        company_id=user.company_id,
        action="AUTH_LOGIN",
        endpoint="/api/auth/login",
        details=f"User {user.email} logged in successfully"
    ))

    company_name = user.company.name if user.company else ("Global Administration" if user.role == "ADMIN" else None)

    return AuthResponse(
        access_token=token,
        token_type="Bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            company_id=user.company_id,
            company_name=company_name,
            job_title=user.job_title
        )
    )

@router.get("/me", response_model=UserResponse)
def get_current_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    repository: IDataRepository = Depends(get_repository)
):
    """Return currently authenticated user profile."""
    user = repository.get_user_by_id(current_user.id)
    if not user:
        raise UnauthorizedError("User not found")
    
    company_name = user.company.name if user.company else ("Global Administration" if user.role == "ADMIN" else None)

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        company_id=user.company_id,
        company_name=company_name,
        job_title=user.job_title
    )

@router.post("/register", response_model=AuthResponse)
def register(
    req: RegisterRequest,
    repository: IDataRepository = Depends(get_repository)
):
    """
    Register a new Owner account and associated Company.
    """
    if req.password != req.confirm_password:
        raise BadRequestError("Passwords do not match")
    
    if len(req.password) < 6:
        raise BadRequestError("Password must be at least 6 characters")
    
    existing = repository.get_user_by_email(req.email)
    if existing:
        raise BadRequestError("Email is already registered")
    
    # Create Company
    company_id = f"comp_{uuid.uuid4().hex[:8]}"
    from ..models.company import Company
    new_company = Company(
        id=company_id,
        name=req.company_name,
        code=req.company_name[:4].upper() + f"{uuid.uuid4().hex[:2]}".upper(),
        specialization="Textile Manufacturing",
        city="Unknown",
        state="Unknown",
        founded_year=2024
    )
    with repository.get_session() as session:
        session.add(new_company)
        session.commit()
    
    # Hash password securely
    from ..core.security import get_password_hash
    password_hash = get_password_hash(req.password)
    
    # Create User
    new_user = UserModel(
        id=f"user_{uuid.uuid4().hex[:8]}",
        email=req.email.lower().strip(),
        password_hash=password_hash,
        name=req.full_name,
        role="OWNER",
        company_id=company_id,
        job_title="Owner"
    )
    repository.create_user(new_user)
    
    # Log audit
    repository.log_audit(AuditLog(
        id=f"audit_{uuid.uuid4().hex[:12]}",
        user_id=new_user.id,
        company_id=new_user.company_id,
        action="AUTH_REGISTER",
        endpoint="/api/auth/register",
        details=f"User {new_user.email} registered a new company"
    ))
    
    # Generate JWT
    token = create_access_token(data={
        "sub": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "company_id": new_user.company_id
    })
    
    return AuthResponse(
        access_token=token,
        token_type="Bearer",
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            name=new_user.name,
            role=new_user.role,
            company_id=new_user.company_id,
            company_name=req.company_name,
            job_title=new_user.job_title
        )
    )
