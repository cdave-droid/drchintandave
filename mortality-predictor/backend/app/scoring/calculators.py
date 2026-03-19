"""Evidence-based clinical scoring calculators.

Implements validated scoring systems used in clinical medicine.
Each calculator returns a score and its interpretation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.models.patient import PatientInput


@dataclass
class ScoreResult:
    name: str
    score: float
    max_score: Optional[float]
    interpretation: str
    mortality_estimate: Optional[float]  # 0-1 probability
    source: str


def compute_sofa(patient: PatientInput) -> Optional[ScoreResult]:
    """Sequential Organ Failure Assessment (SOFA) score.

    Vincent et al., Intensive Care Med, 1996.
    Predicts ICU mortality based on 6 organ systems.
    """
    vitals = patient.vitals
    labs = patient.labs
    interventions = patient.interventions

    if not vitals or not labs:
        return None

    score = 0

    # Respiratory: PaO2/FiO2 ratio
    if labs.pao2 is not None and vitals.fio2 is not None and vitals.fio2 > 0:
        pf_ratio = labs.pao2 / vitals.fio2
        if pf_ratio < 100:
            score += 4
        elif pf_ratio < 200:
            score += 3
        elif pf_ratio < 300:
            score += 2
        elif pf_ratio < 400:
            score += 1

    # Coagulation: Platelets
    if labs.platelets is not None:
        if labs.platelets < 20:
            score += 4
        elif labs.platelets < 50:
            score += 3
        elif labs.platelets < 100:
            score += 2
        elif labs.platelets < 150:
            score += 1

    # Liver: Bilirubin
    if labs.bilirubin_total is not None:
        if labs.bilirubin_total >= 12:
            score += 4
        elif labs.bilirubin_total >= 6:
            score += 3
        elif labs.bilirubin_total >= 2:
            score += 2
        elif labs.bilirubin_total >= 1.2:
            score += 1

    # Cardiovascular: MAP and vasopressors
    if interventions and interventions.on_vasopressors:
        if interventions.vasopressor_count >= 2:
            score += 4
        else:
            score += 3
    elif vitals.mean_arterial_pressure is not None:
        if vitals.mean_arterial_pressure < 70:
            score += 1

    # CNS: Glasgow Coma Scale
    if vitals.gcs_total is not None:
        if vitals.gcs_total < 6:
            score += 4
        elif vitals.gcs_total < 10:
            score += 3
        elif vitals.gcs_total < 13:
            score += 2
        elif vitals.gcs_total < 15:
            score += 1

    # Renal: Creatinine or urine output
    if labs.creatinine is not None:
        if labs.creatinine >= 5.0:
            score += 4
        elif labs.creatinine >= 3.5:
            score += 3
        elif labs.creatinine >= 2.0:
            score += 2
        elif labs.creatinine >= 1.2:
            score += 1

    # SOFA mortality estimates (Ferreira et al., JAMA 2001)
    mortality_map = {
        0: 0.0, 1: 0.0, 2: 0.06, 3: 0.06, 4: 0.06,
        5: 0.08, 6: 0.10, 7: 0.15, 8: 0.15, 9: 0.20,
        10: 0.33, 11: 0.40, 12: 0.50, 13: 0.60, 14: 0.70,
        15: 0.82, 16: 0.87, 17: 0.90, 18: 0.90, 19: 0.95,
        20: 0.95, 21: 0.95, 22: 0.95, 23: 0.95, 24: 0.95,
    }
    mortality = mortality_map.get(min(score, 24), 0.95)

    if score <= 1:
        interp = "Low organ dysfunction"
    elif score <= 6:
        interp = "Moderate organ dysfunction"
    elif score <= 12:
        interp = "Significant organ dysfunction"
    else:
        interp = "Severe multi-organ dysfunction"

    return ScoreResult(
        name="SOFA",
        score=score,
        max_score=24,
        interpretation=interp,
        mortality_estimate=mortality,
        source="Vincent et al., Intensive Care Med 1996; Ferreira et al., JAMA 2001",
    )


def compute_apache_ii(patient: PatientInput) -> Optional[ScoreResult]:
    """Acute Physiology and Chronic Health Evaluation II (APACHE II).

    Knaus et al., Critical Care Medicine, 1985.
    Uses 12 physiologic variables, age, and chronic health points.
    """
    vitals = patient.vitals
    labs = patient.labs

    if not vitals or not labs:
        return None

    score = 0

    # Age points
    age = patient.demographics.age
    if age >= 75:
        score += 6
    elif age >= 65:
        score += 5
    elif age >= 55:
        score += 3
    elif age >= 45:
        score += 2

    # Temperature
    if vitals.temperature is not None:
        t = vitals.temperature
        if t >= 41 or t <= 29.9:
            score += 4
        elif t >= 39 or t <= 31.9:
            score += 3
        elif t >= 38.5 or t <= 33.9:
            score += 1

    # Mean arterial pressure
    if vitals.mean_arterial_pressure is not None:
        m = vitals.mean_arterial_pressure
        if m >= 160 or m <= 49:
            score += 4
        elif m >= 130 or m <= 59:
            score += 3
        elif m >= 110 or m <= 69:
            score += 2

    # Heart rate
    if vitals.heart_rate is not None:
        hr = vitals.heart_rate
        if hr >= 180 or hr <= 39:
            score += 4
        elif hr >= 140 or hr <= 54:
            score += 3
        elif hr >= 110 or hr <= 69:
            score += 2

    # Respiratory rate
    if vitals.respiratory_rate is not None:
        rr = vitals.respiratory_rate
        if rr >= 50 or rr <= 5:
            score += 4
        elif rr >= 35:
            score += 3
        elif rr >= 25 or rr <= 9:
            score += 1

    # Oxygenation (PaO2 if FiO2 < 0.5, otherwise A-a gradient)
    if labs.pao2 is not None:
        if labs.pao2 < 55:
            score += 4
        elif labs.pao2 < 60:
            score += 3
        elif labs.pao2 < 70:
            score += 1

    # pH
    if labs.ph is not None:
        p = labs.ph
        if p >= 7.7 or p < 7.15:
            score += 4
        elif p >= 7.6 or p < 7.25:
            score += 3
        elif p >= 7.5 or p < 7.33:
            score += 2

    # Sodium
    if labs.sodium is not None:
        na = labs.sodium
        if na >= 180 or na <= 110:
            score += 4
        elif na >= 160 or na <= 119:
            score += 3
        elif na >= 155 or na <= 129:
            score += 2
        elif na >= 150:
            score += 1

    # Potassium
    if labs.potassium is not None:
        k = labs.potassium
        if k >= 7.0 or k < 2.5:
            score += 4
        elif k >= 6.0:
            score += 3
        elif k >= 5.5 or k < 3.0:
            score += 1

    # Creatinine
    if labs.creatinine is not None:
        cr = labs.creatinine
        if cr >= 3.5:
            score += 4
        elif cr >= 2.0:
            score += 3
        elif cr >= 1.5:
            score += 2

    # Hematocrit
    if labs.hematocrit is not None:
        hct = labs.hematocrit
        if hct >= 60 or hct < 20:
            score += 4
        elif hct >= 50 or hct < 30:
            score += 2

    # WBC
    if labs.wbc is not None:
        w = labs.wbc
        if w >= 40 or w < 1:
            score += 4
        elif w >= 20 or w < 3:
            score += 2

    # GCS (15 minus GCS)
    if vitals.gcs_total is not None:
        score += (15 - vitals.gcs_total)

    # Chronic health points (simplified from comorbidities)
    chronic_conditions = {"cirrhosis", "chf_nyha4", "copd_severe", "immunocompromised", "ckd_stage5"}
    has_chronic = bool(set(patient.diagnosis.comorbidities) & chronic_conditions)
    if has_chronic:
        if patient.diagnosis.is_surgical:
            score += 5
        else:
            score += 2

    # Mortality estimates (Knaus et al., 1985 — approximate)
    if score <= 4:
        mortality = 0.04
    elif score <= 9:
        mortality = 0.08
    elif score <= 14:
        mortality = 0.15
    elif score <= 19:
        mortality = 0.25
    elif score <= 24:
        mortality = 0.40
    elif score <= 29:
        mortality = 0.55
    elif score <= 34:
        mortality = 0.73
    else:
        mortality = 0.85

    return ScoreResult(
        name="APACHE II",
        score=score,
        max_score=71,
        interpretation=f"APACHE II {score}: estimated ICU mortality ~{mortality*100:.0f}%",
        mortality_estimate=mortality,
        source="Knaus et al., Critical Care Medicine 1985",
    )


def compute_meld(patient: PatientInput) -> Optional[ScoreResult]:
    """Model for End-Stage Liver Disease (MELD) score.

    Kamath et al., Hepatology, 2001.
    Predicts 3-month mortality in liver disease.
    """
    import math

    labs = patient.labs
    if not labs or labs.creatinine is None or labs.bilirubin_total is None or labs.inr is None:
        return None

    cr = max(labs.creatinine, 1.0)
    cr = min(cr, 4.0)
    bili = max(labs.bilirubin_total, 1.0)
    inr = max(labs.inr, 1.0)

    # On dialysis adjustment
    if patient.interventions and patient.interventions.on_dialysis:
        cr = 4.0

    meld = 10 * (
        0.957 * math.log(cr)
        + 0.378 * math.log(bili)
        + 1.120 * math.log(inr)
        + 0.643
    )
    meld = round(min(max(meld, 6), 40))

    # 3-month mortality estimates
    if meld <= 9:
        mortality = 0.019
    elif meld <= 19:
        mortality = 0.06
    elif meld <= 29:
        mortality = 0.196
    elif meld <= 39:
        mortality = 0.526
    else:
        mortality = 0.714

    return ScoreResult(
        name="MELD",
        score=meld,
        max_score=40,
        interpretation=f"MELD {meld}: 3-month mortality ~{mortality*100:.1f}%",
        mortality_estimate=mortality,
        source="Kamath et al., Hepatology 2001",
    )


def compute_cha2ds2_vasc(patient: PatientInput) -> Optional[ScoreResult]:
    """CHA₂DS₂-VASc score for stroke risk in atrial fibrillation.

    Lip et al., Chest, 2010.
    """
    comorbidities = set(patient.diagnosis.comorbidities)
    has_afib = "afib" in comorbidities or "atrial_fibrillation" in comorbidities

    if not has_afib:
        return None

    score = 0

    # CHF (+1)
    chf_terms = {"chf", "chf_hfref", "chf_hfpef", "heart_failure"}
    if comorbidities & chf_terms:
        score += 1

    # Hypertension (+1)
    if "hypertension" in comorbidities:
        score += 1

    # Age >= 75 (+2)
    if patient.demographics.age >= 75:
        score += 2
    elif patient.demographics.age >= 65:
        score += 1

    # Diabetes (+1)
    dm_terms = {"diabetes_type1", "diabetes_type2", "diabetes"}
    if comorbidities & dm_terms:
        score += 1

    # Stroke/TIA (+2)
    stroke_terms = {"stroke", "tia", "cerebrovascular_accident"}
    if comorbidities & stroke_terms:
        score += 2

    # Vascular disease (+1)
    vasc_terms = {"pad", "mi", "aortic_plaque", "peripheral_arterial_disease"}
    if comorbidities & vasc_terms:
        score += 1

    # Sex category: female (+1)
    if patient.demographics.sex.value == "female":
        score += 1

    # Annual stroke risk estimates
    stroke_risk_map = {
        0: 0.002, 1: 0.006, 2: 0.022, 3: 0.032,
        4: 0.040, 5: 0.067, 6: 0.098, 7: 0.112,
        8: 0.143, 9: 0.153,
    }
    risk = stroke_risk_map.get(min(score, 9), 0.153)

    return ScoreResult(
        name="CHA₂DS₂-VASc",
        score=score,
        max_score=9,
        interpretation=f"Annual stroke risk ~{risk*100:.1f}%",
        mortality_estimate=None,
        source="Lip et al., Chest 2010",
    )


def compute_curb65(patient: PatientInput) -> Optional[ScoreResult]:
    """CURB-65 for community-acquired pneumonia severity.

    Lim et al., Thorax, 2003.
    """
    pneumonia_terms = {"pneumonia", "cap", "community_acquired_pneumonia"}
    primary = patient.diagnosis.primary_diagnosis.lower()
    has_pneumonia = (
        set(patient.diagnosis.comorbidities) & pneumonia_terms
        or "pneumonia" in primary
    )
    if not has_pneumonia:
        return None

    score = 0

    # Confusion (GCS < 15 as proxy)
    if patient.vitals and patient.vitals.gcs_total is not None and patient.vitals.gcs_total < 15:
        score += 1

    # BUN > 19 mg/dL (7 mmol/L)
    if patient.labs and patient.labs.bun is not None and patient.labs.bun > 19:
        score += 1

    # Respiratory rate >= 30
    if patient.vitals and patient.vitals.respiratory_rate is not None and patient.vitals.respiratory_rate >= 30:
        score += 1

    # Blood pressure: systolic < 90 or diastolic <= 60
    if patient.vitals:
        if (patient.vitals.systolic_bp is not None and patient.vitals.systolic_bp < 90) or \
           (patient.vitals.diastolic_bp is not None and patient.vitals.diastolic_bp <= 60):
            score += 1

    # Age >= 65
    if patient.demographics.age >= 65:
        score += 1

    mortality_map = {0: 0.007, 1: 0.021, 2: 0.092, 3: 0.145, 4: 0.40, 5: 0.57}
    mortality = mortality_map.get(score, 0.57)

    return ScoreResult(
        name="CURB-65",
        score=score,
        max_score=5,
        interpretation=f"30-day mortality ~{mortality*100:.1f}%",
        mortality_estimate=mortality,
        source="Lim et al., Thorax 2003",
    )


def compute_all_applicable(patient: PatientInput) -> list[ScoreResult]:
    """Run all applicable scoring calculators for this patient."""
    calculators = [
        compute_sofa,
        compute_apache_ii,
        compute_meld,
        compute_cha2ds2_vasc,
        compute_curb65,
    ]
    results = []
    for calc in calculators:
        result = calc(patient)
        if result is not None:
            results.append(result)
    return results
