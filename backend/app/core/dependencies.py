from fastapi import Depends, Header
from typing import Optional, List
from .security import decode_access_token
from .exceptions import UnauthorizedError, ForbiddenError
from .config import settings
from ..schemas.auth import AuthenticatedUser
from ..repositories.base import IDataRepository
from ..repositories.dev_repo import repo

def get_repository() -> IDataRepository:
    """Dependency provider for Data Access Layer abstraction."""
    return repo

async def get_current_user(
    authorization: Optional[str] = Header(None),
    repository: IDataRepository = Depends(get_repository)
) -> AuthenticatedUser:
    """
    Extracts Bearer token from headers, verifies cryptographic signature,
    and returns a validated AuthenticatedUser object with server-derived
    tenant scoping.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid Authorization header (Bearer token required)")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedError("Token is invalid or expired")
    
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token claims: subject missing")
    
    user = repository.get_user_by_id(user_id)
    if not user:
        raise UnauthorizedError("User account associated with token no longer exists")
    
    # Enforce Server-Side Tenant Authorization Resolution
    role = user.role.upper()
    if role == "ADMIN":
        # Admin can access all companies
        all_comps = repository.get_companies()
        authorized_ids = [c.id for c in all_comps]
    else:
        # Owner can ONLY access their strictly assigned company
        authorized_ids = [user.company_id] if user.company_id else []

    return AuthenticatedUser(
        id=user.id,
        email=user.email,
        name=user.name,
        role=role,
        company_id=user.company_id,
        authorized_company_ids=authorized_ids
    )

def require_admin(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    """Dependency that strictly forbids non-ADMIN users."""
    if not current_user.is_admin():
        raise ForbiddenError("Administrative privileges required for this action")
    return current_user

class TenantGuard:
    """
    Utility class for validating that requested company IDs fall strictly within
    the authenticated user's authorized company scope.
    """
    @staticmethod
    def enforce_company_access(user: AuthenticatedUser, requested_company_id: str) -> str:
        """
        Ensures the user has permission to access the requested company.
        If caller is an OWNER, requested_company_id MUST match user.company_id.
        Any attempt to bypass or supply another company_id raises HTTP 403 Forbidden.
        """
        if user.is_admin():
            return requested_company_id
        
        if not user.company_id or requested_company_id != user.company_id:
            raise ForbiddenError(f"Access denied: You are not authorized to access company data for '{requested_company_id}'")
        
        return user.company_id

    @staticmethod
    def get_scoped_company_ids(user: AuthenticatedUser, requested_ids: Optional[List[str]] = None) -> List[str]:
        """
        Returns a sanitized list of company IDs authorized for query execution.
        """
        if user.is_admin():
            if requested_ids:
                return requested_ids
            return user.authorized_company_ids
        
        # Non-admins ALWAYS get strictly their own company ID
        return [user.company_id] if user.company_id else []
