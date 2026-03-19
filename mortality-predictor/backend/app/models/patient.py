"""Patient data models for mortality prediction."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"


class AdmissionType(str, Enum):
    ICU = "icu"
    FLOOR = "floor"
    ED = "ed"
    OUTPATIENT = "outpatient"


class VentMode(str, Enum):
    NONE = "none"
    NASAL_CANNULA = "nasal_cannula"
    HIGH_FLOW = "high_flow"
    NIPPV = "nippv"
    MECHANICAL = "mechanical"


class Demographics(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    sex: Sex
    bmi: Optional[float] = Field(None, ge=10, le=80)
    race_ethnicity: Optional[str] = None


class Vitals(BaseModel):
    heart_rate: Optional[float] = Field(None, ge=20, le=300, description="bpm")
    systolic_bp: Optional[float] = Field(None, ge=40, le=300, description="mmHg")
    diastolic_bp: Optional[float] = Field(None, ge=20, le=200, description="mmHg")
    mean_arterial_pressure: Optional[float] = Field(None, ge=20, le=250, description="mmHg")
    respiratory_rate: Optional[float] = Field(None, ge=4, le=60, description="breaths/min")
    temperature: Optional[float] = Field(None, ge=30, le=45, description="Celsius")
    spo2: Optional[float] = Field(None, ge=50, le=100, description="Percent")
    fio2: Optional[float] = Field(None, ge=0.21, le=1.0, description="Fraction")
    gcs_total: Optional[int] = Field(None, ge=3, le=15, description="Glasgow Coma Scale")
    gcs_eye: Optional[int] = Field(None, ge=1, le=4)
    gcs_verbal: Optional[int] = Field(None, ge=1, le=5)
    gcs_motor: Optional[int] = Field(None, ge=1, le=6)
    urine_output_24h: Optional[float] = Field(None, ge=0, description="mL/24h")


class Labs(BaseModel):
    # Renal
    creatinine: Optional[float] = Field(None, ge=0, description="mg/dL")
    bun: Optional[float] = Field(None, ge=0, description="mg/dL")
    egfr: Optional[float] = Field(None, ge=0, description="mL/min/1.73m²")
    potassium: Optional[float] = Field(None, ge=1, le=10, description="mEq/L")
    sodium: Optional[float] = Field(None, ge=100, le=180, description="mEq/L")
    bicarbonate: Optional[float] = Field(None, ge=5, le=50, description="mEq/L")

    # Hepatic
    bilirubin_total: Optional[float] = Field(None, ge=0, description="mg/dL")
    ast: Optional[float] = Field(None, ge=0, description="U/L")
    alt: Optional[float] = Field(None, ge=0, description="U/L")
    albumin: Optional[float] = Field(None, ge=0, le=7, description="g/dL")
    inr: Optional[float] = Field(None, ge=0.5, le=20)

    # Hematologic
    hemoglobin: Optional[float] = Field(None, ge=2, le=25, description="g/dL")
    hematocrit: Optional[float] = Field(None, ge=10, le=70, description="Percent")
    wbc: Optional[float] = Field(None, ge=0, le=200, description="×10³/µL")
    platelets: Optional[float] = Field(None, ge=0, le=2000, description="×10³/µL")

    # Metabolic / Inflammatory
    lactate: Optional[float] = Field(None, ge=0, description="mmol/L")
    glucose: Optional[float] = Field(None, ge=20, le=1000, description="mg/dL")
    hba1c: Optional[float] = Field(None, ge=3, le=20, description="Percent")
    crp: Optional[float] = Field(None, ge=0, description="mg/L")
    procalcitonin: Optional[float] = Field(None, ge=0, description="ng/mL")

    # Cardiac
    troponin: Optional[float] = Field(None, ge=0, description="ng/mL")
    bnp: Optional[float] = Field(None, ge=0, description="pg/mL")
    nt_pro_bnp: Optional[float] = Field(None, ge=0, description="pg/mL")

    # ABG
    ph: Optional[float] = Field(None, ge=6.5, le=8.0)
    pao2: Optional[float] = Field(None, ge=20, le=600, description="mmHg")
    paco2: Optional[float] = Field(None, ge=10, le=120, description="mmHg")


class Diagnosis(BaseModel):
    primary_diagnosis: str = Field(..., description="Primary diagnosis or chief complaint")
    icd10_codes: list[str] = Field(default_factory=list)
    comorbidities: list[str] = Field(
        default_factory=list,
        description="e.g. ['diabetes_type2', 'ckd_stage3', 'chf_hfref', 'copd', 'afib', 'cirrhosis']",
    )
    admission_type: AdmissionType = AdmissionType.FLOOR
    is_surgical: bool = False
    is_postoperative: bool = False
    days_since_admission: Optional[int] = Field(None, ge=0)


class Interventions(BaseModel):
    on_vasopressors: bool = False
    vasopressor_count: int = Field(0, ge=0, le=5)
    vasopressor_names: list[str] = Field(default_factory=list)
    ventilation_mode: VentMode = VentMode.NONE
    peep: Optional[float] = Field(None, ge=0, le=30, description="cmH2O")
    on_dialysis: bool = False
    dialysis_type: Optional[str] = None  # "HD", "CRRT", "PD"
    on_ecmo: bool = False
    recent_surgery_within_72h: bool = False
    central_line: bool = False
    on_anticoagulation: bool = False
    on_antibiotics: bool = False


class PatientInput(BaseModel):
    """Complete patient input for mortality prediction."""

    demographics: Demographics
    vitals: Optional[Vitals] = None
    labs: Optional[Labs] = None
    diagnosis: Diagnosis
    interventions: Optional[Interventions] = None


class OutcomeType(str, Enum):
    MORTALITY_30D = "mortality_30d"
    MORTALITY_90D = "mortality_90d"
    MORTALITY_1YR = "mortality_1yr"
    NEED_FOR_DIALYSIS = "need_for_dialysis"
    VENTILATOR_DEPENDENCE = "ventilator_dependence"
    CARDIAC_EVENT = "cardiac_event"
    DIABETES_COMPLICATIONS = "diabetes_complications"
    ICU_LOS = "icu_length_of_stay"
    READMISSION_30D = "readmission_30d"
    FUNCTIONAL_DECLINE = "functional_decline"
    AKI_PROGRESSION = "aki_progression"
    HEPATIC_DECOMPENSATION = "hepatic_decompensation"


class PredictionRequest(BaseModel):
    patient: PatientInput
    selected_outcomes: list[OutcomeType] = Field(
        default_factory=lambda: [
            OutcomeType.MORTALITY_30D,
            OutcomeType.MORTALITY_90D,
            OutcomeType.MORTALITY_1YR,
        ],
    )


class RiskFactor(BaseModel):
    """A single evidence-backed risk factor contributing to the prediction."""

    factor_name: str
    description: str
    relative_risk: float = Field(..., description="Relative risk multiplier (1.0 = no change)")
    confidence: str = Field(..., description="high, moderate, or low")
    source: str = Field(..., description="Citation or source")
    source_url: Optional[str] = None
    calculator_name: Optional[str] = Field(None, description="e.g. 'SOFA', 'APACHE II'")


class OutcomePrediction(BaseModel):
    """Prediction for a single outcome."""

    outcome_type: OutcomeType
    probability_low: float = Field(..., ge=0, le=1, description="Lower bound")
    probability_mid: float = Field(..., ge=0, le=1, description="Point estimate")
    probability_high: float = Field(..., ge=0, le=1, description="Upper bound")
    baseline_probability: float = Field(..., ge=0, le=1, description="Baseline for cohort")
    risk_factors: list[RiskFactor] = Field(default_factory=list)
    clinical_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Validated scores used, e.g. {'SOFA': 8, 'APACHE_II': 22}",
    )


class OrganModelOutput(BaseModel):
    """Output from a simplified organ compartment model."""

    organ_system: str
    trajectory_hours: list[float] = Field(default_factory=list)
    trajectory_values: list[float] = Field(default_factory=list)
    parameter_name: str
    parameter_unit: str
    summary: str


class PredictionResponse(BaseModel):
    """Full prediction response returned to the frontend."""

    patient_summary: str
    outcomes: list[OutcomePrediction]
    organ_models: list[OrganModelOutput] = Field(default_factory=list)
    evidence_narrative: str = ""
    disclaimers: list[str] = Field(default_factory=list)
    clinical_scores_used: dict[str, float] = Field(default_factory=dict)
