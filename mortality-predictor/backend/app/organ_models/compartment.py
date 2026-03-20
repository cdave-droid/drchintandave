"""Patient-specific coupled organ compartment models using ODE systems.

Implements physiological models that simulate organ function trajectories
over time based on patient state, with cross-organ coupling for known
clinical syndromes (cardiorenal, hepatorenal, cardiohepatic).

Literature references:
- Cardiorenal syndrome: Ronco et al., JACC 2008
- Hepatorenal syndrome: Ginès et al., Hepatology 2003
- Congestive hepatopathy: Alvarez & Mukherjee, Heart Failure Clin 2011
- Renal-cardiac feedback: Hatamizadeh et al., Cardiorenal Med 2013
- Age-related GFR decline: Lindeman et al., J Am Geriatr Soc 1985
- Creatinine and mortality: Chertow et al., JASN 2005

Models:
- Renal: Creatinine trajectory with patient-specific clearance
- Cardiac: MAP trajectory with vasopressor pharmacodynamics
- Hepatic: Bilirubin trajectory with synthetic function markers
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.integrate import solve_ivp

from app.models.patient import OrganModelOutput, PatientInput


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sigmoid(x: float, midpoint: float, steepness: float) -> float:
    """Smooth sigmoid function mapping x to (0, 1).

    Returns ~0.5 at midpoint; steepness controls transition sharpness.
    """
    z = steepness * (x - midpoint)
    # Clamp to prevent overflow
    z = max(-20.0, min(20.0, z))
    return 1.0 / (1.0 + np.exp(-z))


def _comorbidity_set(patient: PatientInput) -> set[str]:
    return set(patient.diagnosis.comorbidities) if patient.diagnosis.comorbidities else set()


# ---------------------------------------------------------------------------
# Patient-specific parameter estimation
# ---------------------------------------------------------------------------

@dataclass
class RenalParams:
    """Patient-fitted renal model parameters."""
    cr0: float = 1.0
    severity: float = 0.0
    production_rate: float = 0.042
    baseline_clearance: float = 0.05
    impaired_clearance: float = 0.05
    recovery_rate: float = 0.005
    on_dialysis: bool = False


@dataclass
class CardiacParams:
    """Patient-fitted cardiac model parameters."""
    map0: float = 70.0
    severity: float = 0.0
    target_map: float = 75.0
    intrinsic_rate: float = 0.02
    pressor_effect: float = 0.0
    deterioration: float = 0.0
    on_pressors: bool = False


@dataclass
class HepaticParams:
    """Patient-fitted hepatic model parameters."""
    bili0: float = 1.0
    severity: float = 0.0
    production_rate: float = 0.012
    baseline_clearance: float = 0.015
    impaired_clearance: float = 0.015
    recovery_rate: float = 0.003


@dataclass
class CouplingState:
    """Tracks which cross-organ interactions are active."""
    cardiorenal: bool = False
    hepatorenal: bool = False
    cardiohepatic: bool = False
    renal_cardiac: bool = False

    def active_effects(self) -> list[str]:
        effects = []
        if self.cardiorenal:
            effects.append("Cardiorenal syndrome")
        if self.hepatorenal:
            effects.append("Hepatorenal syndrome")
        if self.cardiohepatic:
            effects.append("Congestive hepatopathy")
        if self.renal_cardiac:
            effects.append("Renal-cardiac depression")
        return effects


def _fit_renal_params(patient: PatientInput) -> RenalParams:
    """Derive patient-specific renal parameters from demographics, labs, comorbidities."""
    params = RenalParams()
    labs = patient.labs
    comorbidities = _comorbidity_set(patient)
    age = patient.demographics.age

    # Initial creatinine
    if labs and labs.creatinine is not None:
        params.cr0 = labs.creatinine
    else:
        return params  # No renal data

    # --- Severity classification (enhanced KDIGO) ---
    cr = params.cr0
    if cr >= 4.0:
        params.severity = 0.9
    elif cr >= 3.0:
        params.severity = 0.7
    elif cr >= 2.0:
        params.severity = 0.5
    elif cr >= 1.5:
        params.severity = 0.3
    elif cr >= 1.2:
        params.severity = 0.15
    else:
        params.severity = 0.0

    if patient.interventions and patient.interventions.on_dialysis:
        params.severity = min(params.severity + 0.2, 1.0)
        params.on_dialysis = True

    # --- Patient-specific parameter adjustments ---

    # Age: GFR declines ~1 mL/min/yr after 40 (Lindeman 1985)
    age_factor = max(0.3, 1.0 - max(0, age - 40) * 0.008) if age > 40 else 1.0
    params.baseline_clearance *= age_factor

    # CKD stage: reduced baseline clearance capacity
    if "ckd_stage5" in comorbidities or "ckd_stage5_nondialysis" in comorbidities:
        params.baseline_clearance *= 0.10
    elif "ckd_stage4" in comorbidities:
        params.baseline_clearance *= 0.25
    elif "ckd_stage3" in comorbidities or "ckd_stage3a" in comorbidities or "ckd_stage3b" in comorbidities:
        params.baseline_clearance *= 0.50

    # BMI: higher muscle mass → higher creatinine production
    if patient.demographics.bmi:
        bmi_factor = max(0.7, min(1.5, patient.demographics.bmi / 25.0))
        params.production_rate *= bmi_factor

    # Diabetes: accelerated nephropathy progression
    if comorbidities & {"diabetes_type1", "diabetes_type2"}:
        params.production_rate *= 1.15
        params.recovery_rate *= 0.8

    # Sepsis/infection markers: impaired recovery
    if labs and labs.lactate is not None and labs.lactate > 2.0:
        params.recovery_rate *= 0.5
    if labs and labs.procalcitonin is not None and labs.procalcitonin > 0.5:
        params.recovery_rate *= 0.7

    # Low urine output: suggests ongoing injury
    if patient.vitals and patient.vitals.urine_output_24h is not None:
        if patient.vitals.urine_output_24h < 400:
            params.severity = min(params.severity + 0.15, 1.0)

    # Apply severity to clearance and recovery
    params.impaired_clearance = params.baseline_clearance * (1 - params.severity * 0.85)
    params.recovery_rate = params.recovery_rate * (1 - params.severity * 0.7)

    return params


def _fit_cardiac_params(patient: PatientInput) -> CardiacParams:
    """Derive patient-specific cardiac parameters."""
    params = CardiacParams()
    comorbidities = _comorbidity_set(patient)
    age = patient.demographics.age

    # Initial MAP
    if patient.vitals and patient.vitals.mean_arterial_pressure is not None:
        params.map0 = patient.vitals.mean_arterial_pressure
    elif patient.vitals and patient.vitals.systolic_bp and patient.vitals.diastolic_bp:
        # Calculate MAP from SBP/DBP
        params.map0 = patient.vitals.diastolic_bp + (patient.vitals.systolic_bp - patient.vitals.diastolic_bp) / 3.0

    # --- Severity classification ---
    if params.map0 < 55:
        params.severity = 0.8
    elif params.map0 < 65:
        params.severity = 0.5
    elif params.map0 < 70:
        params.severity = 0.2

    # CHF subtype differentiation
    chf_hfref = comorbidities & {"chf_hfref", "heart_failure_reduced"}
    chf_hfpef = comorbidities & {"chf_hfpef", "heart_failure_preserved"}
    chf_general = comorbidities & {"chf", "heart_failure"}

    if chf_hfref:
        params.severity = min(params.severity + 0.25, 1.0)
    elif chf_hfpef:
        params.severity = min(params.severity + 0.15, 1.0)
    elif chf_general:
        params.severity = min(params.severity + 0.2, 1.0)

    # Vasopressor dose-response (graded by count)
    if patient.interventions and patient.interventions.on_vasopressors:
        params.on_pressors = True
        count = max(patient.interventions.vasopressor_count, 1)
        params.pressor_effect = 8.0 + count * 4.0
        params.severity = min(params.severity + 0.15, 1.0)

    # Troponin elevation
    if patient.labs and patient.labs.troponin and patient.labs.troponin > 0.04:
        params.severity = min(params.severity + 0.15, 1.0)

    # BNP/NT-proBNP: myocardial strain marker
    labs = patient.labs
    if labs:
        if (labs.bnp is not None and labs.bnp > 400) or (labs.nt_pro_bnp is not None and labs.nt_pro_bnp > 900):
            params.severity = min(params.severity + 0.1, 1.0)

    # --- Patient-specific adjustments ---

    # Age-adjusted target MAP (older patients have higher resting MAP)
    params.target_map = 65.0 + age * 0.12

    # Intrinsic recovery rate adjusted for CHF subtype
    if chf_hfref:
        params.intrinsic_rate = 0.02 * 0.5 * (1 - params.severity * 0.8)
    elif chf_hfpef:
        params.intrinsic_rate = 0.02 * 0.8 * (1 - params.severity * 0.8)
    else:
        params.intrinsic_rate = 0.02 * (1 - params.severity * 0.8)

    # Lactate > 4: tissue hypoperfusion → additional deterioration
    if labs and labs.lactate is not None and labs.lactate > 4.0:
        params.deterioration = 0.3 * min(labs.lactate / 4.0, 3.0)

    return params


def _fit_hepatic_params(patient: PatientInput) -> HepaticParams:
    """Derive patient-specific hepatic parameters."""
    params = HepaticParams()
    labs = patient.labs
    comorbidities = _comorbidity_set(patient)
    age = patient.demographics.age

    if not labs or labs.bilirubin_total is None:
        return params

    params.bili0 = labs.bilirubin_total

    # --- Severity classification ---
    bili = params.bili0
    if bili >= 12:
        params.severity = 0.9
    elif bili >= 6:
        params.severity = 0.6
    elif bili >= 3:
        params.severity = 0.4
    elif bili >= 1.5:
        params.severity = 0.15

    # INR as synthetic function marker
    if labs.inr is not None and labs.inr > 1.5:
        inr_bump = min(0.3, (labs.inr - 1.5) * 0.1)
        params.severity = min(params.severity + inr_bump, 1.0)

    # Albumin as chronic marker
    if labs.albumin is not None and labs.albumin < 2.5:
        params.severity = min(params.severity + 0.15, 1.0)

    # Cirrhosis
    if "cirrhosis" in comorbidities:
        params.severity = min(params.severity + 0.2, 1.0)

    # --- Patient-specific adjustments ---

    # Age: hepatic clearance declines ~1%/yr after 50
    age_factor = max(0.5, 1.0 - max(0, age - 50) * 0.01) if age > 50 else 1.0
    params.baseline_clearance *= age_factor

    # AST/ALT elevation: acute hepatocellular injury
    if labs.ast is not None and labs.ast > 200:
        params.production_rate *= 1.5
    elif labs.alt is not None and labs.alt > 200:
        params.production_rate *= 1.3

    # Low albumin: chronic dysfunction → slower recovery
    if labs.albumin is not None and labs.albumin < 3.0:
        recovery_reduction = max(0.3, labs.albumin / 3.0)
        params.recovery_rate *= recovery_reduction

    # Sepsis markers: hepatic dysfunction in sepsis
    if labs.lactate is not None and labs.lactate > 2.0:
        params.recovery_rate *= 0.6

    # Apply severity
    params.impaired_clearance = params.baseline_clearance * (1 - params.severity * 0.9)
    params.recovery_rate = params.recovery_rate * (1 - params.severity * 0.8)

    return params


# ---------------------------------------------------------------------------
# Coupled ODE System
# ---------------------------------------------------------------------------

def _detect_coupling(
    renal: RenalParams,
    cardiac: CardiacParams,
    hepatic: HepaticParams,
    patient: PatientInput,
) -> CouplingState:
    """Determine which cross-organ interactions are clinically relevant."""
    coupling = CouplingState()
    comorbidities = _comorbidity_set(patient)

    # Cardiorenal: low MAP threatens renal perfusion
    if cardiac.map0 < 70 or cardiac.severity > 0.3:
        coupling.cardiorenal = True

    # Hepatorenal: liver failure → renal vasoconstriction
    if hepatic.severity > 0.4 or "cirrhosis" in comorbidities:
        coupling.hepatorenal = True

    # Cardiohepatic: low MAP → congestive hepatopathy
    if cardiac.map0 < 65 or (cardiac.severity > 0.4 and hepatic.bili0 > 1.5):
        coupling.cardiohepatic = True

    # Renal-cardiac: uremia depresses myocardium
    if renal.cr0 > 3.0 or renal.severity > 0.6:
        coupling.renal_cardiac = True

    return coupling


def simulate_coupled_organs(
    patient: PatientInput,
    hours: int = 168,
) -> list[OrganModelOutput]:
    """Simulate all organ systems as a coupled ODE system.

    State vector y = [creatinine, renal_clearance, MAP, bilirubin, hepatic_clearance]

    Cross-organ coupling terms:
    - Cardiorenal: MAP → renal clearance (Ronco et al., JACC 2008)
    - Hepatorenal: bilirubin/hepatic severity → renal clearance (Ginès et al., 2003)
    - Cardiohepatic: MAP → hepatic clearance (Alvarez & Mukherjee, 2011)
    - Renal-cardiac: creatinine → MAP depression (Hatamizadeh et al., 2013)
    """
    renal_p = _fit_renal_params(patient)
    cardiac_p = _fit_cardiac_params(patient)
    hepatic_p = _fit_hepatic_params(patient)
    coupling = _detect_coupling(renal_p, cardiac_p, hepatic_p, patient)

    has_renal = patient.labs and patient.labs.creatinine is not None
    has_cardiac = patient.vitals and (
        patient.vitals.mean_arterial_pressure is not None
        or patient.vitals.heart_rate is not None
        or patient.vitals.systolic_bp is not None
    )
    has_hepatic = patient.labs and patient.labs.bilirubin_total is not None

    # If fewer than 2 organ systems have data, fall back to independent models
    organ_count = sum([has_renal, has_cardiac, has_hepatic])
    if organ_count < 2:
        return _run_independent_models(patient, renal_p, cardiac_p, hepatic_p)

    # --- Build coupled ODE ---
    pressor_hours = hours * 0.7  # vasopressors wane over 70% of simulation

    def coupled_ode(t, y):
        cr, renal_cl, map_val, bili, hepatic_cl = y

        # --- Coupling modifiers ---
        renal_coupling = 1.0
        hepatic_coupling = 1.0
        cardiac_coupling = 0.0

        # Cardiorenal: low MAP reduces renal perfusion
        if coupling.cardiorenal:
            # Sigmoid centered at MAP=65: below 65 → renal clearance drops
            renal_coupling *= _sigmoid(map_val, midpoint=65, steepness=0.15)

        # Hepatorenal: high bilirubin → renal vasoconstriction
        if coupling.hepatorenal:
            # Bilirubin > 6 starts to meaningfully impair renal clearance
            hepatic_impact = max(0.3, 1.0 - max(0, bili - 3.0) * 0.07)
            renal_coupling *= hepatic_impact

        # Cardiohepatic: low MAP → hepatic congestion
        if coupling.cardiohepatic:
            hepatic_coupling *= _sigmoid(map_val, midpoint=60, steepness=0.12)

        # Renal-cardiac: uremia depresses myocardium
        if coupling.renal_cardiac:
            cardiac_coupling = -0.3 * max(0, cr - 3.0)

        # --- Renal ODE ---
        effective_renal_cl = renal_cl * renal_coupling
        dcr = renal_p.production_rate - effective_renal_cl * cr
        drenal_cl = renal_p.recovery_rate * (renal_p.baseline_clearance - renal_cl)

        # --- Cardiac ODE ---
        pressor_wane = cardiac_p.pressor_effect * max(0, 1 - t / pressor_hours) if cardiac_p.on_pressors else 0.0
        effective_target = cardiac_p.target_map + pressor_wane
        dmap = (
            cardiac_p.intrinsic_rate * (effective_target - map_val)
            - cardiac_p.severity * 0.5
            - cardiac_p.deterioration
            + cardiac_coupling  # uremia depression
        )

        # --- Hepatic ODE ---
        effective_hepatic_cl = hepatic_cl * hepatic_coupling
        dbili = hepatic_p.production_rate - effective_hepatic_cl * bili
        dhepatic_cl = hepatic_p.recovery_rate * (hepatic_p.baseline_clearance - hepatic_cl)

        return [dcr, drenal_cl, dmap, dbili, dhepatic_cl]

    # Initial conditions
    y0 = [
        renal_p.cr0,
        renal_p.impaired_clearance,
        cardiac_p.map0,
        hepatic_p.bili0,
        hepatic_p.impaired_clearance,
    ]

    t_span = (0, hours)
    n_points = min(hours, 168)
    t_eval = np.linspace(0, hours, n_points)

    sol = solve_ivp(coupled_ode, t_span, y0, t_eval=t_eval, method="RK45", max_step=1.0)

    if not sol.success:
        # Fallback to independent models on solver failure
        return _run_independent_models(patient, renal_p, cardiac_p, hepatic_p)

    # Extract trajectories with physiological clipping
    cr_traj = np.clip(sol.y[0], 0.3, 15.0)
    map_traj = np.clip(sol.y[2], 30.0, 140.0)
    bili_traj = np.clip(sol.y[3], 0.1, 50.0)
    times = sol.t.tolist()

    coupling_effects = coupling.active_effects()

    outputs: list[OrganModelOutput] = []

    # --- Renal output ---
    if has_renal:
        outputs.append(_build_renal_output(
            times, cr_traj, renal_p, coupling_effects if (coupling.cardiorenal or coupling.hepatorenal) else None,
        ))

    # --- Cardiac output (use first 72h of trajectory) ---
    if has_cardiac:
        cardiac_hours = min(72, hours)
        cardiac_mask = sol.t <= cardiac_hours
        outputs.append(_build_cardiac_output(
            sol.t[cardiac_mask].tolist(),
            map_traj[cardiac_mask],
            cardiac_p,
            coupling_effects if coupling.renal_cardiac else None,
        ))

    # --- Hepatic output ---
    if has_hepatic:
        outputs.append(_build_hepatic_output(
            times, bili_traj, hepatic_p,
            coupling_effects if (coupling.cardiohepatic or coupling.hepatorenal) else None,
        ))

    return outputs


# ---------------------------------------------------------------------------
# Output builders
# ---------------------------------------------------------------------------

def _classify_trend(initial: float, final: float, threshold: float = 0.1) -> str:
    if final > initial * (1 + threshold):
        return "worsening"
    elif final < initial * (1 - threshold):
        return "improving"
    return "stable"


def _build_renal_output(
    times: list[float],
    cr_traj: np.ndarray,
    params: RenalParams,
    coupling_effects: list[str] | None,
) -> OrganModelOutput:
    final_cr = float(cr_traj[-1])
    peak_cr = float(np.max(cr_traj))
    trend = _classify_trend(params.cr0, final_cr)
    hours = times[-1]

    if trend == "worsening":
        summary = f"Creatinine projected to rise from {params.cr0:.1f} to {final_cr:.1f} mg/dL over {hours:.0f}h — worsening renal function."
    elif trend == "improving":
        summary = f"Creatinine projected to improve from {params.cr0:.1f} to {final_cr:.1f} mg/dL over {hours:.0f}h — renal recovery expected."
    else:
        summary = f"Creatinine projected to remain stable around {params.cr0:.1f} mg/dL over {hours:.0f}h."

    if coupling_effects:
        summary += f" Cross-organ effects active: {', '.join(coupling_effects)}."

    return OrganModelOutput(
        organ_system="renal",
        trajectory_hours=times,
        trajectory_values=cr_traj.tolist(),
        parameter_name="Serum Creatinine",
        parameter_unit="mg/dL",
        summary=summary,
        severity_score=round(params.severity, 2),
        peak_value=round(peak_cr, 2),
        trend=trend,
        coupling_effects=coupling_effects,
    )


def _build_cardiac_output(
    times: list[float],
    map_traj: np.ndarray,
    params: CardiacParams,
    coupling_effects: list[str] | None,
) -> OrganModelOutput:
    final_map = float(map_traj[-1])
    min_map = float(np.min(map_traj))
    trend = "worsening" if final_map < params.map0 * 0.95 else ("improving" if final_map > params.map0 * 1.05 else "stable")

    if final_map < 55:
        summary = f"MAP projected at ~{final_map:.0f} mmHg — refractory shock, high risk of end-organ failure."
    elif final_map < 60:
        summary = f"MAP projected to remain critically low (~{final_map:.0f} mmHg) — high risk of end-organ hypoperfusion."
    elif final_map < 70:
        summary = f"MAP projected around {final_map:.0f} mmHg — borderline perfusion pressure."
    else:
        summary = f"MAP projected to stabilize around {final_map:.0f} mmHg — adequate perfusion expected."

    if coupling_effects:
        summary += f" Cross-organ effects active: {', '.join(coupling_effects)}."

    return OrganModelOutput(
        organ_system="cardiac",
        trajectory_hours=times,
        trajectory_values=map_traj.tolist(),
        parameter_name="Mean Arterial Pressure",
        parameter_unit="mmHg",
        summary=summary,
        severity_score=round(params.severity, 2),
        peak_value=round(min_map, 2),  # For MAP, "peak" = worst = minimum
        trend=trend,
        coupling_effects=coupling_effects,
    )


def _build_hepatic_output(
    times: list[float],
    bili_traj: np.ndarray,
    params: HepaticParams,
    coupling_effects: list[str] | None,
) -> OrganModelOutput:
    final_bili = float(bili_traj[-1])
    peak_bili = float(np.max(bili_traj))
    trend = _classify_trend(params.bili0, final_bili, threshold=0.2)
    hours = times[-1]

    if trend == "worsening":
        summary = f"Bilirubin projected to rise from {params.bili0:.1f} to {final_bili:.1f} mg/dL — worsening hepatic function."
    elif trend == "improving":
        summary = f"Bilirubin projected to improve from {params.bili0:.1f} to {final_bili:.1f} mg/dL — hepatic recovery."
    else:
        summary = f"Bilirubin projected to remain around {params.bili0:.1f} mg/dL — stable hepatic function."

    if coupling_effects:
        summary += f" Cross-organ effects active: {', '.join(coupling_effects)}."

    return OrganModelOutput(
        organ_system="hepatic",
        trajectory_hours=times,
        trajectory_values=bili_traj.tolist(),
        parameter_name="Total Bilirubin",
        parameter_unit="mg/dL",
        summary=summary,
        severity_score=round(params.severity, 2),
        peak_value=round(peak_bili, 2),
        trend=trend,
        coupling_effects=coupling_effects,
    )


# ---------------------------------------------------------------------------
# Independent (fallback) models — used when < 2 organ systems have data
# ---------------------------------------------------------------------------

def _run_independent_models(
    patient: PatientInput,
    renal_p: RenalParams,
    cardiac_p: CardiacParams,
    hepatic_p: HepaticParams,
) -> list[OrganModelOutput]:
    """Run organ models independently (no coupling)."""
    outputs: list[OrganModelOutput] = []

    if patient.labs and patient.labs.creatinine is not None:
        outputs.append(_simulate_renal_independent(renal_p))

    if patient.vitals and (
        patient.vitals.mean_arterial_pressure is not None
        or patient.vitals.heart_rate is not None
        or patient.vitals.systolic_bp is not None
    ):
        outputs.append(_simulate_cardiac_independent(cardiac_p))

    if patient.labs and patient.labs.bilirubin_total is not None:
        outputs.append(_simulate_hepatic_independent(hepatic_p))

    return outputs


def _simulate_renal_independent(p: RenalParams, hours: int = 168) -> OrganModelOutput:
    def ode(t, y):
        cr, clearance = y
        dclearance = p.recovery_rate * (p.baseline_clearance - clearance)
        dcr = p.production_rate - clearance * cr
        return [dcr, dclearance]

    t_eval = np.linspace(0, hours, min(hours, 168))
    sol = solve_ivp(ode, (0, hours), [p.cr0, p.impaired_clearance], t_eval=t_eval, method="RK45")
    cr_traj = np.clip(sol.y[0], 0.3, 15.0)
    return _build_renal_output(sol.t.tolist(), cr_traj, p, None)


def _simulate_cardiac_independent(p: CardiacParams, hours: int = 72) -> OrganModelOutput:
    pressor_hours = hours * 0.7

    def ode(t, y):
        map_val = y[0]
        pressor_wane = p.pressor_effect * max(0, 1 - t / pressor_hours) if p.on_pressors else 0.0
        effective_target = p.target_map + pressor_wane
        dmap = p.intrinsic_rate * (effective_target - map_val) - p.severity * 0.5 - p.deterioration
        return [dmap]

    t_eval = np.linspace(0, hours, min(hours, 72))
    sol = solve_ivp(ode, (0, hours), [p.map0], t_eval=t_eval, method="RK45")
    map_traj = np.clip(sol.y[0], 30, 140)
    return _build_cardiac_output(sol.t.tolist(), map_traj, p, None)


def _simulate_hepatic_independent(p: HepaticParams, hours: int = 168) -> OrganModelOutput:
    def ode(t, y):
        bili, clearance = y
        dclearance = p.recovery_rate * (p.baseline_clearance - clearance)
        dbili = p.production_rate - clearance * bili
        return [dbili, dclearance]

    t_eval = np.linspace(0, hours, min(hours, 168))
    sol = solve_ivp(ode, (0, hours), [p.bili0, p.impaired_clearance], t_eval=t_eval, method="RK45")
    bili_traj = np.clip(sol.y[0], 0.1, 50.0)
    return _build_hepatic_output(sol.t.tolist(), bili_traj, p, None)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_organ_models(patient: PatientInput) -> list[OrganModelOutput]:
    """Run all applicable organ models for the patient.

    Uses coupled simulation when 2+ organ systems have data,
    falls back to independent models otherwise.
    """
    return simulate_coupled_organs(patient)
