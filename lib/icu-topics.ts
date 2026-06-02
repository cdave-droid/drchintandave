// Curated ICU physiology topics for the "Physiology Spinner" content tool.
// Each topic carries the core physiologic concept to anchor a ~1 minute video.

export type TopicCategory =
  | "Shock"
  | "Pulmonary"
  | "Cardiac"
  | "Metabolic"
  | "Renal"
  | "Neuro"
  | "Hepatic / GI"
  | "Heme"
  | "Toxicology";

export interface IcuTopic {
  /** Short display name shown on the reel, e.g. "DKA". */
  name: string;
  /** Expanded name for the reveal card, e.g. "Diabetic Ketoacidosis". */
  full: string;
  category: TopicCategory;
  /** The one-line physiologic hook to explain on camera. */
  concept: string;
}

export const CATEGORY_COLORS: Record<TopicCategory, string> = {
  Shock: "#e53e3e",
  Pulmonary: "#3182ce",
  Cardiac: "#d53f8c",
  Metabolic: "#dd6b20",
  Renal: "#38a169",
  Neuro: "#805ad5",
  "Hepatic / GI": "#b7791f",
  Heme: "#c53030",
  Toxicology: "#0d9488",
};

export const ICU_TOPICS: IcuTopic[] = [
  // ---- Shock ----
  {
    name: "Septic Shock",
    full: "Septic Shock",
    category: "Shock",
    concept:
      "Distributive shock: a dysregulated host response drives NO-mediated vasoplegia, capillary leak, and microcirculatory failure — high cardiac output but oxygen extraction fails.",
  },
  {
    name: "Cardiogenic Shock",
    full: "Cardiogenic Shock",
    category: "Shock",
    concept:
      "The pump fails: low cardiac output with high filling pressures. Walk the spiral of falling coronary perfusion → worsening ischemia → falling output.",
  },
  {
    name: "Hypovolemic Shock",
    full: "Hypovolemic Shock",
    category: "Shock",
    concept:
      "Preload collapse: lost intravascular volume drops venous return and stroke volume. Frank–Starling and the compensatory tachycardia/vasoconstriction.",
  },
  {
    name: "Obstructive Shock",
    full: "Obstructive Shock",
    category: "Shock",
    concept:
      "A mechanical block to flow — tamponade, massive PE, or tension pneumothorax — strangles preload or RV output despite a normal heart and tank.",
  },
  {
    name: "Anaphylaxis",
    full: "Anaphylactic Shock",
    category: "Shock",
    concept:
      "IgE-triggered mast cell degranulation: histamine-driven vasodilation and capillary leak cause distributive shock — and why epinephrine reverses each arm.",
  },

  // ---- Pulmonary ----
  {
    name: "ARDS",
    full: "Acute Respiratory Distress Syndrome",
    category: "Pulmonary",
    concept:
      "Diffuse alveolar damage floods alveoli → intrapulmonary shunt and stiff, low-compliance lungs. Hypoxemia refractory to oxygen because blood bypasses gas exchange.",
  },
  {
    name: "Massive PE",
    full: "Massive Pulmonary Embolism",
    category: "Pulmonary",
    concept:
      "Acute RV afterload spike: the thin-walled RV can't generate pressure, dilates, and fails — septal bowing chokes LV filling and output crashes.",
  },
  {
    name: "Status Asthmaticus",
    full: "Status Asthmaticus",
    category: "Pulmonary",
    concept:
      "Severe airflow obstruction → dynamic hyperinflation and auto-PEEP. Breath stacking raises intrathoracic pressure and impairs venous return.",
  },
  {
    name: "COPD Exacerbation",
    full: "COPD Exacerbation",
    category: "Pulmonary",
    concept:
      "V/Q mismatch and dead space drive CO2 retention; the physiology of chronic compensation and why oxygen must be titrated, not flooded.",
  },
  {
    name: "Flash Pulmonary Edema",
    full: "Acute Cardiogenic Pulmonary Edema",
    category: "Pulmonary",
    concept:
      "Starling forces tip: a sudden rise in pulmonary capillary hydrostatic pressure forces fluid into alveoli faster than lymphatics can clear it.",
  },

  // ---- Cardiac ----
  {
    name: "Acute MI",
    full: "Acute Myocardial Infarction",
    category: "Cardiac",
    concept:
      "Coronary occlusion → the ischemic cascade: supply/demand mismatch, loss of contractility, then the electrical instability of injured myocardium.",
  },
  {
    name: "AFib with RVR",
    full: "Atrial Fibrillation with Rapid Ventricular Response",
    category: "Cardiac",
    concept:
      "Loss of atrial kick plus a short diastole: rate-related drop in filling and cardiac output, especially in a stiff ventricle.",
  },
  {
    name: "Cardiac Tamponade",
    full: "Cardiac Tamponade",
    category: "Cardiac",
    concept:
      "Pericardial pressure impairs diastolic filling — ventricular interdependence and pulsus paradoxus explained from first principles.",
  },
  {
    name: "ADHF",
    full: "Acute Decompensated Heart Failure",
    category: "Cardiac",
    concept:
      "Congestion physiology: the failing ventricle climbs a flat Frank–Starling curve while neurohormonal activation worsens afterload and retains salt and water.",
  },
  {
    name: "Cardiac Arrest",
    full: "Cardiac Arrest",
    category: "Cardiac",
    concept:
      "No-flow vs low-flow states: why chest compression quality, coronary perfusion pressure, and the cardiac arrest physiology drive ROSC.",
  },

  // ---- Metabolic / Endocrine / Acid–Base ----
  {
    name: "DKA",
    full: "Diabetic Ketoacidosis",
    category: "Metabolic",
    concept:
      "Insulin deficiency + counter-regulatory surge → unchecked ketogenesis and a high anion-gap metabolic acidosis, with osmotic diuresis driving the volume deficit.",
  },
  {
    name: "HHS",
    full: "Hyperosmolar Hyperglycemic State",
    category: "Metabolic",
    concept:
      "Just enough insulin to suppress ketogenesis but not hyperglycemia: profound hyperosmolarity and total-body water depletion without significant acidosis.",
  },
  {
    name: "Thyroid Storm",
    full: "Thyroid Storm",
    category: "Metabolic",
    concept:
      "A hypermetabolic, catecholamine-hypersensitive state: increased adrenergic receptor expression amplifies thyroid hormone into multi-organ failure.",
  },
  {
    name: "Adrenal Crisis",
    full: "Adrenal Crisis",
    category: "Metabolic",
    concept:
      "Cortisol deficiency → loss of vascular tone (catecholamine permissiveness) and impaired gluconeogenesis: vasodilatory shock plus hypoglycemia.",
  },
  {
    name: "Severe Hyponatremia",
    full: "Severe Hyponatremia",
    category: "Metabolic",
    concept:
      "Water balance, not salt: osmotic gradients pull water into brain cells. Cerebral edema vs the risk of osmotic demyelination with overly fast correction.",
  },
  {
    name: "Hyperkalemia",
    full: "Severe Hyperkalemia",
    category: "Metabolic",
    concept:
      "Rising extracellular K+ collapses the resting membrane potential gradient — progressive cardiac conduction block and the rationale for calcium.",
  },
  {
    name: "Lactic Acidosis",
    full: "Lactic Acidosis",
    category: "Metabolic",
    concept:
      "Type A (hypoperfusion, anaerobic glycolysis) vs Type B (impaired clearance/metabolism): lactate as a marker of the oxygen delivery–demand balance.",
  },

  // ---- Renal ----
  {
    name: "AKI",
    full: "Acute Kidney Injury",
    category: "Renal",
    concept:
      "Pre-renal, intrinsic, post-renal: walk the physiology of renal perfusion, tubular injury, and how GFR and tubuloglomerular feedback respond.",
  },
  {
    name: "Rhabdomyolysis",
    full: "Rhabdomyolysis",
    category: "Renal",
    concept:
      "Myoglobin release causes tubular obstruction, direct toxicity, and renal vasoconstriction — the three-hit mechanism of pigment nephropathy.",
  },
  {
    name: "Tumor Lysis",
    full: "Tumor Lysis Syndrome",
    category: "Renal",
    concept:
      "Massive cell turnover dumps potassium, phosphate, and uric acid into the blood: crystal nephropathy and the electrolyte storm that follows.",
  },

  // ---- Neuro ----
  {
    name: "Status Epilepticus",
    full: "Status Epilepticus",
    category: "Neuro",
    concept:
      "Failure of seizure termination: GABA receptors internalize while glutamate drives excitotoxicity and a metabolic supply–demand crisis in neurons.",
  },
  {
    name: "Raised ICP",
    full: "Raised Intracranial Pressure",
    category: "Neuro",
    concept:
      "The Monro–Kellie doctrine: a fixed skull volume means brain, blood, and CSF trade off. Cerebral perfusion pressure = MAP − ICP.",
  },
  {
    name: "Ischemic Stroke",
    full: "Acute Ischemic Stroke",
    category: "Neuro",
    concept:
      "The ischemic penumbra: tissue at risk but salvageable. Cerebral autoregulation and why perfusion pressure matters in the acute window.",
  },
  {
    name: "SAH",
    full: "Subarachnoid Hemorrhage",
    category: "Neuro",
    concept:
      "An ICP spike at ictus, then delayed cerebral ischemia from vasospasm — the two-phase physiology that drives outcomes.",
  },

  // ---- Hepatic / GI ----
  {
    name: "Acute Liver Failure",
    full: "Acute Liver Failure",
    category: "Hepatic / GI",
    concept:
      "Loss of synthetic and clearance function: ammonia-driven cerebral edema, coagulopathy, and vasodilatory, high-output circulation.",
  },
  {
    name: "Severe Pancreatitis",
    full: "Severe Acute Pancreatitis",
    category: "Hepatic / GI",
    concept:
      "Autodigestion triggers a SIRS response: massive third-spacing, capillary leak, and distributive-plus-hypovolemic shock physiology.",
  },
  {
    name: "Massive GI Bleed",
    full: "Massive Gastrointestinal Hemorrhage",
    category: "Hepatic / GI",
    concept:
      "Hemorrhagic shock: the oxygen delivery equation (DO2) collapses as hemoglobin and preload fall — the rationale for balanced resuscitation.",
  },

  // ---- Heme ----
  {
    name: "DIC",
    full: "Disseminated Intravascular Coagulation",
    category: "Heme",
    concept:
      "Systemic clotting activation consumes platelets and factors: simultaneous microthrombosis and bleeding — the consumptive coagulopathy paradox.",
  },

  // ---- Toxicology ----
  {
    name: "Salicylate Tox",
    full: "Salicylate Toxicity",
    category: "Toxicology",
    concept:
      "Uncoupling of oxidative phosphorylation plus respiratory center stimulation: the classic mixed respiratory alkalosis and anion-gap metabolic acidosis.",
  },
  {
    name: "BB / CCB Overdose",
    full: "Beta-Blocker / Calcium-Channel-Blocker Overdose",
    category: "Toxicology",
    concept:
      "Negative inotropy and chronotropy at the receptor level: impaired calcium handling and the metabolic rationale for high-dose insulin therapy.",
  },
  {
    name: "Carbon Monoxide",
    full: "Carbon Monoxide Poisoning",
    category: "Toxicology",
    concept:
      "CO binds hemoglobin and left-shifts the dissociation curve: oxygen content drops and what's left won't unload to tissues — cellular hypoxia with a 'normal' PaO2.",
  },
];

export const CATEGORIES = Array.from(
  new Set(ICU_TOPICS.map((t) => t.category)),
) as TopicCategory[];
