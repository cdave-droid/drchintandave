"""MortPred API — Clinical Mortality Prediction Tool.

FastAPI backend for evidence-based mortality and outcome prediction.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.predict import router as predict_router

app = FastAPI(
    title="MortPred API",
    description="Evidence-based clinical mortality and outcome prediction tool",
    version="0.1.0",
)

_default_origins = "http://localhost:3000,http://localhost:3001"
_origins = os.environ.get("ALLOWED_ORIGINS", _default_origins)
allowed_origins = [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api", tags=["prediction"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "mortpred-api"}
