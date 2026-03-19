"use client";

import { useState } from "react";
import type {
  PredictionRequest,
  OutcomeType,
  Demographics,
  Vitals,
  Labs,
  Diagnosis,
  Interventions,
  VentMode,
  AdmissionType,
} from "@/lib/clinical/types";
import { COMORBIDITY_OPTIONS, OUTCOME_LABELS } from "@/lib/clinical/types";
import { cleanPayload } from "@/lib/clinical/utils";
import {
  User,
  Heart,
  TestTube,
  Stethoscope,
  Syringe,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface Props {
  onSubmit: (request: PredictionRequest) => void;
  loading: boolean;
}

function NumberInput({
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--mp-muted)] mb-1">
        {label} {unit && <span className="opacity-60">({unit})</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step || "any"}
        className="w-full rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--mp-border)] rounded-lg bg-[var(--mp-bg-card)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:opacity-80"
      >
        <Icon className="w-4 h-4 text-[var(--mp-primary)]" />
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto">
          {open ? (
            <ChevronUp className="w-4 h-4 text-[var(--mp-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--mp-muted)]" />
          )}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

export function PatientForm({ onSubmit, loading }: Props) {
  // Demographics
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [bmi, setBmi] = useState("");

  // Vitals
  const [hr, setHr] = useState("");
  const [sbp, setSbp] = useState("");
  const [dbp, setDbp] = useState("");
  const [map, setMap] = useState("");
  const [rr, setRr] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [fio2, setFio2] = useState("");
  const [gcs, setGcs] = useState("");
  const [uo, setUo] = useState("");

  // Labs
  const [cr, setCr] = useState("");
  const [bun, setBun] = useState("");
  const [k, setK] = useState("");
  const [na, setNa] = useState("");
  const [bicarb, setBicarb] = useState("");
  const [bili, setBili] = useState("");
  const [ast, setAst] = useState("");
  const [alt, setAlt] = useState("");
  const [albumin, setAlbumin] = useState("");
  const [inr, setInr] = useState("");
  const [hgb, setHgb] = useState("");
  const [hct, setHct] = useState("");
  const [wbc, setWbc] = useState("");
  const [plt, setPlt] = useState("");
  const [lactate, setLactate] = useState("");
  const [glucose, setGlucose] = useState("");
  const [hba1c, setHba1c] = useState("");
  const [troponin, setTroponin] = useState("");
  const [bnp, setBnp] = useState("");
  const [ph, setPh] = useState("");
  const [pao2, setPao2] = useState("");
  const [paco2, setPaco2] = useState("");

  // Diagnosis
  const [primaryDx, setPrimaryDx] = useState("");
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [admissionType, setAdmissionType] = useState<AdmissionType>("floor");
  const [isSurgical, setIsSurgical] = useState(false);
  const [isPostop, setIsPostop] = useState(false);

  // Interventions
  const [onPressors, setOnPressors] = useState(false);
  const [pressorCount, setPressorCount] = useState("0");
  const [ventMode, setVentMode] = useState<VentMode>("none");
  const [peep, setPeep] = useState("");
  const [onDialysis, setOnDialysis] = useState(false);
  const [onEcmo, setOnEcmo] = useState(false);
  const [onAbx, setOnAbx] = useState(false);
  const [onAnticoag, setOnAnticoag] = useState(false);

  // Outcomes selection
  const allOutcomes: OutcomeType[] = [
    "mortality_30d", "mortality_90d", "mortality_1yr",
    "need_for_dialysis", "ventilator_dependence", "cardiac_event",
    "diabetes_complications", "icu_length_of_stay", "readmission_30d",
    "functional_decline", "aki_progression", "hepatic_decompensation",
  ];
  const [selectedOutcomes, setSelectedOutcomes] = useState<OutcomeType[]>([
    "mortality_30d", "mortality_90d", "mortality_1yr",
  ]);

  function toggleOutcome(outcome: OutcomeType) {
    setSelectedOutcomes((prev) =>
      prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome]
    );
  }

  function toggleComorbidity(value: string) {
    setComorbidities((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  function n(val: string): number | undefined {
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!age || !primaryDx) return;

    const demographics: Demographics = { age: parseInt(age), sex, bmi: n(bmi) };

    const vitals: Vitals = cleanPayload({
      heart_rate: n(hr), systolic_bp: n(sbp), diastolic_bp: n(dbp),
      mean_arterial_pressure: n(map), respiratory_rate: n(rr), temperature: n(temp),
      spo2: n(spo2), fio2: n(fio2), gcs_total: n(gcs), urine_output_24h: n(uo),
    }) as Vitals;

    const labs: Labs = cleanPayload({
      creatinine: n(cr), bun: n(bun), potassium: n(k), sodium: n(na),
      bicarbonate: n(bicarb), bilirubin_total: n(bili), ast: n(ast), alt: n(alt),
      albumin: n(albumin), inr: n(inr), hemoglobin: n(hgb), hematocrit: n(hct),
      wbc: n(wbc), platelets: n(plt), lactate: n(lactate), glucose: n(glucose),
      hba1c: n(hba1c), troponin: n(troponin), bnp: n(bnp), ph: n(ph),
      pao2: n(pao2), paco2: n(paco2),
    }) as Labs;

    const diagnosis: Diagnosis = {
      primary_diagnosis: primaryDx, icd10_codes: [], comorbidities,
      admission_type: admissionType, is_surgical: isSurgical, is_postoperative: isPostop,
    };

    const interventions: Interventions = {
      on_vasopressors: onPressors, vasopressor_count: parseInt(pressorCount) || 0,
      vasopressor_names: [], ventilation_mode: ventMode, peep: n(peep),
      on_dialysis: onDialysis, dialysis_type: undefined, on_ecmo: onEcmo,
      recent_surgery_within_72h: isPostop, central_line: false,
      on_anticoagulation: onAnticoag, on_antibiotics: onAbx,
    };

    const request: PredictionRequest = {
      patient: {
        demographics,
        vitals: Object.keys(vitals).length > 0 ? vitals : undefined,
        labs: Object.keys(labs).length > 0 ? labs : undefined,
        diagnosis,
        interventions,
      },
      selected_outcomes: selectedOutcomes,
    };
    onSubmit(request);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Demographics */}
      <Section title="Demographics" icon={User} defaultOpen>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-[var(--mp-muted)] mb-1">Age *</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
              required min={0} max={120} className="w-full rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[var(--mp-muted)] mb-1">Sex *</label>
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")}
              className="w-full rounded-md px-3 py-2 text-sm">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <NumberInput label="BMI" value={bmi} onChange={setBmi} min={10} max={80} />
        </div>
      </Section>

      {/* Diagnosis */}
      <Section title="Diagnosis & History" icon={Stethoscope} defaultOpen>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--mp-muted)] mb-1">Primary Diagnosis / Chief Complaint *</label>
            <input type="text" value={primaryDx} onChange={(e) => setPrimaryDx(e.target.value)}
              required placeholder="e.g. Sepsis, Acute MI, Pneumonia, AKI..."
              className="w-full rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--mp-muted)] mb-1">Admission Type</label>
              <select value={admissionType} onChange={(e) => setAdmissionType(e.target.value as AdmissionType)}
                className="w-full rounded-md px-3 py-2 text-sm">
                <option value="icu">ICU</option>
                <option value="floor">Medical Floor</option>
                <option value="ed">Emergency Dept</option>
                <option value="outpatient">Outpatient</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input type="checkbox" checked={isSurgical} onChange={(e) => setIsSurgical(e.target.checked)} className="rounded" />
              Surgical
            </label>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input type="checkbox" checked={isPostop} onChange={(e) => setIsPostop(e.target.checked)} className="rounded" />
              Post-operative
            </label>
          </div>
          <div>
            <label className="block text-xs text-[var(--mp-muted)] mb-2">Comorbidities</label>
            <div className="flex flex-wrap gap-2">
              {COMORBIDITY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => toggleComorbidity(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    comorbidities.includes(opt.value)
                      ? "bg-[var(--mp-primary)]/20 border-[var(--mp-primary)] text-[var(--mp-primary)]"
                      : "bg-[var(--mp-bg)] border-[var(--mp-border)] text-[var(--mp-muted)] hover:border-zinc-500"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Vitals */}
      <Section title="Vital Signs" icon={Heart} defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumberInput label="Heart Rate" unit="bpm" value={hr} onChange={setHr} />
          <NumberInput label="Systolic BP" unit="mmHg" value={sbp} onChange={setSbp} />
          <NumberInput label="Diastolic BP" unit="mmHg" value={dbp} onChange={setDbp} />
          <NumberInput label="MAP" unit="mmHg" value={map} onChange={setMap} />
          <NumberInput label="Resp. Rate" unit="/min" value={rr} onChange={setRr} />
          <NumberInput label="Temp" unit="°C" value={temp} onChange={setTemp} step={0.1} />
          <NumberInput label="SpO2" unit="%" value={spo2} onChange={setSpo2} />
          <NumberInput label="FiO2" unit="0.21-1.0" value={fio2} onChange={setFio2} step={0.01} />
          <NumberInput label="GCS Total" unit="3-15" value={gcs} onChange={setGcs} min={3} max={15} />
          <NumberInput label="Urine Output" unit="mL/24h" value={uo} onChange={setUo} />
        </div>
      </Section>

      {/* Labs */}
      <Section title="Laboratory Values" icon={TestTube} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-xs text-[var(--mp-muted)]">Renal</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="Creatinine" unit="mg/dL" value={cr} onChange={setCr} step={0.1} />
            <NumberInput label="BUN" unit="mg/dL" value={bun} onChange={setBun} />
            <NumberInput label="Potassium" unit="mEq/L" value={k} onChange={setK} step={0.1} />
            <NumberInput label="Sodium" unit="mEq/L" value={na} onChange={setNa} />
            <NumberInput label="Bicarbonate" unit="mEq/L" value={bicarb} onChange={setBicarb} />
          </div>
          <p className="text-xs text-[var(--mp-muted)] pt-2">Hepatic</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="Bilirubin" unit="mg/dL" value={bili} onChange={setBili} step={0.1} />
            <NumberInput label="AST" unit="U/L" value={ast} onChange={setAst} />
            <NumberInput label="ALT" unit="U/L" value={alt} onChange={setAlt} />
            <NumberInput label="Albumin" unit="g/dL" value={albumin} onChange={setAlbumin} step={0.1} />
            <NumberInput label="INR" value={inr} onChange={setInr} step={0.1} />
          </div>
          <p className="text-xs text-[var(--mp-muted)] pt-2">Hematologic</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="Hemoglobin" unit="g/dL" value={hgb} onChange={setHgb} step={0.1} />
            <NumberInput label="Hematocrit" unit="%" value={hct} onChange={setHct} />
            <NumberInput label="WBC" unit="x10³/µL" value={wbc} onChange={setWbc} step={0.1} />
            <NumberInput label="Platelets" unit="x10³/µL" value={plt} onChange={setPlt} />
          </div>
          <p className="text-xs text-[var(--mp-muted)] pt-2">Metabolic / Inflammatory</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="Lactate" unit="mmol/L" value={lactate} onChange={setLactate} step={0.1} />
            <NumberInput label="Glucose" unit="mg/dL" value={glucose} onChange={setGlucose} />
            <NumberInput label="HbA1c" unit="%" value={hba1c} onChange={setHba1c} step={0.1} />
          </div>
          <p className="text-xs text-[var(--mp-muted)] pt-2">Cardiac</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="Troponin" unit="ng/mL" value={troponin} onChange={setTroponin} step={0.001} />
            <NumberInput label="BNP" unit="pg/mL" value={bnp} onChange={setBnp} />
          </div>
          <p className="text-xs text-[var(--mp-muted)] pt-2">ABG</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumberInput label="pH" value={ph} onChange={setPh} step={0.01} />
            <NumberInput label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} />
            <NumberInput label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} />
          </div>
        </div>
      </Section>

      {/* Interventions */}
      <Section title="Medications & Interventions" icon={Syringe} defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onPressors} onChange={(e) => setOnPressors(e.target.checked)} className="rounded" />
              On Vasopressors
            </label>
            {onPressors && (
              <NumberInput label="# Vasopressors" value={pressorCount} onChange={setPressorCount} min={1} max={5} />
            )}
          </div>
          <div>
            <label className="block text-xs text-[var(--mp-muted)] mb-1">Ventilation Mode</label>
            <select value={ventMode} onChange={(e) => setVentMode(e.target.value as VentMode)}
              className="w-full sm:w-1/3 rounded-md px-3 py-2 text-sm">
              <option value="none">None / Room Air</option>
              <option value="nasal_cannula">Nasal Cannula</option>
              <option value="high_flow">High-Flow Nasal Cannula</option>
              <option value="nippv">NIPPV (BiPAP/CPAP)</option>
              <option value="mechanical">Mechanical Ventilation</option>
            </select>
          </div>
          {(ventMode === "mechanical" || ventMode === "nippv") && (
            <NumberInput label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} />
          )}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onDialysis} onChange={(e) => setOnDialysis(e.target.checked)} className="rounded" />
              On Dialysis
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onEcmo} onChange={(e) => setOnEcmo(e.target.checked)} className="rounded" />
              On ECMO
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onAbx} onChange={(e) => setOnAbx(e.target.checked)} className="rounded" />
              On Antibiotics
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onAnticoag} onChange={(e) => setOnAnticoag(e.target.checked)} className="rounded" />
              On Anticoagulation
            </label>
          </div>
        </div>
      </Section>

      {/* Outcomes Selection */}
      <div className="border border-[var(--mp-border)] rounded-lg bg-[var(--mp-bg-card)] p-4">
        <h3 className="font-semibold text-sm mb-3">Select Outcomes to Predict</h3>
        <div className="flex flex-wrap gap-2">
          {allOutcomes.map((outcome) => (
            <button key={outcome} type="button" onClick={() => toggleOutcome(outcome)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                selectedOutcomes.includes(outcome)
                  ? "bg-[var(--mp-primary)]/20 border-[var(--mp-primary)] text-[var(--mp-primary)]"
                  : "bg-[var(--mp-bg)] border-[var(--mp-border)] text-[var(--mp-muted)] hover:border-zinc-500"
              }`}>
              {OUTCOME_LABELS[outcome]}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button type="submit"
        disabled={loading || !age || !primaryDx || selectedOutcomes.length === 0}
        className="w-full py-3 bg-[var(--mp-primary)] text-white rounded-lg font-semibold
                   hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 transition-colors">
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Running Prediction...</>
        ) : (
          "Run Mortality & Outcome Prediction"
        )}
      </button>
    </form>
  );
}
