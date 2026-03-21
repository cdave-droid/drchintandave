// ── Game Case Types ─────────────────────────────────────────────────────────

export type DiffOption = {
  id: string
  label: string
  is_correct?: boolean // hidden from player; used for scoring
}

export type LabOption = {
  id: string
  name: string
  category: string
  classification: 'KEY' | 'SUPPORTIVE' | 'IRRELEVANT'
  result: string
  reference_range?: string
  flag?: 'HIGH' | 'LOW' | 'CRITICAL' | null
}

export type FocusedTestOption = {
  id: string
  name: string
  type: 'imaging' | 'procedure' | 'ecg' | 'consult'
  result: string
  is_expert_pick?: boolean
}

export type ManagementOption = {
  id: string
  text: string
  is_correct: boolean
  explanation?: string
}

export type ClinchOption = {
  id: string
  text: string
  is_correct: boolean
}

export type ExpertPath = {
  differentials: string[] // diff option ids (up to 3)
  labs: string[] // lab option ids
  focused_tests: string[] // focused test ids
  final_diagnosis: string // diff option id
  management: string // management option id
  rationale: string
}

export type GameCase = {
  id: string
  case_number: number
  title: string
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  specialty: string
  status: string

  // Stage 1 — Presentation
  vignette: string

  // Differentials
  differential_options: DiffOption[]
  correct_differentials: string[]

  // Stage 2 — Lab ordering
  lab_options: LabOption[]
  max_labs: number

  // Stage 3 — Focused tests (1 pick)
  focused_test_options: FocusedTestOption[]

  // Narrative shown after labs are revealed
  post_labs_narrative: string

  // Stage 5 — Final diagnosis id (must be in differential_options)
  correct_diagnosis: string

  // Stage 6 — Management
  management_question: string
  management_options: ManagementOption[]

  // Stage 7 — Clincher
  clincher_question: string
  clincher_options: ClinchOption[]
  clincher_explanation: string

  // Results
  expert_path: ExpertPath
  teaching_points: string[]

  scoring: {
    differential_correct_each: number
    diagnosis_correct: number
    lab_key_correct: number
    lab_efficiency_bonus: number
    focused_test_bonus: number
    management_correct: number
    clincher_correct: number
    speed_max: number
  }
}

export type DiffChangeEvent = {
  stage: number
  action: 'add' | 'remove'
  id: string
  label: string
  ts: number // seconds since game start
}

export type SessionResult = {
  score: number
  max_score: number
  score_diagnosis: number
  score_workup: number
  score_management: number
  score_clincher: number
  score_speed: number
  percentile: number
  diagnosis_changed: boolean
  final_diagnosis_label: string
  management_correct: boolean
  clincher_correct: boolean
}

// ── Mock Case ────────────────────────────────────────────────────────────────

