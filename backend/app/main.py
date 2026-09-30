from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from .core.config import settings
from .core.exceptions import AppError
from .repositories.dev_repo import repo
from .api.auth import router as auth_router
from .api.companies import router as companies_router
from .api.analytics import router as analytics_router
from .api.chat import router as chat_router
from .api.datasets import router as datasets_router
from .api.reports import router as reports_router
from .api.knowledge import router as knowledge_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB tables & seed data are initialized
    _ = repo
    yield
    # Shutdown logic if needed

app = FastAPI(
    title="TexVantage AI API",
    description="Enterprise AI Business Intelligence Platform for Textile Enterprises",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global AppError Exception Handler
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers
    )

# Include API Sub-routers
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(companies_router, prefix=settings.API_PREFIX)
app.include_router(analytics_router, prefix=settings.API_PREFIX)
app.include_router(chat_router, prefix=settings.API_PREFIX)
app.include_router(datasets_router, prefix=settings.API_PREFIX)
app.include_router(reports_router, prefix=settings.API_PREFIX)
app.include_router(knowledge_router, prefix=settings.API_PREFIX)

@app.get("/api/health", tags=["Health"])
def health_check():
    """System Health Check & Tenant Engine Status."""
    try:
        repo.check_connection()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable. Check DATABASE_URL and the SQL Server service.",
        ) from exc

    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": "connected",
        "database_dialect": repo.engine.dialect.name,
        "tenant_isolation": "enforced_server_side",
        "companies_seeded": len(repo.get_companies())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8081, reload=True)
