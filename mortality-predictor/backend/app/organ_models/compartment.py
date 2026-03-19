"""Simplified organ compartment models using ODE systems.

These are simplified physiological models that simulate organ function
trajectories over time based on patient state. They are NOT intended to
replace clinical judgment but to provide additional reasoning support.

Models implemented:
- Renal: Creatinine/GFR trajectory based on renal injury state
- Cardiac: Ejection fraction / cardiac output trajectory
- Hepatic: Bilirubin clearance / synthetic function trajectory
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.integrate import solve_ivp

from app.models.patient import OrganModelOutput, PatientInput


@dataclass
class OrganState:
    """Initial conditions derived from patient data."""
    value: float
    injury_severity: float  # 0 to 1 scale


def _classify_renal_injury(patient: PatientInput) -> OrganState:
    """Derive renal injury state from labs and interventions."""
    labs = patient.labs
    if not labs or labs.creatinine is None:
        return OrganState(value=1.0, injury_severity=0.0)

    cr = labs.creatinine
    # KDIGO AKI staging as injury severity proxy
    if cr >= 4.0:
        severity = 0.9
    elif cr >= 3.0:
        severity = 0.7
    elif cr >= 2.0:
        severity = 0.5
    elif cr >= 1.5:
        severity = 0.3
    elif cr >= 1.2:
        severity = 0.15
    else:
        severity = 0.0

    # Adjust for dialysis
    if patient.interventions and patient.interventions.on_dialysis:
        severity = min(severity + 0.2, 1.0)

    return OrganState(value=cr, injury_severity=severity)


def simulate_renal(patient: PatientInput, hours: int = 168) -> OrganModelOutput:
    """Simulate creatinine trajectory over time.

    Uses a simplified two-compartment model:
    - Creatinine production (constant, ~1.0 mg/dL/day baseline)
    - Renal clearance (depends on GFR which depends on injury severity)

    dCr/dt = production_rate - clearance_rate * Cr
    clearance_rate decreases with injury severity and may recover over time.
    """
    state = _classify_renal_injury(patient)
    cr0 = state.value
    severity = state.injury_severity

    production_rate = 0.042  # ~1.0 mg/dL/day in hourly terms
    baseline_clearance = 0.05  # Normal clearance coefficient
    impaired_clearance = baseline_clearance * (1 - severity * 0.85)

    # Recovery rate (slower if more severe)
    recovery_rate = 0.005 * (1 - severity * 0.7)

    def renal_ode(t, y):
        cr, clearance = y
        # Clearance slowly recovers toward baseline (or doesn't if severe)
        dclearance = recovery_rate * (baseline_clearance - clearance)
        dcr = production_rate - clearance * cr
        return [dcr, dclearance]

    t_span = (0, hours)
    t_eval = np.linspace(0, hours, min(hours, 168))
    y0 = [cr0, impaired_clearance]

    sol = solve_ivp(renal_ode, t_span, y0, t_eval=t_eval, method="RK45")

    cr_trajectory = np.clip(sol.y[0], 0.3, 15.0)

    # Determine summary
    final_cr = cr_trajectory[-1]
    if final_cr > cr0 * 1.1:
        summary = f"Creatinine projected to rise from {cr0:.1f} to {final_cr:.1f} mg/dL over {hours}h — worsening renal function."
    elif final_cr < cr0 * 0.9:
        summary = f"Creatinine projected to improve from {cr0:.1f} to {final_cr:.1f} mg/dL over {hours}h — renal recovery expected."
    else:
        summary = f"Creatinine projected to remain stable around {cr0:.1f} mg/dL over {hours}h."

    return OrganModelOutput(
        organ_system="renal",
        trajectory_hours=sol.t.tolist(),
        trajectory_values=cr_trajectory.tolist(),
        parameter_name="Serum Creatinine",
        parameter_unit="mg/dL",
        summary=summary,
    )


def _classify_cardiac_state(patient: PatientInput) -> OrganState:
    """Derive cardiac state from vitals and diagnosis."""
    vitals = patient.vitals
    comorbidities = set(patient.diagnosis.comorbidities)

    # Use MAP as proxy for cardiac output
    severity = 0.0
    value = 70.0  # Default MAP

    if vitals and vitals.mean_arterial_pressure is not None:
        value = vitals.mean_arterial_pressure
        if value < 55:
            severity = 0.8
        elif value < 65:
            severity = 0.5
        elif value < 70:
            severity = 0.2

    # Adjust for CHF
    chf_terms = {"chf", "chf_hfref", "chf_hfpef", "heart_failure"}
    if comorbidities & chf_terms:
        severity = min(severity + 0.2, 1.0)

    # Adjust for vasopressors
    if patient.interventions and patient.interventions.on_vasopressors:
        severity = min(severity + 0.15, 1.0)

    # Troponin elevation
    if patient.labs and patient.labs.troponin and patient.labs.troponin > 0.04:
        severity = min(severity + 0.15, 1.0)

    return OrganState(value=value, injury_severity=severity)


def simulate_cardiac(patient: PatientInput, hours: int = 72) -> OrganModelOutput:
    """Simulate cardiac output (MAP proxy) trajectory.

    Simplified model: MAP is driven by cardiac contractility and SVR,
    with vasopressor support providing transient augmentation.
    """
    state = _classify_cardiac_state(patient)
    map0 = state.value
    severity = state.injury_severity

    target_map = 75.0  # Physiological target
    on_pressors = patient.interventions and patient.interventions.on_vasopressors
    pressor_effect = 10.0 if on_pressors else 0.0

    # Cardiac recovery/deterioration rate
    intrinsic_rate = 0.02 * (1 - severity * 0.8)

    def cardiac_ode(t, y):
        current_map = y[0]
        # Pressor effect wanes as we simulate weaning
        pressor_wane = pressor_effect * max(0, 1 - t / (hours * 0.7))
        effective_target = target_map + pressor_wane
        # MAP moves toward target at intrinsic rate
        dmap = intrinsic_rate * (effective_target - current_map) - severity * 0.5
        return [dmap]

    t_span = (0, hours)
    t_eval = np.linspace(0, hours, min(hours, 72))
    y0 = [map0]

    sol = solve_ivp(cardiac_ode, t_span, y0, t_eval=t_eval, method="RK45")
    map_trajectory = np.clip(sol.y[0], 30, 140)

    final_map = map_trajectory[-1]
    if final_map < 60:
        summary = f"MAP projected to remain critically low (~{final_map:.0f} mmHg) — high risk of end-organ hypoperfusion."
    elif final_map < 70:
        summary = f"MAP projected around {final_map:.0f} mmHg — borderline perfusion pressure."
    else:
        summary = f"MAP projected to stabilize around {final_map:.0f} mmHg — adequate perfusion expected."

    return OrganModelOutput(
        organ_system="cardiac",
        trajectory_hours=sol.t.tolist(),
        trajectory_values=map_trajectory.tolist(),
        parameter_name="Mean Arterial Pressure",
        parameter_unit="mmHg",
        summary=summary,
    )


def _classify_hepatic_state(patient: PatientInput) -> OrganState:
    """Derive hepatic state from labs."""
    labs = patient.labs
    if not labs or labs.bilirubin_total is None:
        return OrganState(value=1.0, injury_severity=0.0)

    bili = labs.bilirubin_total
    severity = 0.0
    if bili >= 12:
        severity = 0.9
    elif bili >= 6:
        severity = 0.6
    elif bili >= 3:
        severity = 0.4
    elif bili >= 1.5:
        severity = 0.15

    # INR as synthetic function marker
    if labs.inr is not None and labs.inr > 1.5:
        severity = min(severity + 0.2, 1.0)

    # Albumin as chronic marker
    if labs.albumin is not None and labs.albumin < 2.5:
        severity = min(severity + 0.15, 1.0)

    # Cirrhosis
    if "cirrhosis" in set(patient.diagnosis.comorbidities):
        severity = min(severity + 0.2, 1.0)

    return OrganState(value=bili, injury_severity=severity)


def simulate_hepatic(patient: PatientInput, hours: int = 168) -> OrganModelOutput:
    """Simulate bilirubin trajectory as a proxy for hepatic function.

    Simplified model: bilirubin production is roughly constant,
    hepatic clearance depends on liver function severity.
    """
    state = _classify_hepatic_state(patient)
    bili0 = state.value
    severity = state.injury_severity

    production_rate = 0.012  # ~0.3 mg/dL/day
    baseline_clearance = 0.015
    impaired_clearance = baseline_clearance * (1 - severity * 0.9)

    recovery_rate = 0.003 * (1 - severity * 0.8)

    def hepatic_ode(t, y):
        bili, clearance = y
        dclearance = recovery_rate * (baseline_clearance - clearance)
        dbili = production_rate - clearance * bili
        return [dbili, dclearance]

    t_span = (0, hours)
    t_eval = np.linspace(0, hours, min(hours, 168))
    y0 = [bili0, impaired_clearance]

    sol = solve_ivp(hepatic_ode, t_span, y0, t_eval=t_eval, method="RK45")
    bili_trajectory = np.clip(sol.y[0], 0.1, 50.0)

    final_bili = bili_trajectory[-1]
    if final_bili > bili0 * 1.2:
        summary = f"Bilirubin projected to rise from {bili0:.1f} to {final_bili:.1f} mg/dL — worsening hepatic function."
    elif final_bili < bili0 * 0.8:
        summary = f"Bilirubin projected to improve from {bili0:.1f} to {final_bili:.1f} mg/dL — hepatic recovery."
    else:
        summary = f"Bilirubin projected to remain around {bili0:.1f} mg/dL — stable hepatic function."

    return OrganModelOutput(
        organ_system="hepatic",
        trajectory_hours=sol.t.tolist(),
        trajectory_values=bili_trajectory.tolist(),
        parameter_name="Total Bilirubin",
        parameter_unit="mg/dL",
        summary=summary,
    )


def run_organ_models(patient: PatientInput) -> list[OrganModelOutput]:
    """Run all applicable organ models for the patient."""
    models = []

    # Always run renal if creatinine available
    if patient.labs and patient.labs.creatinine is not None:
        models.append(simulate_renal(patient))

    # Always run cardiac if MAP or vitals available
    if patient.vitals and (
        patient.vitals.mean_arterial_pressure is not None
        or patient.vitals.heart_rate is not None
    ):
        models.append(simulate_cardiac(patient))

    # Run hepatic if bilirubin available
    if patient.labs and patient.labs.bilirubin_total is not None:
        models.append(simulate_hepatic(patient))

    return models
