"""LLM-agnostic research agent for evidence-based mortality factor review.

This module defines the agent interface and a concrete implementation
that uses any OpenAI-compatible or Anthropic-compatible LLM API to:
1. Analyze patient factors against known mortality predictors
2. Cite evidence from clinical literature
3. Generate structured risk factor assessments

The agent is designed to be swappable — configure via environment variables.
"""

from __future__ import annotations

import json
import os
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from app.models.patient import PatientInput, RiskFactor


class ResearchAgent(ABC):
    """Abstract base class for the mortality research agent."""

    @abstractmethod
    async def analyze_mortality_factors(
        self,
        patient: PatientInput,
        clinical_scores: dict[str, float],
    ) -> tuple[list[RiskFactor], str]:
        """Analyze patient data and return risk factors + narrative summary.

        Returns:
            Tuple of (list of RiskFactors, narrative evidence summary)
        """
        ...


# ---------------------------------------------------------------------------
# System prompt shared by all LLM-backed agents
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a clinical evidence research agent. Given patient data and clinical scores,
you must identify evidence-backed risk factors that affect mortality and other outcomes.

For each risk factor you identify:
1. Name it clearly (e.g., "Elevated Lactate", "Age > 75", "SOFA score > 10")
2. Provide the relative risk multiplier (e.g., 1.5 means 50% increased risk)
3. Rate your confidence: "high" (meta-analyses, large RCTs), "moderate" (cohort studies), or "low" (case series, expert opinion)
4. Cite the source (journal, year, first author if known)
5. Note the relevant clinical calculator if applicable
6. IMPORTANT — specify the exact outcome timeframe the evidence was assessed at (e.g., "30-day", "In-hospital",
   "90-day", "1-year", "Long-term (5+ year)"). This must reflect the actual study endpoint, not the requested
   prediction horizon. If the original study used in-hospital or 30-day mortality, say so even if the user
   wants a 1-year estimate.

You MUST respond with valid JSON in this exact format:
{
  "risk_factors": [
    {
      "factor_name": "string",
      "description": "string",
      "relative_risk": number,
      "confidence": "high|moderate|low",
      "source": "string",
      "source_url": "string or null",
      "calculator_name": "string or null",
      "evidence_timeframe": "string — the period the RR/OR was measured at in the source study",
      "primary_finding": "string — the exact statistic from the paper, e.g. 'HR 1.46 (95% CI 1.39–1.54, p<0.001)' or 'OR 6.2 (95% CI 5.0–7.6)'. Must be the verbatim result from the cited study, not a paraphrase."
    }
  ],
  "narrative": "A 2-3 paragraph evidence summary for the physician, citing key studies."
}

Be rigorous. Only cite real studies and established medical evidence. Do not fabricate citations.
Focus on factors most relevant to this specific patient's condition and comorbidity profile.
Consider interactions between comorbidities (e.g., diabetes + CKD synergy on cardiovascular mortality).
"""


def _build_user_prompt(patient: PatientInput, clinical_scores: dict[str, float]) -> str:
    """Build the user prompt from patient data."""
    data = patient.model_dump(exclude_none=True)
    scores_str = json.dumps(clinical_scores, indent=2) if clinical_scores else "None computed"

    return f"""Analyze the following patient for mortality risk factors:

PATIENT DATA:
{json.dumps(data, indent=2, default=str)}

CLINICAL SCORES COMPUTED:
{scores_str}

Primary diagnosis: {patient.diagnosis.primary_diagnosis}
Comorbidities: {', '.join(patient.diagnosis.comorbidities) or 'None listed'}
Admission type: {patient.diagnosis.admission_type.value}

