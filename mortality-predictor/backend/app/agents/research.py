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
      "calculator_name": "string or null"
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

    # Evidence-based risk multipliers from major studies
    COMORBIDITY_RISKS: dict[str, tuple[float, str, str]] = {
        "diabetes_type2": (1.25, "moderate", "Emerging Risk Factors Collaboration, JAMA 2015"),
        "diabetes_type1": (1.60, "moderate", "Livingstone et al., JAMA 2015"),
        "ckd_stage3": (1.40, "high", "Go et al., NEJM 2004 — KDOQI CKD outcomes"),
        "ckd_stage4": (2.00, "high", "Go et al., NEJM 2004"),
        "ckd_stage5": (3.20, "high", "Go et al., NEJM 2004"),
        "chf": (1.75, "high", "Meta-analysis, Jhund & McMurray, Lancet 2016"),
        "chf_hfref": (2.00, "high", "MAGGIC meta-analysis, Eur Heart J 2013"),
        "chf_hfpef": (1.60, "moderate", "Meta-analysis, Shah et al., JAMA 2015"),
        "copd": (1.50, "high", "Sin et al., AJRCCM 2005"),
        "copd_severe": (2.20, "high", "Celli et al., NEJM 2004 — BODE index"),
        "cirrhosis": (2.50, "high", "D'Amico et al., J Hepatol 2006"),
        "afib": (1.40, "high", "Benjamin et al., Circulation 2018 — Framingham"),
        "stroke": (1.80, "high", "Hankey et al., Lancet Neurol 2014"),
        "mi": (1.50, "high", "Jernberg et al., Eur Heart J 2015"),
        "pad": (1.60, "high", "Criqui & Aboyans, Circ Res 2015"),
        "hypertension": (1.15, "high", "Lewington et al., Lancet 2002 — PSC meta-analysis"),
        "obesity": (1.20, "moderate", "Global BMI Mortality Collaboration, Lancet 2016"),
        "malignancy": (2.00, "moderate", "Estimated — varies widely by cancer type and stage"),
        "dementia": (2.50, "high", "Todd et al., BMJ Open 2013"),
        "immunocompromised": (1.80, "moderate", "Varies by etiology — consensus estimate"),
    }

    AGE_RISK = [
        (85, 3.0, "high", "WHO Global Health Estimates; actuarial data"),
        (75, 2.0, "high", "WHO Global Health Estimates"),
        (65, 1.4, "high", "WHO Global Health Estimates"),
        (55, 1.1, "high", "WHO Global Health Estimates"),
    ]

    async def analyze_mortality_factors(
        self,
        patient: PatientInput,
        clinical_scores: dict[str, float],
    ) -> tuple[list[RiskFactor], str]:
        factors: list[RiskFactor] = []
        narrative_parts: list[str] = []

        # Age-based risk
        for age_threshold, rr, conf, source in self.AGE_RISKS_SORTED:
            if patient.demographics.age >= age_threshold:
                factors.append(RiskFactor(
                    factor_name=f"Age ≥ {age_threshold}",
                    description=f"Patient age {patient.demographics.age} years — advanced age is an independent predictor of mortality across all conditions.",
                    relative_risk=rr,
                    confidence=conf,
                    source=source,
                ))
                break

        # Comorbidity-based risks
        for comorbidity in patient.diagnosis.comorbidities:
            key = comorbidity.lower().strip()
            if key in self.COMORBIDITY_RISKS:
                rr, conf, source = self.COMORBIDITY_RISKS[key]
                factors.append(RiskFactor(
                    factor_name=f"Comorbidity: {comorbidity.replace('_', ' ').title()}",
                    description=f"Presence of {comorbidity.replace('_', ' ')} increases baseline mortality risk.",
                    relative_risk=rr,
                    confidence=conf,
                    source=source,
                ))

        # Lab-based risk factors
        if patient.labs:
            labs = patient.labs
            if labs.lactate is not None and labs.lactate > 2.0:
                rr = 1.5 if labs.lactate < 4 else 2.5 if labs.lactate < 8 else 4.0
                factors.append(RiskFactor(
                    factor_name="Elevated Lactate",
                    description=f"Lactate {labs.lactate:.1f} mmol/L — marker of tissue hypoperfusion and anaerobic metabolism.",
                    relative_risk=rr,
                    confidence="high",
                    source="Casserly et al., Acad Emerg Med 2015; Nichol et al., Crit Care 2010",
                ))

            if labs.albumin is not None and labs.albumin < 3.0:
                rr = 1.6 if labs.albumin > 2.5 else 2.5
                factors.append(RiskFactor(
                    factor_name="Hypoalbuminemia",
                    description=f"Albumin {labs.albumin:.1f} g/dL — marker of malnutrition and inflammatory state, independent mortality predictor.",
                    relative_risk=rr,
                    confidence="high",
                    source="Vincent et al., Ann Surg 2003; Goldwasser & Feldman, JPEN 1997",
                ))

            if labs.troponin is not None and labs.troponin > 0.04:
                factors.append(RiskFactor(
                    factor_name="Elevated Troponin",
                    description=f"Troponin {labs.troponin:.3f} ng/mL — myocardial injury marker, associated with increased mortality even in non-ACS settings.",
                    relative_risk=1.8,
                    confidence="high",
                    source="Thygesen et al., Eur Heart J 2018 — Fourth Universal Definition of MI",
                ))

            if labs.creatinine is not None and labs.creatinine >= 2.0:
                factors.append(RiskFactor(
                    factor_name="Acute Kidney Injury",
                    description=f"Creatinine {labs.creatinine:.1f} mg/dL — AKI is an independent mortality predictor.",
                    relative_risk=1.7 if labs.creatinine < 4 else 2.8,
                    confidence="high",
                    source="Chertow et al., JASN 2005; Hoste et al., Intensive Care Med 2015",
                    calculator_name="KDIGO AKI staging",
                ))

        # Vitals-based risk factors
        if patient.vitals:
            vitals = patient.vitals
            if vitals.gcs_total is not None and vitals.gcs_total < 12:
                rr = 2.0 if vitals.gcs_total >= 9 else 4.0
                factors.append(RiskFactor(
                    factor_name="Altered Mental Status",
                    description=f"GCS {vitals.gcs_total} — depressed consciousness significantly increases mortality.",
                    relative_risk=rr,
                    confidence="high",
                    source="Teasdale et al., Lancet 2014; multiple validation studies",
                ))

            if vitals.spo2 is not None and vitals.spo2 < 90:
                factors.append(RiskFactor(
                    factor_name="Hypoxemia",
                    description=f"SpO2 {vitals.spo2:.0f}% — hypoxemia associated with increased mortality.",
                    relative_risk=1.8,
                    confidence="high",
                    source="ARDS Network, NEJM 2000; multiple ICU studies",
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
                    source="Rhodes et al., Intensive Care Med 2017 — Surviving Sepsis Campaign",
                ))

            if patient.interventions.ventilation_mode.value == "mechanical":
                factors.append(RiskFactor(
                    factor_name="Mechanical Ventilation",
                    description="Mechanically ventilated — associated with significant mortality particularly in prolonged ventilation.",
                    relative_risk=2.0,
                    confidence="high",
                    source="Esteban et al., JAMA 2002; Wunsch et al., AJRCCM 2010",
                ))

        # Clinical scores as risk factors
        for score_name, score_val in clinical_scores.items():
            if score_name == "SOFA" and score_val >= 6:
                factors.append(RiskFactor(
                    factor_name=f"SOFA Score {score_val:.0f}",
                    description=f"SOFA ≥ 6 indicates significant organ dysfunction — mortality increases steeply with each point.",
                    relative_risk=1.0 + score_val * 0.08,
                    confidence="high",
                    source="Ferreira et al., JAMA 2001; Singer et al., JAMA 2016 (Sepsis-3)",
                    calculator_name="SOFA",
                ))
            elif score_name == "APACHE_II" and score_val >= 15:
                factors.append(RiskFactor(
                    factor_name=f"APACHE II Score {score_val:.0f}",
                    description=f"APACHE II ≥ 15 — elevated acute physiology score.",
                    relative_risk=1.0 + score_val * 0.04,
                    confidence="high",
                    source="Knaus et al., Critical Care Medicine 1985",
                    calculator_name="APACHE II",
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
