"""Prediction API router."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.patient import PredictionRequest, PredictionResponse
from app.services.prediction import predict

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
async def predict_mortality(request: PredictionRequest) -> PredictionResponse:
    """Run mortality and outcome prediction for a patient.

    Accepts comprehensive patient data and returns:
    - Mortality predictions at 30d, 90d, and 1yr timeframes
    - Organ-specific outcome predictions
    - Functional outcome predictions
    - Evidence-backed risk factor analysis with citations
    - Organ model trajectory simulations
    """
    try:
        return await predict(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