export const MOCK_CASE: GameCase = {
  id: 'mock-001',
  case_number: 1,
  title: '62-Year-Old Male with Chest Pain',
  difficulty: 'medium',
  specialty: 'cardiology',
  status: 'active',

  vignette: `A 62-year-old man with a history of **hypertension** and **hyperlipidemia** (former smoker, 30 pack-years, quit 5 years ago) presents to the emergency department with a **sudden-onset crushing chest pain** that began approximately 2 hours ago. The pain started at rest (8/10 severity), radiates to his **left arm and jaw**, and is associated with **diaphoresis** and mild shortness of breath. He denies fever, cough, or recent immobilization.

**Medications:** Lisinopril 10 mg daily, Atorvastatin 40 mg nightly.

**Vitals:** BP 148/92 mmHg | HR 98 bpm | RR 18/min | SpO₂ 97% on room air | Temp 37.0 °C

**Physical Exam:** Alert, diaphoretic, in moderate distress. JVP not elevated. Heart sounds: S1/S2 present, no murmurs or rubs. Lungs: clear to auscultation bilaterally. No lower extremity edema. Peripheral pulses intact.`,

  differential_options: [
    { id: 'stemi', label: 'STEMI', is_correct: true },
    { id: 'nstemi', label: 'NSTEMI / Unstable Angina', is_correct: true },
    { id: 'pe', label: 'Pulmonary Embolism', is_correct: false },
    { id: 'dissection', label: 'Aortic Dissection', is_correct: false },
    { id: 'pericarditis', label: 'Pericarditis / Myocarditis', is_correct: false },
    { id: 'gerd', label: 'GERD / Esophageal Spasm', is_correct: false },
    { id: 'msk', label: 'Musculoskeletal Chest Pain', is_correct: false },
    { id: 'panic', label: 'Anxiety / Panic Attack', is_correct: false },
  ],
  correct_differentials: ['stemi', 'nstemi'],

  lab_options: [
    {
      id: 'ecg',
      name: '12-Lead ECG',
      category: 'Cardiac',
      classification: 'KEY',
      result: '**ST elevation 2–3 mm in leads V1–V4** (anterior pattern). Reciprocal ST depression in II, III, aVF. No prior ECG for comparison.',
      reference_range: 'Normal sinus, no ST changes',
      flag: 'CRITICAL',
    },
    {
      id: 'troponin',
      name: 'High-Sensitivity Troponin I',
      category: 'Cardiac',
      classification: 'KEY',
      result: '**0.85 ng/mL** (> 20× upper limit of normal)',
      reference_range: '< 0.04 ng/mL',
      flag: 'CRITICAL',
    },
    {
      id: 'bnp',
      name: 'BNP',
      category: 'Cardiac',
      classification: 'SUPPORTIVE',
      result: '45 pg/mL — within normal limits',
      reference_range: '< 100 pg/mL',
      flag: null,
    },
    {
      id: 'ddimer',
      name: 'D-Dimer',
      category: 'Coagulation',
      classification: 'SUPPORTIVE',
      result: '0.3 µg/mL FEU — within normal limits',
      reference_range: '< 0.50 µg/mL',
      flag: null,
    },
    {
      id: 'cbc',
      name: 'CBC',
      category: 'Hematology',
      classification: 'IRRELEVANT',
      result: 'WBC 11.2 × 10³/µL | Hgb 14.1 g/dL | Plt 245 × 10³/µL',
      reference_range: 'WBC 4.5–11.0 | Hgb 13.5–17.5 | Plt 150–400',
      flag: 'HIGH',
    },
    {
      id: 'bmp',
      name: 'Basic Metabolic Panel',
      category: 'Chemistry',
      classification: 'SUPPORTIVE',
      result: 'Na 138 | K 4.2 | Cl 101 | CO₂ 24 | Cr 1.1 | Glucose 128 mg/dL',
      reference_range: 'Na 136–145 | K 3.5–5.0 | Cr 0.7–1.3 | Gluc 70–100',
      flag: 'HIGH',
    },
    {
      id: 'lipase',
      name: 'Lipase',
      category: 'GI',
      classification: 'IRRELEVANT',
      result: '38 U/L — within normal limits',
      reference_range: '< 60 U/L',
      flag: null,
    },
  ],
  max_labs: 4,

  focused_test_options: [
    {
      id: 'echo',
      name: 'Bedside Echocardiogram',
      type: 'procedure',
      result: '**Anterior and apical wall motion abnormality** noted. EF visually estimated ~40–45%. No pericardial effusion. No significant valvular pathology.',
      is_expert_pick: true,
    },
    {
      id: 'cxr',
      name: 'Portable Chest X-Ray',
      type: 'imaging',
      result: 'No widened mediastinum, no pleural effusion, no pulmonary edema. Cardiomediastinal silhouette within normal limits.',
      is_expert_pick: false,
    },
    {
      id: 'ct_chest',
      name: 'CT Chest (PE Protocol)',
      type: 'imaging',
      result: 'No pulmonary embolism identified. No aortic dissection. Significant radiation and contrast exposure — not typically indicated when STEMI is likely.',
      is_expert_pick: false,
    },
    {
      id: 'cardiology',
      name: 'Urgent Cardiology Consult',
      type: 'consult',
      result: 'Cardiology agrees with STEMI diagnosis. Recommends immediate cath lab activation. Note: activating the cath lab directly is preferred and faster.',
      is_expert_pick: false,
    },
  ],

  post_labs_narrative: `**High-sensitivity Troponin I** returns markedly elevated at 0.85 ng/mL (> 20× URL), indicating significant myocardial injury. The **12-lead ECG** confirms **2–3 mm ST elevation in V1–V4** — an anterior pattern consistent with an acute occlusion of the proximal LAD. D-dimer is negative, making PE unlikely. BNP is normal, arguing against acute decompensated heart failure as the primary driver.`,

  correct_diagnosis: 'stemi',

  management_question:
    'Given your diagnosis, what is the most appropriate **immediate** next step for this patient?',
  management_options: [
    {
      id: 'pci',
      text: 'Activate the cardiac catheterization lab for emergent primary PCI',
      is_correct: true,
      explanation:
        'Primary PCI is the gold-standard reperfusion strategy for STEMI with a door-to-balloon target of < 90 minutes. Immediate cath lab activation minimizes ischemic time.',
    },
    {
      id: 'heparin_admit',
      text: 'Start IV unfractionated heparin and admit to CCU for observation',
      is_correct: false,
      explanation:
        'Anticoagulation alone is insufficient for STEMI. This approach would dangerously delay reperfusion.',
    },
    {
      id: 'nitro_wait',
      text: 'Administer sublingual nitroglycerin and aspirin, then reassess in 30 minutes',
      is_correct: false,
      explanation:
        'Waiting 30 minutes is unacceptable when STEMI is confirmed. Every minute of delay increases myocardial necrosis.',
    },
    {
      id: 'ctpa',
      text: 'Order CT pulmonary angiography to exclude PE before proceeding',
      is_correct: false,
      explanation:
        'The negative D-dimer and classic ECG findings make PE extremely unlikely. CTPA would delay definitive treatment.',
    },
    {
      id: 'cardio_consult',
      text: 'Page cardiology for urgent consultation and await their arrival',
      is_correct: false,
      explanation:
        'Waiting for a consultant to arrive delays cath lab activation. ED physicians should initiate the cath lab call directly.',
    },
  ],

  clincher_question:
    'Based on the ECG pattern (ST elevation V1–V4), which coronary artery is most likely the culprit vessel?',
  clincher_options: [
    { id: 'lad', text: 'Left Anterior Descending (LAD) artery', is_correct: true },
    { id: 'lcx', text: 'Left Circumflex (LCx) artery', is_correct: false },
    { id: 'rca', text: 'Right Coronary Artery (RCA)', is_correct: false },
    { id: 'lm', text: 'Left Main Coronary Artery', is_correct: false },
  ],
  clincher_explanation:
    'The LAD supplies the anterior wall and septum. ST elevation in the precordial leads V1–V4 is the classic ECG signature of **proximal LAD occlusion**. The LCx causes lateral STEMI (I, aVL, V5–V6), while the RCA causes inferior STEMI (II, III, aVF). Left main occlusion would cause a more diffuse, hemodynamically catastrophic presentation.',

  expert_path: {
    differentials: ['stemi', 'nstemi', 'dissection'],
    labs: ['ecg', 'troponin', 'bmp'],
    focused_tests: ['echo'],
    final_diagnosis: 'stemi',
    management: 'pci',
    rationale:
      'ECG and troponin confirm STEMI immediately. A bedside echo rapidly assesses wall motion and rules out effusion. BMP checks renal function before contrast. Aortic dissection stays in the differential until the ECG + bedside echo make it very unlikely.',
  },

  teaching_points: [
    'ST elevation in V1–V4 localizes to the **anterior wall** — supplied by the **LAD artery**.',
    '**Door-to-balloon time < 90 minutes** is the national quality benchmark for STEMI.',
    'High-sensitivity troponin > 20× URL in the right clinical context is virtually diagnostic of STEMI.',
    'D-dimer is very sensitive for PE — a normal D-dimer in a low-pretest probability patient effectively rules it out.',
    'Bedside echo provides rapid assessment of wall motion, EF, and pericardial effusion in undifferentiated chest pain.',
    'Do NOT use nitrates if inferior STEMI with RV involvement is suspected (risk of severe hypotension).',
  ],

  scoring: {
    differential_correct_each: 50,
    diagnosis_correct: 150,
    lab_key_correct: 40,
    lab_efficiency_bonus: 40,
    focused_test_bonus: 40,
    management_correct: 200,
    clincher_correct: 50,
    speed_max: 50,
  },
}
