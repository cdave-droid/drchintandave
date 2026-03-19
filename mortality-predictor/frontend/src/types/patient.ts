/* Patient data types — mirrors backend Pydantic models */

export type Sex = "male" | "female";
export type AdmissionType = "icu" | "floor" | "ed" | "outpatient";
export type VentMode = "none" | "nasal_cannula" | "high_flow" | "nippv" | "mechanical";

export interface Demographics {
  age: number;
  sex: Sex;
  bmi?: number;
  race_ethnicity?: string;
}

export interface Vitals {
  heart_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  mean_arterial_pressure?: number;
  respiratory_rate?: number;
  temperature?: number;
  spo2?: number;
  fio2?: number;
  gcs_total?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  urine_output_24h?: number;
}

export interface Labs {
  creatinine?: number;
  bun?: number;
  egfr?: number;
  potassium?: number;
  sodium?: number;
  bicarbonate?: number;
  bilirubin_total?: number;
  ast?: number;
  alt?: number;
  albumin?: number;
  inr?: number;
  hemoglobin?: number;
  hematocrit?: number;
  wbc?: number;
  platelets?: number;
  lactate?: number;
  glucose?: number;
  hba1c?: number;
  crp?: number;
  procalcitonin?: number;
  troponin?: number;
  bnp?: number;
  nt_pro_bnp?: number;
  ph?: number;
  pao2?: number;
  paco2?: number;
}

export interface Diagnosis {
  primary_diagnosis: string;
  icd10_codes: string[];
  comorbidities: string[];
  admission_type: AdmissionType;
  is_surgical: boolean;
  is_postoperative: boolean;
  days_since_admission?: number;
}

export interface Interventions {
  on_vasopressors: boolean;
  vasopressor_count: number;
  vasopressor_names: string[];
  ventilation_mode: VentMode;
  peep?: number;
  on_dialysis: boolean;
  dialysis_type?: string;
  on_ecmo: boolean;
  recent_surgery_within_72h: boolean;
  central_line: boolean;
  on_anticoagulation: boolean;
  on_antibiotics: boolean;
}

export interface PatientInput {
  demographics: Demographics;
  vitals?: Vitals;
  labs?: Labs;
  diagnosis: Diagnosis;
  interventions?: Interventions;
}

export type OutcomeType =
  | "mortality_30d"
  | "mortality_90d"
  | "mortality_1yr"
  | "need_for_dialysis"
  | "ventilator_dependence"
  | "cardiac_event"
  | "diabetes_complications"
  | "icu_length_of_stay"
  | "readmission_30d"
  | "functional_decline"
  | "aki_progression"
  | "hepatic_decompensation";

export interface PredictionRequest {
  patient: PatientInput;
  selected_outcomes: OutcomeType[];
}

export interface RiskFactor {
  factor_name: string;
  description: string;
  relative_risk: number;
  confidence: "high" | "moderate" | "low";
  source: string;
  source_url?: string;
  calculator_name?: string;
}

export interface OutcomePrediction {
  outcome_type: OutcomeType;
  probability_low: number;
  probability_mid: number;
  probability_high: number;
  baseline_probability: number;
  risk_factors: RiskFactor[];
  clinical_scores: Record<string, number>;
}

export interface OrganModelOutput {
  organ_system: string;
  trajectory_hours: number[];
  trajectory_values: number[];
  parameter_name: string;
  parameter_unit: string;
  summary: string;
}

export interface PredictionResponse {
  patient_summary: string;
  outcomes: OutcomePrediction[];
  organ_models: OrganModelOutput[];
  evidence_narrative: string;
  disclaimers: string[];
  clinical_scores_used: Record<string, number>;
}

export const OUTCOME_LABELS: Record<OutcomeType, string> = {
  mortality_30d: "30-Day Mortality",
  mortality_90d: "90-Day Mortality",
  mortality_1yr: "1-Year Mortality",
  need_for_dialysis: "Need for Dialysis",
  ventilator_dependence: "Ventilator Dependence",
  cardiac_event: "Cardiac Event",
  diabetes_complications: "Diabetes Complications",
  icu_length_of_stay: "Prolonged ICU Stay (>7d)",
  readmission_30d: "30-Day Readmission",
  functional_decline: "Functional Decline",
  aki_progression: "AKI Progression",
  hepatic_decompensation: "Hepatic Decompensation",
};

export const COMORBIDITY_OPTIONS = [
  { value: "diabetes_type1", label: "Diabetes Type 1" },
  { value: "diabetes_type2", label: "Diabetes Type 2" },
  { value: "hypertension", label: "Hypertension" },
  { value: "ckd_stage3", label: "CKD Stage 3" },
  { value: "ckd_stage4", label: "CKD Stage 4" },
  { value: "ckd_stage5", label: "CKD Stage 5 / ESRD" },
  { value: "chf", label: "Heart Failure (general)" },
  { value: "chf_hfref", label: "HFrEF (EF < 40%)" },
  { value: "chf_hfpef", label: "HFpEF (EF > 50%)" },
  { value: "copd", label: "COPD" },
  { value: "copd_severe", label: "COPD (Severe / GOLD III-IV)" },
  { value: "afib", label: "Atrial Fibrillation" },
  { value: "cirrhosis", label: "Cirrhosis" },
  { value: "stroke", label: "Prior Stroke / CVA" },
  { value: "tia", label: "Prior TIA" },
  { value: "mi", label: "Prior MI" },
  { value: "pad", label: "Peripheral Arterial Disease" },
  { value: "obesity", label: "Obesity (BMI > 30)" },
  { value: "malignancy", label: "Active Malignancy" },
  { value: "dementia", label: "Dementia" },
  { value: "immunocompromised", label: "Immunocompromised" },
  { value: "hepatitis_b", label: "Hepatitis B" },
  { value: "hepatitis_c", label: "Hepatitis C" },
] as const;
