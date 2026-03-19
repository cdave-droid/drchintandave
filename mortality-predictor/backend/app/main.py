"""MortPred API — Clinical Mortality Prediction Tool.

FastAPI backend for evidence-based mortality and outcome prediction.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.predict import router as predict_router

app = FastAPI(
    title="MortPred API",
    description="Evidence-based clinical mortality and outcome prediction tool",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api", tags=["prediction"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "mortpred-api"}
