"""Core prediction service that orchestrates scoring, organ models, and AI agent."""

from __future__ import annotations

from app.agents.research import get_agent
from app.models.patient import (
    BaselineInfo,
    OrganModelOutput,
    OutcomePrediction,
    OutcomeType,
    PatientInput,
    PredictionRequest,
    PredictionResponse,
    RiskFactor,
)
from app.organ_models.compartment import run_organ_models
from app.scoring.calculators import ScoreResult, compute_all_applicable
from app.services.baseline import get_baseline


DISCLAIMERS = [
    "This tool is for clinical decision support only and does not replace physician judgment.",
    "Predictions are based on population-level evidence and may not reflect individual patient outcomes.",
    "All cited studies should be independently verified before clinical decision-making.",
    "This tool has not been validated in a prospective clinical trial and is not FDA-cleared.",
    "Organ model trajectories are simplified approximations and should be interpreted with caution.",
]


# Baseline rates for non-mortality outcomes
BASELINE_OUTCOMES = {
    "need_for_dialysis": 0.03,
    "ventilator_dependence": 0.05,
    "cardiac_event": 0.04,
    "diabetes_complications": 0.08,
    "icu_length_of_stay": 0.10,  # Probability of prolonged ICU stay (>7d)
    "readmission_30d": 0.12,
    "functional_decline": 0.15,
    "aki_progression": 0.05,
    "hepatic_decompensation": 0.02,
}

# Which comorbidities elevate which outcomes
OUTCOME_COMORBIDITY_MODIFIERS: dict[str, dict[str, float]] = {
    "need_for_dialysis": {
        "ckd_stage3": 3.0, "ckd_stage4": 8.0, "ckd_stage5": 15.0,
        "diabetes_type2": 1.5, "hypertension": 1.2,
    },
    "ventilator_dependence": {
        "copd": 2.5, "copd_severe": 4.0, "chf_hfref": 1.5,
    },
    "cardiac_event": {
        "mi": 3.0, "chf": 2.0, "chf_hfref": 2.5, "afib": 1.5,
        "pad": 1.5, "diabetes_type2": 1.4, "hypertension": 1.3,
    },
    "diabetes_complications": {
        "diabetes_type1": 3.0, "diabetes_type2": 2.5,
        "ckd_stage3": 1.5, "ckd_stage4": 2.0, "obesity": 1.3,
    },
    "readmission_30d": {
        "chf": 2.0, "chf_hfref": 2.5, "copd": 1.8, "cirrhosis": 2.0,
        "ckd_stage4": 1.5, "ckd_stage5": 2.0,
    },
    "functional_decline": {
        "stroke": 2.5, "dementia": 3.0, "chf_hfref": 1.5, "copd_severe": 2.0,
    },
    "aki_progression": {
        "ckd_stage3": 2.5, "ckd_stage4": 5.0, "ckd_stage5": 8.0,
        "diabetes_type2": 1.5, "hypertension": 1.3,
    },
    "hepatic_decompensation": {
        "cirrhosis": 5.0, "hepatitis_b": 2.0, "hepatitis_c": 2.0,
    },
}


