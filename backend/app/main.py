"""
CivicPulse AI — Main FastAPI Application
AI-Powered Public Issue Reporting, Evidence Verification & Priority Engine
"""

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import init_db
from app.core.security import init_firebase

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.app_debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("civicpulse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("╔══════════════════════════════════════════════╗")
    logger.info("║       CivicPulse AI — Starting Up            ║")
    logger.info("╚══════════════════════════════════════════════╝")

    # Initialize database tables
    init_db()
    logger.info("Database initialized.")

    # Initialize Firebase Admin SDK
    init_firebase()

    # Ensure upload directory exists
    settings.upload_path
    logger.info(f"Upload directory: {settings.upload_dir}")

    # Log service status
    logger.info(f"Firebase Auth: {'configured' if settings.firebase_configured else 'NOT configured'}")
    logger.info(f"Gemini AI:     {'configured' if settings.gemini_configured else 'NOT configured'}")
    logger.info(f"Google Sheets: {'configured' if settings.sheets_configured else 'NOT configured'}")
    logger.info(f"Email:         {'configured' if settings.email_configured else 'NOT configured'}")

    yield

    logger.info("CivicPulse AI — Shutting down.")


app = FastAPI(
    title="CivicPulse AI",
    description="AI-Powered Public Issue Reporting, Evidence Verification & Priority Engine",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────
allowed_origins = [
    settings.frontend_url,
    "https://civic-plus-six.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID Middleware ────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Global Error Handler ────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled exception: {exc}", exc_info=True)

    # Never expose stack traces in production
    detail = "Internal server error."
    if settings.app_debug:
        detail = str(exc)

    return JSONResponse(
        status_code=500,
        content={"detail": detail, "request_id": request_id},
    )


# ── Register Routers ────────────────────────────────────────
from app.api.health import router as health_router
from app.api.reports import router as reports_router
from app.api.admin import router as admin_router

app.include_router(health_router)
app.include_router(reports_router)
app.include_router(admin_router)

# ── Serve uploaded images ────────────────────────────────────
upload_path = settings.upload_path
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")