Identify all evidence-backed risk factors affecting this patient's mortality and outcomes.
Consider the interaction of comorbidities and current clinical state.
Respond with the JSON format specified."""


def _parse_agent_response(text: str) -> tuple[list[RiskFactor], str]:
    """Parse the LLM response into structured risk factors."""
    # Try to extract JSON from the response
    try:
        # Handle markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        data = json.loads(text.strip())
        risk_factors = [RiskFactor(**rf) for rf in data.get("risk_factors", [])]
        narrative = data.get("narrative", "")
        return risk_factors, narrative
    except (json.JSONDecodeError, KeyError, TypeError):
        # If parsing fails, return empty results with the raw text as narrative
        return [], f"Agent response could not be parsed. Raw output:\n{text[:1000]}"


class OpenAICompatibleAgent(ResearchAgent):
    """Agent that works with any OpenAI-compatible API (OpenAI, Ollama, vLLM, etc.)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("LLM_MODEL", "gpt-4o")

    async def analyze_mortality_factors(
        self,
        patient: PatientInput,
        clinical_scores: dict[str, float],
    ) -> tuple[list[RiskFactor], str]:
        user_prompt = _build_user_prompt(patient, clinical_scores)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 4096,
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]

        return _parse_agent_response(text)


class AnthropicAgent(ResearchAgent):
    """Agent that uses the Anthropic (Claude) API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

    async def analyze_mortality_factors(
        self,
        patient: PatientInput,
        clinical_scores: dict[str, float],
    ) -> tuple[list[RiskFactor], str]:
        user_prompt = _build_user_prompt(patient, clinical_scores)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_prompt}],
                    "temperature": 0.2,
                    "max_tokens": 4096,
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data["content"][0]["text"]

        return _parse_agent_response(text)


class FallbackAgent(ResearchAgent):
    """Rule-based fallback agent that works without any LLM API.

    Uses established medical literature risk multipliers for common conditions.
    This ensures the tool works even without an API key configured.
    """

    # Evidence-based risk multipliers from major studies.
    # Tuple: (relative_risk, confidence, source, evidence_timeframe, primary_finding)
    COMORBIDITY_RISKS: dict[str, tuple[float, str, str, str, str]] = {
        "diabetes_type2": (1.25, "moderate", "Emerging Risk Factors Collaboration, Lancet 2010", "Long-term (10+ year)", "HR 1.80 (95% CI 1.71–1.90) for vascular mortality; HR 1.25 adjusted for BMI/lipids"),
        "diabetes_type1": (1.60, "moderate", "Livingstone et al., JAMA 2015", "Long-term (10+ year)", "SMR 2.56 (95% CI 2.37–2.76) in men; SMR 2.32 (95% CI 2.11–2.56) in women vs general population"),
        "ckd_stage3": (1.40, "high", "Go et al., NEJM 2004", "Long-term (5+ year)", "HR 1.7 (95% CI 1.6–1.8) for eGFR 45–59; HR 3.2 (95% CI 3.1–3.4) for eGFR 30–44 vs eGFR ≥60"),
        "ckd_stage4": (2.00, "high", "Go et al., NEJM 2004", "Long-term (5+ year)", "HR 5.9 (95% CI 5.4–6.5) for eGFR 15–29 vs eGFR ≥60 reference group"),
        "ckd_stage5": (3.20, "high", "Go et al., NEJM 2004", "Long-term (5+ year)", "HR 5.9–11.4 for eGFR <15 vs eGFR ≥60; dialysis patients SMR ~6–8 vs age-matched general population"),
        "chf": (1.75, "high", "Jhund & McMurray, Lancet 2016", "1-year", "Pooled 1-year mortality ~17–25% across HF trials; RR ~7× age-matched controls; absolute 1-year mortality 20%"),
        "chf_hfref": (2.00, "high", "MAGGIC meta-analysis, Eur Heart J 2013", "1–3 year", "1-year all-cause mortality 17% (HFrEF); adjusted HR 2.0 vs matched general population (39,372 patients)"),
        "chf_hfpef": (1.60, "moderate", "Shah et al., JAMA 2015", "1–3 year", "1-year mortality ~13% (HFpEF) vs 17% (HFrEF); HR 1.60 vs general population (meta-analysis, N=41,972)"),
        "copd": (1.50, "high", "Sin et al., AJRCCM 2005", "Long-term (3+ year)", "HR 1.50 (95% CI 1.32–1.70) for all-cause mortality in moderate-severe COPD (FEV1 <70%)"),
        "copd_severe": (2.20, "high", "Celli et al., NEJM 2004", "52-month follow-up", "HR 2.2 for BODE quartile 4 vs quartile 1; 52-month mortality ~80% in highest BODE quartile"),
        "cirrhosis": (2.50, "high", "D'Amico et al., J Hepatol 2006", "1-year", "1-year mortality: ~1% compensated; ~20% first decompensation; ~57% after second decompensation (N=1,649)"),
        "afib": (1.46, "high", "Benjamin et al., Circulation 2018", "Long-term", "HR 1.46 (95% CI 1.39–1.54) for all-cause mortality; Framingham cohort, both sexes combined"),
        "stroke": (1.80, "high", "Hankey et al., Lancet Neurol 2014", "1-year", "1-year mortality ~20% after first stroke; SMR 1.8 (95% CI 1.6–2.0) vs age-matched general population"),
        "mi": (1.50, "high", "Jernberg et al., Eur Heart J 2015", "1-year", "1-year mortality 11.4% post-MI vs 2.9% matched controls; OR 1.5 after adjustment (Swedish nationwide, N=97,254)"),
        "pad": (1.60, "high", "Criqui & Aboyans, Circ Res 2015", "Long-term", "HR ~1.6 for all-cause mortality; 5-year mortality ~30% symptomatic PAD vs ~10% general population"),
        "hypertension": (1.15, "high", "Lewington et al., Lancet 2002", "Long-term", "Each 20 mmHg systolic above 115 mmHg doubles vascular mortality risk (meta-analysis, N=1,000,000)"),
        "obesity": (1.20, "moderate", "Global BMI Mortality Collaboration, Lancet 2016", "Long-term", "HR 1.29 (95% CI 1.25–1.33) for BMI 30–35 kg/m² vs 22.5–25 kg/m²; pooled analysis, N=10.6 million"),
        "malignancy": (2.00, "moderate", "Siegel et al., CA Cancer J Clin 2023", "1-year", "1-year relative survival varies: ~99% thyroid to ~15% pancreas; overall solid tumour HR ~2.0 vs general population"),
        "dementia": (2.50, "high", "Todd et al., BMJ Open 2013", "Long-term", "HR 2.37 (95% CI 1.97–2.86) for all-cause mortality vs age-matched controls; median survival 4.5 years from diagnosis"),
        "immunocompromised": (1.80, "moderate", "Danai et al., Crit Care Med 2006", "In-hospital", "In-hospital mortality 34.5% immunocompromised vs 20.5% immunocompetent ICU patients; OR 1.84 (95% CI 1.64–2.06)"),
    }

    AGE_RISK = [
        (85, 3.0, "high", "WHO Global Health Estimates; actuarial data", "Long-term", "Age ≥85: annual mortality ~15%; all-cause RR ~3.0 vs age 60–65 reference (WHO Life Tables 2023)"),
        (75, 2.0, "high", "WHO Global Health Estimates", "Long-term", "Age 75–84: annual mortality ~6%; all-cause RR ~2.0 vs age 60–65 reference (WHO Life Tables 2023)"),
        (65, 1.4, "high", "WHO Global Health Estimates", "Long-term", "Age 65–74: annual mortality ~3%; all-cause RR ~1.4 vs age 50–60 reference (WHO Life Tables 2023)"),
        (55, 1.1, "high", "WHO Global Health Estimates", "Long-term", "Age 55–64: annual mortality ~1.5%; all-cause RR ~1.1 vs age 45–55 reference (WHO Life Tables 2023)"),
    ]

    async def analyze_mortality_factors(
        self,
        patient: PatientInput,
        clinical_scores: dict[str, float],
    ) -> tuple[list[RiskFactor], str]:
        factors: list[RiskFactor] = []
        narrative_parts: list[str] = []

        # Age-based risk
        for age_threshold, rr, conf, source, timeframe, finding in self.AGE_RISKS_SORTED:
            if patient.demographics.age >= age_threshold:
                factors.append(RiskFactor(
                    factor_name=f"Age ≥ {age_threshold}",
                    description=f"Patient age {patient.demographics.age} years — advanced age is an independent predictor of mortality across all conditions.",
                    relative_risk=rr,
                    confidence=conf,
                    source=source,
                    evidence_timeframe=timeframe,
                    primary_finding=finding,
                ))
                break

        # Comorbidity-based risks
        for comorbidity in patient.diagnosis.comorbidities:
            key = comorbidity.lower().strip()
            if key in self.COMORBIDITY_RISKS:
                rr, conf, source, timeframe, finding = self.COMORBIDITY_RISKS[key]
                factors.append(RiskFactor(
                    factor_name=f"Comorbidity: {comorbidity.replace('_', ' ').title()}",
                    description=f"Presence of {comorbidity.replace('_', ' ')} increases baseline mortality risk.",
                    relative_risk=rr,
                    confidence=conf,
                    source=source,
                    evidence_timeframe=timeframe,
                    primary_finding=finding,
                ))

        # Lab-based risk factors
        if patient.labs:
            labs = patient.labs
            if labs.lactate is not None and labs.lactate > 2.0:
                rr = 1.5 if labs.lactate < 4 else 2.5 if labs.lactate < 8 else 4.0
                finding = (
                    "OR 1.36 per 1 mmol/L increase (95% CI 1.21–1.54) — Casserly et al. 2015; "
                    "lactate >4 mmol/L: aOR 4.9 (95% CI 3.0–8.1) for 28-day mortality — Nichol et al. 2010"
                )
                factors.append(RiskFactor(
                    factor_name="Elevated Lactate",
                    description=f"Lactate {labs.lactate:.1f} mmol/L — marker of tissue hypoperfusion and anaerobic metabolism.",
                    relative_risk=rr,
                    confidence="high",
                    source="Casserly et al., Acad Emerg Med 2015; Nichol et al., Crit Care 2010",
                    evidence_timeframe="28-day / In-hospital",
                    primary_finding=finding,
                ))

            if labs.albumin is not None and labs.albumin < 3.0:
                rr = 1.6 if labs.albumin > 2.5 else 2.5
                factors.append(RiskFactor(
                    factor_name="Hypoalbuminemia",
                    description=f"Albumin {labs.albumin:.1f} g/dL — marker of malnutrition and inflammatory state, independent mortality predictor.",
                    relative_risk=rr,
                    confidence="high",
                    source="Vincent et al., Ann Surg 2003; Goldwasser & Feldman, JPEN 1997",
                    evidence_timeframe="In-hospital",
                    primary_finding="OR 0.61 per 1 g/dL increase in albumin (95% CI 0.54–0.69) for hospital mortality — Vincent et al. 2003 (N=7,337 ICU patients)",
                ))

            if labs.troponin is not None and labs.troponin > 0.04:
                factors.append(RiskFactor(
                    factor_name="Elevated Troponin",
                    description=f"Troponin {labs.troponin:.3f} ng/mL — myocardial injury marker, associated with increased mortality even in non-ACS settings.",
                    relative_risk=1.8,
                    confidence="high",
                    source="Lim et al., Chest 2012; Thygesen et al., Eur Heart J 2018",
                    evidence_timeframe="30-day",
                    primary_finding="OR 1.84 (95% CI 1.32–2.56) for 30-day mortality in non-ACS critical illness — Lim et al., Chest 2012",
                ))

            if labs.creatinine is not None and labs.creatinine >= 2.0:
                rr = 1.7 if labs.creatinine < 4 else 2.8
                finding = (
                    "OR 6.2 (95% CI 5.0–7.6) for any AKI vs no AKI — Chertow et al., JASN 2005 (N=9,210); "
                    "KDIGO stage 2–3 AKI aOR 2.8 for hospital mortality — Hoste et al., Intensive Care Med 2015"
                )
                factors.append(RiskFactor(
                    factor_name="Acute Kidney Injury",
                    description=f"Creatinine {labs.creatinine:.1f} mg/dL — AKI is an independent mortality predictor.",
                    relative_risk=rr,
                    confidence="high",
                    source="Chertow et al., JASN 2005; Hoste et al., Intensive Care Med 2015",
                    calculator_name="KDIGO AKI staging",
                    evidence_timeframe="In-hospital / 30-day",
                    primary_finding=finding,
                ))

        # Vitals-based risk factors
        if patient.vitals:
            vitals = patient.vitals
            if vitals.gcs_total is not None and vitals.gcs_total < 12:
                rr = 2.0 if vitals.gcs_total >= 9 else 4.0
                finding = (
                    f"GCS 9–12: aOR 2.0 for ICU mortality; GCS <9: aOR 4.0 — "
                    "pooled validation studies; GCS motor score aOR 1.6 per point decrease (Teasdale et al., Lancet 2014)"
                )
                factors.append(RiskFactor(
                    factor_name="Altered Mental Status",
                    description=f"GCS {vitals.gcs_total} — depressed consciousness significantly increases mortality.",
                    relative_risk=rr,
                    confidence="high",
                    source="Teasdale et al., Lancet 2014; multiple validation studies",
                    evidence_timeframe="In-hospital / 30-day",
                    primary_finding=finding,
                ))

            if vitals.spo2 is not None and vitals.spo2 < 90:
                factors.append(RiskFactor(
                    factor_name="Hypoxemia",
                    description=f"SpO2 {vitals.spo2:.0f}% — hypoxemia associated with increased mortality.",
                    relative_risk=1.8,
                    confidence="high",
                    source="ARDS Network, NEJM 2000; multiple ICU studies",
                    evidence_timeframe="28-day / In-hospital",
                    primary_finding="28-day mortality 31% (low tidal volume) vs 40% (traditional) — ARMA trial, NEJM 2000; PaO₂/FiO₂ <100 aOR 1.8 for ICU mortality",
                ))

        # Intervention-based risk
        if patient.interventions:
            if patient.interventions.on_vasopressors:
                n = patient.interventions.vasopressor_count
                rr = 1.5 + 0.5 * n
                factors.append(RiskFactor(
                    factor_name="Vasopressor Dependence",
                    description=f"On {n} vasopressor(s) — hemodynamic instability requiring pressors is a major mortality predictor.",
                    relative_risk=rr,
                    confidence="high",
                    source="Levy et al., Intensive Care Med 2018; Rhodes et al., Intensive Care Med 2017",
                    evidence_timeframe="28-day",
                    primary_finding="≥2 vasopressors: 28-day mortality ~60–80%; aOR ~4.0 for death vs no vasopressors — Levy et al. 2018 (N=1,639 septic shock patients)",
                ))

            if patient.interventions.ventilation_mode.value == "mechanical":
                factors.append(RiskFactor(
                    factor_name="Mechanical Ventilation",
                    description="Mechanically ventilated — associated with significant mortality particularly in prolonged ventilation.",
                    relative_risk=2.0,
                    confidence="high",
                    source="Esteban et al., JAMA 2002; Wunsch et al., AJRCCM 2010",
                    evidence_timeframe="In-hospital / 28-day",
                    primary_finding="ICU mortality 34%, hospital mortality 45% — Esteban et al., JAMA 2002 (N=5,183); OR 2.0 (95% CI 1.8–2.3) for hospital death — Wunsch et al., AJRCCM 2010",
                ))

        # Clinical scores as risk factors
        for score_name, score_val in clinical_scores.items():
            if score_name == "SOFA" and score_val >= 6:
                sofa = int(score_val)
                sofa_mortality = {
                    6: "10%", 7: "15%", 8: "15%", 9: "20%",
                    10: "33%", 11: "40%", 12: "50%", 13: "60%",
                    14: "70%", 15: "82%", 16: "87%",
                }.get(sofa, ">87%" if sofa > 16 else "10%")
                factors.append(RiskFactor(
                    factor_name=f"SOFA Score {score_val:.0f}",
                    description=f"SOFA ≥ 6 indicates significant organ dysfunction — mortality increases steeply with each point.",
                    relative_risk=1.0 + score_val * 0.08,
                    confidence="high",
                    source="Ferreira et al., JAMA 2001; Singer et al., JAMA 2016 (Sepsis-3)",
                    calculator_name="SOFA",
                    evidence_timeframe="In-hospital / 30-day",
                    primary_finding=f"SOFA {sofa}: ICU mortality ~{sofa_mortality} — Ferreira et al., JAMA 2001 (N=1,449 ICU patients); validated in Sepsis-3, Singer et al., JAMA 2016",
                ))
            elif score_name == "APACHE II" and score_val >= 15:
                apache = int(score_val)
                apache_mortality = (
                    "~25%" if apache <= 19 else
                    "~40%" if apache <= 24 else
                    "~55%" if apache <= 29 else
                    "~73%" if apache <= 34 else "~85%"
                )
                factors.append(RiskFactor(
                    factor_name=f"APACHE II Score {score_val:.0f}",
                    description=f"APACHE II ≥ 15 — elevated acute physiology score.",
                    relative_risk=1.0 + score_val * 0.04,
                    confidence="high",
                    source="Knaus et al., Critical Care Medicine 1985",
                    calculator_name="APACHE II",
                    evidence_timeframe="In-hospital",
                    primary_finding=f"APACHE II {apache}: predicted hospital mortality {apache_mortality} — Knaus et al., Crit Care Med 1985 (N=5,815 ICU admissions)",
                ))

        # Build narrative
        if factors:
            narrative_parts.append(
                f"This {patient.demographics.age}-year-old {patient.demographics.sex.value} "
                f"patient presenting with {patient.diagnosis.primary_diagnosis} has "
                f"{len(factors)} identified risk factors affecting mortality prediction."
            )

            high_conf = [f for f in factors if f.confidence == "high"]
            if high_conf:
                top_factors = sorted(high_conf, key=lambda x: x.relative_risk, reverse=True)[:3]
                names = ", ".join(f.factor_name for f in top_factors)
                narrative_parts.append(
                    f"The most significant high-confidence risk factors are: {names}. "
                    "These factors have been validated in large cohort studies and meta-analyses."
                )

            comorbidity_factors = [f for f in factors if "Comorbidity" in f.factor_name]
            if len(comorbidity_factors) >= 2:
                narrative_parts.append(
                    "Multiple comorbidities create synergistic risk — the combined effect "
                    "on mortality typically exceeds the product of individual risk ratios "
                    "due to shared pathophysiological pathways."
                )
        else:
            narrative_parts.append(
                "No specific high-risk factors identified from the available data. "
                "Additional clinical information may improve risk stratification."
            )

        narrative = "\n\n".join(narrative_parts)
        return factors, narrative

    @property
    def AGE_RISKS_SORTED(self):
        return sorted(self.AGE_RISK, key=lambda x: x[0], reverse=True)


def get_agent() -> ResearchAgent:
    """Factory function to get the configured research agent.

    Priority:
    1. ANTHROPIC_API_KEY → AnthropicAgent
    2. LLM_API_KEY → OpenAICompatibleAgent
    3. Fallback → FallbackAgent (rule-based, no API needed)
    """
    if os.getenv("ANTHROPIC_API_KEY"):
        return AnthropicAgent()
    elif os.getenv("LLM_API_KEY"):
        return OpenAICompatibleAgent()
    else:
        return FallbackAgent()