def _organ_severity_adjustment(organ_outputs: list[OrganModelOutput]) -> list[RiskFactor]:
    """Convert organ model trajectory endpoints into risk factors.

    This feeds organ model predictions back into the mortality calculation,
    so projected organ deterioration influences the final score.
    """
    risk_factors: list[RiskFactor] = []
    worsening_count = 0

    for organ in organ_outputs:
        if not organ.trajectory_values or len(organ.trajectory_values) < 2:
            continue

        initial = organ.trajectory_values[0]
        final = organ.trajectory_values[-1]

        if organ.organ_system == "renal":
            # Chertow et al., JASN 2005: small Cr rises associated with mortality
            if final > initial * 1.5 and final > 2.0:
                risk_factors.append(RiskFactor(
                    factor_name="Projected AKI Progression",
                    description=f"Creatinine projected to rise from {initial:.1f} to {final:.1f} mg/dL",
                    relative_risk=1.8,
                    confidence="moderate",
                    source="Chertow et al., JASN 2005",
                ))
                worsening_count += 1
            if final > 4.0:
                risk_factors.append(RiskFactor(
                    factor_name="Projected Severe Renal Failure",
                    description=f"Creatinine projected to reach {final:.1f} mg/dL",
                    relative_risk=2.5,
                    confidence="moderate",
                    source="Chertow et al., JASN 2005",
                ))

        elif organ.organ_system == "cardiac":
            # Varpula et al., Crit Care 2005: MAP time below 65 predicts mortality
            if final < 55:
                risk_factors.append(RiskFactor(
                    factor_name="Projected Refractory Shock",
                    description=f"MAP projected to reach {final:.0f} mmHg",
                    relative_risk=3.0,
                    confidence="moderate",
                    source="Varpula et al., Crit Care 2005",
                ))
                worsening_count += 1
            elif final < 60:
                risk_factors.append(RiskFactor(
                    factor_name="Projected Hemodynamic Instability",
                    description=f"MAP projected to reach {final:.0f} mmHg",
                    relative_risk=2.0,
                    confidence="moderate",
                    source="Varpula et al., Crit Care 2005",
                ))
                worsening_count += 1

        elif organ.organ_system == "hepatic":
            # Kramer & Jordan, Crit Care Med 2007
            if final > initial * 2.0 and final > 3.0:
                risk_factors.append(RiskFactor(
                    factor_name="Projected Hepatic Deterioration",
                    description=f"Bilirubin projected to rise from {initial:.1f} to {final:.1f} mg/dL",
                    relative_risk=1.6,
                    confidence="moderate",
                    source="Kramer & Jordan, Crit Care Med 2007",
                ))
                worsening_count += 1
            if final > 12.0:
                risk_factors.append(RiskFactor(
                    factor_name="Projected Severe Liver Failure",
                    description=f"Bilirubin projected to reach {final:.1f} mg/dL",
                    relative_risk=2.2,
                    confidence="moderate",
                    source="Kramer & Jordan, Crit Care Med 2007",
                ))

    # Multi-organ failure synergy (Vincent et al., JAMA 2001)
    if worsening_count >= 3:
        risk_factors.append(RiskFactor(
            factor_name="Multi-Organ Trajectory Decline",
            description=f"All {worsening_count} modeled organ systems show projected worsening",
            relative_risk=2.0,
            confidence="moderate",
            source="Vincent et al., JAMA 2001 (SOFA trajectory)",
        ))
    elif worsening_count >= 2:
        risk_factors.append(RiskFactor(
            factor_name="Multi-Organ Trajectory Decline",
            description=f"{worsening_count} organ systems show projected worsening",
            relative_risk=1.5,
            confidence="moderate",
            source="Vincent et al., JAMA 2001 (SOFA trajectory)",
        ))

    return risk_factors


def _compute_combined_risk(
    base_rate: float,
    risk_factors: list[RiskFactor],
    clinical_scores: list[ScoreResult],
) -> tuple[float, float, float]:
    """Combine base rate with risk factors using a log-linear model.

    Returns (low, mid, high) probability estimates.
    """
    import math

    # Start with log-odds of baseline
    if base_rate <= 0:
        base_rate = 0.001
    if base_rate >= 1:
        base_rate = 0.999

    log_odds = math.log(base_rate / (1 - base_rate))

    # Add contributions from risk factors (log-relative-risk)
    for rf in risk_factors:
        if rf.relative_risk > 0:
            log_odds += math.log(rf.relative_risk)

    # Use the best clinical score mortality estimate if available
    score_mortalities = [s.mortality_estimate for s in clinical_scores if s.mortality_estimate is not None]
    if score_mortalities:
        avg_score_mortality = sum(score_mortalities) / len(score_mortalities)
        # Blend score-based estimate (50%) with factor-adjusted estimate (50%)
        factor_prob = 1 / (1 + math.exp(-log_odds))
        mid = 0.5 * factor_prob + 0.5 * avg_score_mortality
    else:
        mid = 1 / (1 + math.exp(-log_odds))

    mid = max(0.001, min(0.999, mid))

    # Confidence interval based on number of high-confidence factors
    high_conf_count = sum(1 for rf in risk_factors if rf.confidence == "high")
    total_count = max(len(risk_factors), 1)
    confidence_ratio = high_conf_count / total_count

    # Narrower interval with more high-confidence data
    interval_width = 0.15 * (1 - confidence_ratio * 0.5)
    low = max(0.001, mid - interval_width)
    high = min(0.999, mid + interval_width)

    return low, mid, high


def _compute_outcome_probability(
    outcome_type: OutcomeType,
    patient: PatientInput,
    risk_factors: list[RiskFactor],
) -> tuple[float, float, float, float]:
    """Compute probability for non-mortality outcomes.

    Returns (baseline, low, mid, high).
    """
    outcome_key = outcome_type.value
    baseline = BASELINE_OUTCOMES.get(outcome_key, 0.05)

    # Apply comorbidity modifiers
    modifiers = OUTCOME_COMORBIDITY_MODIFIERS.get(outcome_key, {})
    combined_rr = 1.0
    for comorbidity in patient.diagnosis.comorbidities:
        if comorbidity in modifiers:
            combined_rr *= modifiers[comorbidity]

    # Cap combined RR at 20x
    combined_rr = min(combined_rr, 20.0)
    mid = min(baseline * combined_rr, 0.95)

    # Adjust for ICU vs floor
    if patient.diagnosis.admission_type.value == "icu":
        mid = min(mid * 1.5, 0.95)

    interval = 0.10
    low = max(0.001, mid - interval)
    high = min(0.999, mid + interval)

    return baseline, low, mid, high


