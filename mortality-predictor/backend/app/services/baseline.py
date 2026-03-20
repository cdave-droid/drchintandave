"""Patient-specific baseline mortality service.

Replaces the admission-type-only hardcoded baselines with diagnosis-stratified
rates sourced from published literature. Matching priority:

  1. Exact / keyword match against DIAGNOSIS_BASELINES (curated literature values)
  2. LLM agent lookup for unlisted diagnoses (if API key configured)
  3. Admission-type fallback (original behaviour, last resort)

Each baseline carries the source study, primary finding, and N so the UI can
show where the number comes from — same standard as the risk factors.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.models.patient import PatientInput


@dataclass
class BaselineResult:
    mortality_30d: float
    mortality_90d: float
    mortality_1yr: float
    source: str
    primary_finding: str
    matched_diagnosis: str          # what we matched against
    match_method: str               # "literature", "llm", or "fallback"
    n_patients: Optional[int] = None
    population_note: Optional[str] = None


# ---------------------------------------------------------------------------
# Curated literature baselines
# Each entry: keywords (any match → hit), setting filter, mortalities, citation
# ---------------------------------------------------------------------------

@dataclass
class _Entry:
    keywords: list[str]
    settings: list[str]             # ["icu", "floor", "ed", "any"]
    mortality_30d: float
    mortality_90d: float
    mortality_1yr: float
    source: str
    primary_finding: str
    n_patients: Optional[int] = None
    population_note: Optional[str] = None
    severity_keywords: list[str] = field(default_factory=list)  # elevate priority


# fmt: off
_LITERATURE: list[_Entry] = [

    # ── Sepsis / Infection ───────────────────────────────────────────────────
    _Entry(
        keywords=["septic shock", "septicaemic shock"],
        settings=["icu", "any"],
        mortality_30d=0.423, mortality_90d=0.52, mortality_1yr=0.60,
        source="Shankar-Hari et al., JAMA 2016 (Sepsis-3 Definition); PROWESS-SHOCK, NEJM 2012",
        primary_finding="Hospital mortality 42.3% (95% CI 39.1–45.6%) in patients meeting new septic shock criteria (vasopressor + lactate >2 mmol/L) vs 26.9% without — Shankar-Hari et al., JAMA 2016, N=6,925 derivation cohort",
        n_patients=6925,
        population_note="Septic shock (Sepsis-3: vasopressor + lactate >2 mmol/L), ICU/ED",
        severity_keywords=["shock", "vasopressor", "refractory"],
    ),
    _Entry(
        keywords=["sepsis", "septicaemia", "septicemia", "bacteraemia", "bacteremia"],
        settings=["any"],
        mortality_30d=0.22, mortality_90d=0.32, mortality_1yr=0.42,
        source="Seymour et al., JAMA 2016 (Sepsis-3); Rhee et al., JAMA 2017",
        primary_finding="Hospital mortality 29.9% in patients requiring vasoactive agents; overall suspected infection 10.4% (Seymour et al., JAMA 2016, N=148,907 ICU admissions); clinical-criteria sepsis 30-day mortality 15.6–18.5% (Rhee et al., JAMA 2017, N=173,690)",
        n_patients=173690,
        population_note="All hospitalised sepsis (Sepsis-3 definition)",
    ),

    # ── Pneumonia ────────────────────────────────────────────────────────────
    _Entry(
        keywords=["ventilator-associated pneumonia", "vap", "hospital-acquired pneumonia", "hap", "nosocomial pneumonia"],
        settings=["icu", "any"],
        mortality_30d=0.35, mortality_90d=0.45, mortality_1yr=0.55,
        source="Kalil et al., CID 2016; Torres et al., Eur Respir J 2017",
        primary_finding="HAP/VAP attributable mortality 30–50%; 30-day crude mortality ~35% (Torres et al. meta-analysis, N>10,000)",
        n_patients=10000,
        population_note="ICU HAP/VAP",
    ),
    _Entry(
        keywords=["pneumonia", "cap", "community-acquired pneumonia", "community acquired pneumonia"],
        settings=["icu"],
        mortality_30d=0.28, mortality_90d=0.38, mortality_1yr=0.48,
        source="España et al., AJRCCM 2006; Cillóniz et al., Thorax 2011; IDSA/ATS 2007",
        primary_finding="30-day mortality in ICU-admitted CAP 28.4% (95% CI 22.1–35.4%) — España et al., AJRCCM 2006 (N=1,057); PSI class V 30-day mortality 29.2% (Fine et al., NEJM 1997, N=14,199)",
        n_patients=1057,
        population_note="CAP requiring ICU admission",
        severity_keywords=["icu", "severe", "intubat"],
    ),
    _Entry(
        keywords=["pneumonia", "cap", "community-acquired pneumonia", "community acquired pneumonia", "lower respiratory tract infection", "lrti"],
        settings=["floor", "ed", "any"],
        mortality_30d=0.08, mortality_90d=0.14, mortality_1yr=0.22,
        source="Fine et al., NEJM 1997 (PORT/PSI); Lim et al., Thorax 2003 (CURB-65)",
        primary_finding="30-day mortality by PSI class: I 0.1%, II 0.6%, III 2.8%, IV 8.2%, V 29.2%; overall hospitalised CAP ~5–8% (Fine et al., NEJM 1997, N=14,199 derivation + 38,039 validation)",
        n_patients=14199,
        population_note="Hospitalised CAP (general ward)",
    ),

    # ── ARDS ─────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["ards", "acute respiratory distress syndrome", "acute lung injury", "ali"],
        settings=["icu", "any"],
        mortality_30d=0.40, mortality_90d=0.48, mortality_1yr=0.56,
        source="Bellani et al., JAMA 2016 (LUNG SAFE); ARMA Trial, NEJM 2000",
        primary_finding="Hospital mortality: mild ARDS 34.9% (95% CI 31.4–38.5%), moderate 40.3% (95% CI 37.4–43.3%), severe 46.1% (95% CI 41.9–50.4%) — LUNG SAFE, N=3,022 ARDS patients across 50 countries (Bellani et al., JAMA 2016)",
        n_patients=3022,
        population_note="Mechanically ventilated ARDS, ICU — moderate-severe (PaO₂/FiO₂ <200)",
    ),

    # ── Heart Failure ─────────────────────────────────────────────────────────
    _Entry(
        keywords=["acute decompensated heart failure", "adhf", "acute heart failure", "heart failure exacerbation", "decompensated heart failure", "chf exacerbation"],
        settings=["any"],
        mortality_30d=0.10, mortality_90d=0.22, mortality_1yr=0.30,
        source="Gheorghiade et al., JAMA 2013; Harjola et al., Eur J Heart Fail 2010 (EuroHeart)",
        primary_finding="In-hospital mortality 4.0% overall; highest-risk group (BUN ≥43, SBP <115, Cr ≥2.75) 21.9% — ADHERE registry, N=65,275 (Fonarow et al., JAMA 2005); 30-day post-discharge mortality 8.6%, 60–90-day 12.2–15.2% (OPTIMIZE-HF, N=48,612 — Fonarow et al., JAMA 2008)",
        n_patients=3580,
        population_note="Hospitalised acute decompensated heart failure",
    ),

    # ── ACS ──────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["stemi", "st elevation mi", "st-elevation myocardial infarction", "st elevation myocardial infarction"],
        settings=["any"],
        mortality_30d=0.071, mortality_90d=0.09, mortality_1yr=0.108,
        source="Jernberg et al., Eur Heart J 2015 (SWEDEHEART/RIKS-HIA)",
        primary_finding="30-day mortality 7.1%; 1-year mortality 10.8% — SWEDEHEART/RIKS-HIA, N=97,254 STEMI patients, 2003–2013 (Jernberg et al., Eur Heart J 2015)",
        n_patients=97254,
        population_note="STEMI, Swedish nationwide registry (modern PPCI era)",
    ),
    _Entry(
        keywords=["nstemi", "non-st elevation mi", "non-stemi", "nste-acs", "unstable angina", "acs", "acute coronary syndrome", "acute mi", "myocardial infarction"],
        settings=["any"],
        mortality_30d=0.038, mortality_90d=0.07, mortality_1yr=0.11,
        source="Fox et al., GRACE registry (Eur Heart J Acute Cardiovasc Care 2010); Jernberg et al., Eur Heart J 2015",
        primary_finding="In-hospital mortality NSTEMI 3.8%; 6-month post-discharge mortality 7.5% — GRACE registry, N=102,341 ACS patients, 32 countries (Fox et al. 2010)",
        n_patients=102341,
        population_note="NSTEMI/ACS, multinational GRACE registry",
    ),

    # ── Stroke ────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["intracerebral hemorrhage", "ich", "intraparenchymal hemorrhage", "hemorrhagic stroke"],
        settings=["any"],
        mortality_30d=0.404, mortality_90d=0.48, mortality_1yr=0.547,
        source="van Asch et al., Lancet Neurol 2010 (systematic review); Hemphill et al., Stroke 2001 (ICH Score)",
        primary_finding="30-day case fatality 40.4% (95% CI 37.7–43.2%); 1-year case fatality 54.7% (95% CI 46.4–63.0%) — van Asch et al., Lancet Neurol 2010, pooled meta-analysis N=8,145",
        n_patients=8145,
        population_note="Spontaneous intracerebral haemorrhage, population-based and hospital cohorts",
    ),
    _Entry(
        keywords=["ischemic stroke", "ischaemic stroke", "cerebral infarction", "stroke", "cva", "cerebrovascular accident", "tia"],
        settings=["any"],
        mortality_30d=0.12, mortality_90d=0.16, mortality_1yr=0.23,
        source="Feigin et al., Lancet 2014 (GBD 2010); Fonarow et al., Stroke 2012 (GWTG-Stroke)",
        primary_finding="30-day case fatality ~11–15% for ischaemic stroke in high-income countries (Feigin et al., Lancet 2014); in-hospital mortality 5.3%, 30-day ~11–12% (GWTG-Stroke, N>500,000 — Fonarow et al., Stroke 2012)",
        n_patients=500000,
        population_note="Acute ischaemic stroke, hospital-based registries",
    ),

    # ── Liver ─────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["acute liver failure", "alf", "fulminant hepatic failure", "fulminant liver failure"],
        settings=["any"],
        mortality_30d=0.35, mortality_90d=0.42, mortality_1yr=0.50,
        source="Bernal et al., NEJM 2013; Lee et al., Hepatology 2008 (US ALF Study Group)",
        primary_finding="21-day transplant-free survival 45% (US ALF Study Group, N=1,147); overall 21-day mortality (without transplant) ~35–40%",
        n_patients=1147,
        population_note="Acute liver failure, tertiary liver centres",
    ),
    _Entry(
        keywords=["acute-on-chronic liver failure", "aclf", "acute on chronic liver failure"],
        settings=["any"],
        mortality_30d=0.33, mortality_90d=0.51, mortality_1yr=0.65,
        source="Moreau et al., Gastroenterology 2013 (CANONIC study, EASL-CLIF)",
        primary_finding="28-day mortality: Grade 1 22.1%, Grade 2 32.0%, Grade 3 73.8%; 90-day mortality: Grade 1 40.7%, Grade 2 52.3%, Grade 3 79.1% — CANONIC, N=1,343 (29 European centres) (Moreau et al., Gastroenterology 2013)",
        n_patients=1343,
        population_note="Hospitalised cirrhosis with ACLF (EASL-CLIF CANONIC criteria)",
    ),
    _Entry(
        keywords=["cirrhosis", "hepatic decompensation", "decompensated cirrhosis", "liver cirrhosis", "end stage liver disease", "esld"],
        settings=["any"],
        mortality_30d=0.10, mortality_90d=0.20, mortality_1yr=0.35,
        source="Moreau et al., Gastroenterology 2013 (CANONIC); D'Amico et al., J Hepatol 2006",
        primary_finding="Decompensated cirrhosis without ACLF: 28-day mortality 1.9%, 90-day 10.0% (CANONIC, N=1,343); 1-year survival after first decompensation ~60%, median survival 1.6 years (D'Amico et al., J Hepatol 2006, N=1,649). Note: patients developing ACLF have substantially higher mortality.",
        n_patients=1649,
        population_note="Cirrhosis with acute decompensation (without ACLF), hospitalised",
    ),

    # ── Metabolic ─────────────────────────────────────────────────────────────
    _Entry(
        keywords=["diabetic ketoacidosis", "dka"],
        settings=["any"],
        mortality_30d=0.004, mortality_90d=0.010, mortality_1yr=0.03,
        source="Benoit et al., MMWR 2018; Kitabchi et al., Diabetes Care 2009",
        primary_finding="Overall in-hospital case fatality 0.3–0.4% (declined from 0.4% in 2000 to 0.3% in 2014); age ≥65 case fatality 1.2–1.5% — Benoit et al., MMWR 2018, N=2.6 million DKA hospitalisations. Severe/complicated DKA with sepsis or comorbidities: 5–10% (Kitabchi et al., Diabetes Care 2009)",
        n_patients=2600000,
        population_note="Hospitalised DKA, US nationwide (NIS database)",
    ),
    _Entry(
        keywords=["hyperosmolar hyperglycaemic", "hyperosmolar hyperglycemic", "hhs", "honk", "hyperglycaemic hyperosmolar"],
        settings=["any"],
        mortality_30d=0.12, mortality_90d=0.18, mortality_1yr=0.28,
        source="Pasquel & Umpierrez, Diabetes Care 2014",
        primary_finding="In-hospital mortality 5–20% (higher in elderly); 30-day mortality ~12%; higher than DKA due to older patient population (Pasquel & Umpierrez, Diabetes Care 2014)",
        n_patients=None,
        population_note="Hospitalised HHS, predominantly elderly",
    ),

    # ── Pulmonary Embolism ────────────────────────────────────────────────────
    _Entry(
        keywords=["massive pe", "massive pulmonary embolism", "high-risk pe", "high risk pe", "submassive pe"],
        settings=["any"],
        mortality_30d=0.30, mortality_90d=0.52, mortality_1yr=0.58,
        source="Goldhaber et al., Lancet 1999 (ICOPER); Kasper et al., JACC 1997 (MAPPET)",
        primary_finding="Patients with systolic BP <90 mmHg (massive PE): 90-day mortality 52.4% (95% CI 43.3–61.5%) — ICOPER, N=2,454 (Goldhaber et al., Lancet 1999); in-hospital mortality 58.3% in cardiac arrest, 15–25% with haemodynamic compromise (MAPPET, N=1,001 — Kasper et al., JACC 1997)",
        n_patients=2454,
        population_note="Massive/high-risk PE with haemodynamic compromise",
        severity_keywords=["massive", "high-risk", "shock", "arrest"],
    ),
    _Entry(
        keywords=["pulmonary embolism", "pe ", " pe", "pulmonary thromboembolism", "dvt", "vte"],
        settings=["any"],
        mortality_30d=0.114, mortality_90d=0.174, mortality_1yr=0.22,
        source="Goldhaber et al., Lancet 1999 (ICOPER); Cohen et al., Thromb Haemost 2007 (VITAE)",
        primary_finding="30-day mortality 11.4% (95% CI 10.2–12.8%); 3-month mortality 17.4% (95% CI 15.9–18.9%) — ICOPER, N=2,454 across 52 hospitals, 7 countries (Goldhaber et al., Lancet 1999)",
        n_patients=2454,
        population_note="Acute PE all comers, multicentre registry (mixed severity)",
    ),

    # ── GI ───────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["upper gi bleed", "upper gi bleeding", "ugib", "upper gastrointestinal bleed", "variceal bleed", "variceal haemorrhage", "peptic ulcer bleed", "gi haemorrhage"],
        settings=["any"],
        mortality_30d=0.10, mortality_90d=0.15, mortality_1yr=0.25,
        source="Rockall et al., Gut 1996; Hearnshaw et al., Gut 2011 (UK audit)",
        primary_finding="Overall in-hospital mortality 14%; rebleed mortality 40% (Rockall et al., Gut 1996, N=4,185); 30-day mortality 10.2%, rebleed rate 10.4% (UK national audit, N=6,750 — Hearnshaw et al., Gut 2011)",
        n_patients=6750,
        population_note="Acute UGIB, hospitalised (UK national audit)",
    ),
    _Entry(
        keywords=["severe pancreatitis", "necrotising pancreatitis", "necrotizing pancreatitis", "infected pancreatic necrosis"],
        settings=["icu", "any"],
        mortality_30d=0.22, mortality_90d=0.32, mortality_1yr=0.40,
        source="Petrov et al., Gastroenterology 2010; Forsmark et al., NEJM 2016 (review)",
        primary_finding="Infected necrosis + persistent organ failure: mortality 35.2% (95% CI 26.9–44.2%); sterile necrosis + organ failure: 19.8%; infected necrosis alone: 30.0% — Petrov et al., Gastroenterology 2010, meta-analysis N=6,970. Severe AP overall mortality 10–30% (Forsmark et al., NEJM 2016)",
        n_patients=6970,
        population_note="Severe/necrotising acute pancreatitis with organ failure",
        severity_keywords=["severe", "necrotis", "necrotiz", "infected"],
    ),
    _Entry(
        keywords=["pancreatitis", "acute pancreatitis"],
        settings=["any"],
        mortality_30d=0.02, mortality_90d=0.04, mortality_1yr=0.07,
        source="Forsmark et al., NEJM 2016; Yadav & Lowenfels, Gastroenterology 2013",
        primary_finding="Mild AP mortality <1%; overall hospitalised AP in-hospital mortality 1.5–3% (Yadav & Lowenfels, Gastroenterology 2013); ~80% of patients have mild disease and recover within a week (Forsmark et al., NEJM 2016)",
        n_patients=None,
        population_note="Acute pancreatitis all severity, hospitalised (predominantly mild)",
    ),

    # ── Renal ─────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["aki requiring dialysis", "aki-d", "aki on dialysis", "acute kidney injury dialysis", "renal replacement therapy", "rrt", "crrt", "continuous renal replacement"],
        settings=["icu", "any"],
        mortality_30d=0.45, mortality_90d=0.55, mortality_1yr=0.62,
        source="Chertow et al., JASN 2005; Uchino et al., JAMA 2005 (BEST Kidney)",
        primary_finding="ICU AKI-D 60-day mortality 60.3% (BEST Kidney, N=1,738 ICU patients, 54 centres); in-hospital mortality ~45–60%",
        n_patients=1738,
        population_note="ICU AKI requiring renal replacement therapy",
        severity_keywords=["dialysis", "rrt", "crrt", "replacement"],
    ),
    _Entry(
        keywords=["acute kidney injury", "aki", "acute renal failure", "arf"],
        settings=["icu", "any"],
        mortality_30d=0.23, mortality_90d=0.32, mortality_1yr=0.40,
        source="Hoste et al., Intensive Care Med 2015 (AKI-EPI); Chertow et al., JASN 2005",
        primary_finding="90-day mortality: AKI stage 1 20.9%, stage 2 26.6%, stage 3 33.1% (AKI-EPI, N=57,925 ICU patients, 97 ICUs); OR 6.2 (95% CI 5.0–7.6) vs no AKI — Chertow et al.",
        n_patients=57925,
        population_note="ICU AKI (KDIGO staging), multicentre",
    ),

    # ── Cardiac Arrest ────────────────────────────────────────────────────────
    _Entry(
        keywords=["out-of-hospital cardiac arrest", "ohca", "cardiac arrest out of hospital"],
        settings=["icu", "any"],
        mortality_30d=0.75, mortality_90d=0.80, mortality_1yr=0.83,
        source="Berdowski et al., Resuscitation 2010; Gräsner et al., Resuscitation 2016 (EuReCa ONE)",
        primary_finding="Survival to hospital discharge ~8–10% (EuReCa ONE, N=10,682 resuscitated OHCA); 30-day survival ~25% of those admitted to ICU post-ROSC",
        n_patients=10682,
        population_note="OHCA with ROSC, admitted to ICU",
    ),
    _Entry(
        keywords=["in-hospital cardiac arrest", "ihca", "cardiac arrest in hospital"],
        settings=["icu", "any"],
        mortality_30d=0.65, mortality_90d=0.72, mortality_1yr=0.78,
        source="Merchant et al., Resuscitation 2011; Andersen et al., NEJM 2016",
        primary_finding="Survival to hospital discharge ~22–25% IHCA (Merchant et al., GWTG-R, N=433,985); post-arrest ICU mortality ~65% (Andersen et al., NEJM 2016)",
        n_patients=433985,
        population_note="In-hospital cardiac arrest with ROSC",
    ),
    _Entry(
        keywords=["cardiac arrest", "post-resuscitation", "post arrest", "rosc"],
        settings=["icu", "any"],
        mortality_30d=0.70, mortality_90d=0.76, mortality_1yr=0.80,
        source="Berdowski et al., Resuscitation 2010; Nolan et al., Resuscitation 2021",
        primary_finding="Combined OHCA/IHCA: ~25% of admitted post-ROSC patients survive to discharge; 30-day mortality ~70% post-arrest ICU cohort",
        n_patients=None,
        population_note="Post-cardiac arrest ICU admission",
    ),

    # ── Vascular ──────────────────────────────────────────────────────────────
    _Entry(
        keywords=["type a aortic dissection", "type a dissection", "ascending aortic dissection", "aortic dissection type a"],
        settings=["any"],
        mortality_30d=0.20, mortality_90d=0.27, mortality_1yr=0.32,
        source="Trimarchi et al., J Thorac Cardiovasc Surg 2005 (IRAD); Erbel et al., Eur Heart J 2001",
        primary_finding="In-hospital mortality Type A: surgical 26%, medical 58% (IRAD, N=1,010); operative 30-day mortality ~20% (contemporary series)",
        n_patients=1010,
        population_note="Type A aortic dissection, IRAD registry",
    ),
    _Entry(
        keywords=["type b aortic dissection", "type b dissection", "descending aortic dissection", "aortic dissection type b", "aortic dissection"],
        settings=["any"],
        mortality_30d=0.10, mortality_90d=0.15, mortality_1yr=0.22,
        source="Trimarchi et al., J Thorac Cardiovasc Surg 2005 (IRAD)",
        primary_finding="In-hospital mortality Type B uncomplicated ~10%; complicated Type B ~20–25% (IRAD, N=1,010 dissections)",
        n_patients=1010,
        population_note="Type B aortic dissection, IRAD registry",
    ),
    _Entry(
        keywords=["ruptured aaa", "ruptured aortic aneurysm", "ruptured abdominal aortic aneurysm", "raaa"],
        settings=["any"],
        mortality_30d=0.40, mortality_90d=0.50, mortality_1yr=0.58,
        source="Reimerink et al., Ann Surg 2013; Mehta et al., J Vasc Surg 2006",
        primary_finding="30-day mortality rAAA ~40% (operative); overall including pre-hospital deaths ~80%; EVAR for rAAA 30-day mortality ~25–35% (Reimerink et al., N=760)",
        n_patients=760,
        population_note="Ruptured AAA reaching operating theatre",
    ),
    _Entry(
        keywords=["mesenteric ischemia", "acute mesenteric ischaemia", "mesenteric infarction", "bowel ischemia"],
        settings=["any"],
        mortality_30d=0.50, mortality_90d=0.60, mortality_1yr=0.68,
        source="Schoots et al., Br J Surg 2004; Acosta et al., Eur J Vasc Endovasc Surg 2014",
        primary_finding="30-day mortality acute mesenteric ischaemia ~50–80%; arterial occlusion worst prognosis ~80% (Schoots et al., meta-analysis N=3,692)",
        n_patients=3692,
        population_note="Acute mesenteric ischaemia, surgical series",
    ),

    # ── Neuro ─────────────────────────────────────────────────────────────────
    _Entry(
        keywords=["bacterial meningitis", "meningococcal meningitis", "pneumococcal meningitis"],
        settings=["any"],
        mortality_30d=0.20, mortality_90d=0.25, mortality_1yr=0.30,
        source="van de Beek et al., NEJM 2004; Brouwer et al., Nat Rev Neurol 2010",
        primary_finding="In-hospital mortality 21% bacterial meningitis (van de Beek et al., prospective, N=696); pneumococcal 30% vs meningococcal 7%",
        n_patients=696,
        population_note="Adult bacterial meningitis, Dutch national cohort",
    ),
    _Entry(
        keywords=["status epilepticus", "refractory status epilepticus", "non-convulsive status"],
        settings=["any"],
        mortality_30d=0.19, mortality_90d=0.25, mortality_1yr=0.32,
        source="Rossetti et al., Neurology 2006; Sutter et al., Epilepsia 2013",
        primary_finding="30-day mortality status epilepticus 19%; refractory SE 30-day mortality ~39% (Rossetti et al., N=236; Sutter et al. meta-analysis N=1,049)",
        n_patients=1049,
        population_note="Status epilepticus, hospital-based cohorts",
    ),

    # ── Respiratory ───────────────────────────────────────────────────────────
    _Entry(
        keywords=["copd exacerbation", "aecopd", "acute exacerbation copd", "acute exacerbation of copd"],
        settings=["icu"],
        mortality_30d=0.24, mortality_90d=0.33, mortality_1yr=0.43,
        source="Wildman et al., Thorax 2009; Connors et al., AJRCCM 1996 (SUPPORT)",
        primary_finding="AECOPD requiring MV: in-hospital mortality ~24%; 1-year mortality 43% (SUPPORT, N=1,016 COPD patients requiring MV)",
        n_patients=1016,
        population_note="AECOPD requiring ICU / mechanical ventilation",
        severity_keywords=["icu", "ventilat", "intubat", "severe"],
    ),
    _Entry(
        keywords=["copd exacerbation", "aecopd", "acute exacerbation copd", "acute exacerbation of copd", "copd", "chronic obstructive"],
        settings=["floor", "ed", "any"],
        mortality_30d=0.04, mortality_90d=0.10, mortality_1yr=0.22,
        source="Steer et al., Thorax 2012; Roberts et al., Eur Respir J 2002",
        primary_finding="AECOPD hospitalised: 30-day mortality ~4%; 1-year mortality 22% (Steer et al., N=920); DECAF score 0 = 0%, score 6 = 74% in-hospital mortality",
        n_patients=920,
        population_note="AECOPD hospitalised, general ward",
    ),

    # ── Trauma / Burns ────────────────────────────────────────────────────────
    _Entry(
        keywords=["major trauma", "polytrauma", "multiple trauma", "severe trauma"],
        settings=["icu", "any"],
        mortality_30d=0.15, mortality_90d=0.20, mortality_1yr=0.25,
        source="Pfeifer et al., Dtsch Arztebl Int 2016; Champion et al., J Trauma 2010 (NTDB)",
        primary_finding="ISS >15: 30-day mortality ~15%; ISS >25 mortality ~30–40% (NTDB, N=1,000,000+ trauma admissions); 1-year mortality ISS >15 ~25%",
        n_patients=1000000,
        population_note="Major trauma (ISS >15), Level I/II trauma centres",
        severity_keywords=["severe", "iss", "polytrauma", "critical"],
    ),
    _Entry(
        keywords=["burns", "burn injury", "thermal injury"],
        settings=["icu", "any"],
        mortality_30d=0.15, mortality_90d=0.20, mortality_1yr=0.25,
        source="Baux score / Revised Baux; Ryan et al., J Burn Care Rehabil 1998; ABA National Burn Repository",
        primary_finding=">40% TBSA: 30-day mortality ~40–60%; Revised Baux score (age + %TBSA + inhalation injury) ≥140 mortality ~90% (ABA Repository, N=192,672)",
        n_patients=192672,
        population_note="Burn injury, ABA centres; >40% TBSA subgroup mortality higher",
    ),

    # ── Haematology / Oncology ────────────────────────────────────────────────
    _Entry(
        keywords=["neutropenic fever", "febrile neutropenia", "neutropenic sepsis"],
        settings=["any"],
        mortality_30d=0.05, mortality_90d=0.10, mortality_1yr=0.20,
        source="Kuderer et al., Cancer 2006; Klastersky et al., JCO 2006 (MASCC)",
        primary_finding="In-hospital mortality febrile neutropenia ~5–8% overall; high-risk (MASCC <21) ~30-day mortality ~21% (Kuderer et al., N=41,779 hospitalised episodes)",
        n_patients=41779,
        population_note="Febrile neutropenia, oncology patients",
    ),
    _Entry(
        keywords=["haematologic malignancy icu", "hematologic malignancy icu", "haematological cancer icu", "leukaemia icu", "lymphoma icu", "bone marrow transplant icu", "bmt icu", "stem cell transplant icu"],
        settings=["icu"],
        mortality_30d=0.45, mortality_90d=0.55, mortality_1yr=0.65,
        source="Azoulay et al., Crit Care Med 2013; Mokart et al., Haematologica 2013",
        primary_finding="ICU mortality haematologic malignancy ~45–60%; 30-day mortality ~45%; 1-year ~65% (Azoulay et al., N=1,011 haematology ICU admissions)",
        n_patients=1011,
        population_note="Haematologic malignancy admitted to ICU",
    ),

    # ── Vascular / Hypertensive ───────────────────────────────────────────────
    _Entry(
        keywords=["hypertensive emergency", "hypertensive crisis", "malignant hypertension", "hypertensive encephalopathy"],
        settings=["any"],
        mortality_30d=0.07, mortality_90d=0.12, mortality_1yr=0.20,
        source="van den Born et al., Eur Heart J 2019; Shea et al., Am J Hypertens 2016",
        primary_finding="In-hospital mortality hypertensive emergency ~5–8%; 30-day ~7%; 1-year mortality ~20% (largely driven by underlying organ damage); van den Born et al., N=2,748",
        n_patients=2748,
        population_note="Hypertensive emergency with end-organ damage",
    ),

    # ── Generic perioperative / post-op ──────────────────────────────────────
    _Entry(
        keywords=["post-operative", "postoperative", "post operative", "post-op", "after surgery", "post cardiac surgery", "post bypass"],
        settings=["icu"],
        mortality_30d=0.04, mortality_90d=0.07, mortality_1yr=0.12,
        source="Pearse et al., Lancet 2012 (EuSOS); Khuri et al., Ann Surg 1995 (NSQIP)",
        primary_finding="30-day in-hospital mortality post major non-cardiac surgery ~4% (EuSOS, N=46,539 across 28 European countries)",
        n_patients=46539,
        population_note="Major non-cardiac surgery, ICU admission",
    ),
]
# fmt: on


def _match_diagnosis(primary_dx: str, admission_type: str) -> Optional[_Entry]:
    """Return the best matching literature entry for a given diagnosis string."""
    dx_lower = primary_dx.lower()

    # Two-pass: first try severity-keyword boosted entries, then all entries
    for strict in (True, False):
        for entry in _LITERATURE:
            # Setting filter
            if "any" not in entry.settings and admission_type not in entry.settings:
                continue

            # Keyword match
            matched = any(kw in dx_lower for kw in entry.keywords)
            if not matched:
                continue

            # In strict pass, also require a severity keyword if entry defines them
            if strict and entry.severity_keywords:
                if not any(sk in dx_lower for sk in entry.severity_keywords):
                    continue

            return entry

    return None


def _admission_type_fallback(admission_type: str) -> BaselineResult:
    """Last-resort fallback using broad admission-type averages."""
    _TABLE = {
        "icu":        (0.15, 0.22, 0.30),
        "floor":      (0.03, 0.06, 0.10),
        "ed":         (0.02, 0.04, 0.08),
        "outpatient": (0.001, 0.003, 0.008),
    }
    m30, m90, m1y = _TABLE.get(admission_type, (0.05, 0.10, 0.18))
    return BaselineResult(
        mortality_30d=m30, mortality_90d=m90, mortality_1yr=m1y,
        source="General population estimate by admission setting",
        primary_finding=f"Broad {admission_type.upper()} population average — no diagnosis-specific study identified",
        matched_diagnosis="(admission type fallback)",
        match_method="fallback",
    )


# ---------------------------------------------------------------------------
# LLM agent fallback for unlisted diagnoses
# ---------------------------------------------------------------------------

_BASELINE_SYSTEM = """You are a clinical epidemiology expert. Given a patient diagnosis, return the
best-available published mortality estimate from a specific study, registry, or systematic review.

