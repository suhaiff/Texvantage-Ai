from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    full_name: str
    company_name: str
    email: str
    password: str
    confirm_password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str # "OWNER" or "ADMIN"
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    job_title: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserResponse

class AuthenticatedUser(BaseModel):
    """Server-side identity representation injected via TenantGuard."""
    id: str
    email: str
    name: str
    role: str
    company_id: Optional[str] = None
    authorized_company_ids: List[str] = []

    def is_admin(self) -> bool:
        return self.role.upper() == "ADMIN"
    
    def can_access_company(self, company_id: str) -> bool:
        if self.is_admin():
            return True
        return self.company_id == company_id