async def predict(request: PredictionRequest) -> PredictionResponse:
    """Run the full prediction pipeline."""
    patient = request.patient

    # 1. Compute clinical scores
    score_results = compute_all_applicable(patient)
    clinical_scores_dict = {s.name: s.score for s in score_results}

    # 2. Run AI research agent
    agent = get_agent()
    risk_factors, narrative = await agent.analyze_mortality_factors(patient, clinical_scores_dict)

    # 3. Derive composite mortality estimate from clinical scores to calibrate organ models.
    # Uses the average of all score-based mortality estimates (SOFA, APACHE II, MELD, etc.)
    # as a single scalar that grounds ODE recovery/clearance rates in validated outcomes.
    score_mortalities = [s.mortality_estimate for s in score_results if s.mortality_estimate is not None]
    composite_mortality = sum(score_mortalities) / len(score_mortalities) if score_mortalities else 0.0

    # 4. Run organ models (coupled ODE system — calibrated by patient-specific parameters)
    organ_outputs = run_organ_models(patient)

    # 4b. Feed organ trajectory endpoints back into risk factors
    organ_risk_factors = _organ_severity_adjustment(organ_outputs)
    risk_factors.extend(organ_risk_factors)

    # 5. Compute outcome predictions
    outcomes: list[OutcomePrediction] = []
    diagnosis_baseline = await get_baseline(patient)
    baseline_by_timeframe = {
        OutcomeType.MORTALITY_30D: diagnosis_baseline.mortality_30d,
        OutcomeType.MORTALITY_90D: diagnosis_baseline.mortality_90d,
        OutcomeType.MORTALITY_1YR: diagnosis_baseline.mortality_1yr,
    }

    for outcome_type in request.selected_outcomes:
        if outcome_type.value.startswith("mortality_"):
            baseline = baseline_by_timeframe.get(outcome_type, 0.05)
            low, mid, high = _compute_combined_risk(baseline, risk_factors, score_results)

            is_extrapolated = False
            extrapolation_note = None

            # Flag extrapolated timeframes — 90d/1yr baselines are from literature
            # but the risk-factor RRs applied on top are mostly 30d/in-hospital evidence
            if outcome_type == OutcomeType.MORTALITY_90D:
                is_extrapolated = True
                extrapolation_note = (
                    "90-day baseline is from published literature for this diagnosis. "
                    "Risk-factor adjustments (SOFA, APACHE II, comorbidity RRs) are primarily "
                    "validated at 30-day / in-hospital endpoints — 90-day estimate carries higher uncertainty."
                )
            elif outcome_type == OutcomeType.MORTALITY_1YR:
                is_extrapolated = True
                extrapolation_note = (
                    "1-year baseline is from published literature for this diagnosis. "
                    "Risk-factor adjustments are primarily validated at shorter timepoints. "
                    "Long-term mortality is influenced by post-discharge factors not captured here."
                )

            outcomes.append(OutcomePrediction(
                outcome_type=outcome_type,
                probability_low=round(low, 3),
                probability_mid=round(mid, 3),
                probability_high=round(high, 3),
                baseline_probability=round(baseline, 3),
                risk_factors=risk_factors,
                clinical_scores=clinical_scores_dict,
                is_extrapolated=is_extrapolated,
                extrapolation_note=extrapolation_note,
            ))
        else:
            baseline, low, mid, high = _compute_outcome_probability(
                outcome_type, patient, risk_factors
            )
            outcomes.append(OutcomePrediction(
                outcome_type=outcome_type,
                probability_low=round(low, 3),
                probability_mid=round(mid, 3),
                probability_high=round(high, 3),
                baseline_probability=round(baseline, 3),
                risk_factors=[],
                clinical_scores=clinical_scores_dict,
            ))

    # 6. Build patient summary
    summary_parts = [
        f"{patient.demographics.age}yo {patient.demographics.sex.value}",
        f"presenting with {patient.diagnosis.primary_diagnosis}",
    ]
    if patient.diagnosis.comorbidities:
        summary_parts.append(f"PMH: {', '.join(c.replace('_', ' ') for c in patient.diagnosis.comorbidities)}")
    summary_parts.append(f"Admission: {patient.diagnosis.admission_type.value.upper()}")
    patient_summary = " | ".join(summary_parts)

    return PredictionResponse(
        patient_summary=patient_summary,
        outcomes=outcomes,
        organ_models=organ_outputs,
        evidence_narrative=narrative,
        disclaimers=DISCLAIMERS,
        clinical_scores_used=clinical_scores_dict,
        baseline_info=BaselineInfo(
            matched_diagnosis=diagnosis_baseline.matched_diagnosis,
            match_method=diagnosis_baseline.match_method,
            source=diagnosis_baseline.source,
            primary_finding=diagnosis_baseline.primary_finding,
            n_patients=diagnosis_baseline.n_patients,
            population_note=diagnosis_baseline.population_note,
        ),
    )