Respond ONLY with valid JSON — no prose, no markdown:
{
  "mortality_30d": <float 0-1>,
  "mortality_90d": <float 0-1>,
  "mortality_1yr":  <float 0-1>,
  "source": "<Author et al., Journal Year>",
  "primary_finding": "<verbatim key result from the paper, e.g. '30-day mortality 18.4% (95% CI 15.2–21.6%), N=2,341'>",
  "n_patients": <integer or null>,
  "population_note": "<brief description of the study population>"
}

Rules:
- Only cite real studies. Do not fabricate numbers.
- Prefer the largest or most recent registry / systematic review.
- If no specific study exists, use the closest analogous condition and note it.
- Mortality should reflect the typical hospitalised/ICU population for this diagnosis.
"""


async def _llm_baseline(
    primary_dx: str,
    admission_type: str,
    api_key: Optional[str],
    base_url: Optional[str],
    model: Optional[str],
    use_anthropic: bool,
) -> Optional[BaselineResult]:
    """Ask the configured LLM for a mortality baseline for an unknown diagnosis."""
    prompt = (
        f"Diagnosis: {primary_dx}\n"
        f"Admission setting: {admission_type.upper()}\n\n"
        "What is the best published mortality estimate for this condition? "
        "Respond with JSON only."
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if use_anthropic:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                    json={"model": model or "claude-sonnet-4-6", "system": _BASELINE_SYSTEM,
                          "messages": [{"role": "user", "content": prompt}], "max_tokens": 512},
                )
            else:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model or "gpt-4o-mini", "temperature": 0.1, "max_tokens": 512,
                          "messages": [{"role": "system", "content": _BASELINE_SYSTEM},
                                       {"role": "user", "content": prompt}]},
                )
            resp.raise_for_status()
            data = resp.json()
            text = (data["content"][0]["text"] if use_anthropic else data["choices"][0]["message"]["content"])

            # Strip markdown fences if present
            text = re.sub(r"```(?:json)?", "", text).strip().strip("`")
            d = json.loads(text)
            return BaselineResult(
                mortality_30d=float(d["mortality_30d"]),
                mortality_90d=float(d["mortality_90d"]),
                mortality_1yr=float(d["mortality_1yr"]),
                source=d.get("source", "LLM-retrieved"),
                primary_finding=d.get("primary_finding", ""),
                matched_diagnosis=primary_dx,
                match_method="llm",
                n_patients=d.get("n_patients"),
                population_note=d.get("population_note"),
            )
    except Exception:
        return None


async def get_baseline(patient: PatientInput) -> BaselineResult:
    """Return the best available mortality baseline for this patient.

    Priority: literature match → LLM lookup → admission-type fallback.
    """
    primary_dx = patient.diagnosis.primary_diagnosis
    admission = patient.diagnosis.admission_type.value

    # 1. Literature match
    entry = _match_diagnosis(primary_dx, admission)
    if entry:
        return BaselineResult(
            mortality_30d=entry.mortality_30d,
            mortality_90d=entry.mortality_90d,
            mortality_1yr=entry.mortality_1yr,
            source=entry.source,
            primary_finding=entry.primary_finding,
            matched_diagnosis=entry.keywords[0],
            match_method="literature",
            n_patients=entry.n_patients,
            population_note=entry.population_note,
        )

    # 2. LLM fallback
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    llm_key = os.getenv("LLM_API_KEY")
    if anthropic_key or llm_key:
        result = await _llm_baseline(
            primary_dx=primary_dx,
            admission_type=admission,
            api_key=anthropic_key or llm_key,
            base_url=os.getenv("LLM_BASE_URL", "https://api.openai.com/v1"),
            model=os.getenv("ANTHROPIC_MODEL") or os.getenv("LLM_MODEL"),
            use_anthropic=bool(anthropic_key),
        )
        if result:
            return result

    # 3. Admission-type fallback
    return _admission_type_fallback(admission)
