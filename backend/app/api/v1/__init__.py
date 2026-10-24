"""V1 API router aggregator."""

from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.events import router as events_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.metrics import router as metrics_router
from app.api.v1.export import router as export_router
from app.api.v1.audit import router as audit_router
from app.api.v1.decoy import router as decoy_router
from app.api.v1.decoy_personnel import router as decoy_personnel_router
from app.api.v1.internal import router as internal_router
from app.api.v1.websocket import router as ws_router

api_v1_router = APIRouter(prefix="/api/v1")

# Core administrative and monitoring endpoints
api_v1_router.include_router(auth_router)
api_v1_router.include_router(metrics_router)
api_v1_router.include_router(events_router)
api_v1_router.include_router(evidence_router)
api_v1_router.include_router(export_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(ws_router)

# Decoy honeypot surface
api_v1_router.include_router(decoy_router)
api_v1_router.include_router(decoy_personnel_router)
api_v1_router.include_router(internal_router)
