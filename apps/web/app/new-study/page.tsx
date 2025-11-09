"use client";

import { useMemo, useState } from "react";

import {
  BaselineBuildResult,
  buildBaselineSpec,
  buildBaselinePackageFromIdea,
  canLockAndLaunch,
  chooseDesign,
  parseIdeaToPreSpec,
} from "@aurora/core";
import type {
  CRFForm,
  LiteraturePlan,
  PISICFDraft,
  ProtocolDraft,
  RegistryMappingSheet,
  SAPPlan,
  SampleSizeAssumptionsBase,
  SampleSizeResult,
  StudySpec,
} from "@aurora/core";

const STEPS = ["Idea", "Design", "Sample Size", "Documents", "Review & Compliance", "Launch Workspace"];

const INITIAL_ASSUMPTIONS = {
  alpha: "0.05",
  power: "0.8",
  twoSided: "two-sided" as "two-sided" | "one-sided",
  expectedControlEventRate: "",
  expectedTreatmentEventRate: "",
  expectedMeanControl: "",
  expectedMeanTreatment: "",
  assumedSD: "",
  hazardRatio: "",
  eventProportionDuringFollowUp: "",
  expectedProportion: "",
  precision: "",
  dropoutRate: "",
  clusterDesignEffect: "",
  expectedSensitivity: "",
  expectedSpecificity: "",
  targetMetric: "both" as "sensitivity" | "specificity" | "both",
};

type FormInputs = typeof INITIAL_ASSUMPTIONS;

type FieldConfig = {
  key: keyof FormInputs;
  label: string;
  helper?: string;
  type?: "number" | "select";
  step?: string;
  min?: string;
  max?: string;
  options?: { value: string; label: string }[];
};

const COMMON_FIELDS: FieldConfig[] = [
  {
    key: "alpha",
    label: "Alpha (Type I error)",
    type: "number",
    step: "0.01",
    min: "0.0001",
    max: "0.2",
    helper: "Default 0.05 unless protocol specifies otherwise.",
  },
  {
    key: "power",
    label: "Power",
    type: "number",
    step: "0.01",
    min: "0.5",
    max: "0.99",
    helper: "80% power is typical for initial drafts.",
  },
  {
    key: "twoSided",
    label: "Tail",
    type: "select",
    options: [
      { value: "two-sided", label: "Two-sided" },
      { value: "one-sided", label: "One-sided" },
    ],
    helper: "Two-sided testing is expected for confirmatory analyses.",
  },
];

function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getAssumptionFields(studySpec: StudySpec | null): FieldConfig[] {
  if (!studySpec?.designId || !studySpec.primaryEndpoint) {
    return [];
  }

  const endpointType = studySpec.primaryEndpoint.type;
  const designId = studySpec.designId;

  const fields: FieldConfig[] = [...COMMON_FIELDS];

  if (designId === "single-arm" || designId === "registry") {
    fields.push(
      {
        key: "expectedProportion",
        label: "Expected proportion",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
        helper: "Estimated response or prevalence proportion.",
      },
      {
        key: "precision",
        label: "Desired precision (half-width)",
        type: "number",
        step: "0.01",
        min: "0",
        helper: "Width of confidence interval e.g. 0.05 for ±5%.",
      }
    );
    return fields;
  }

  if (designId === "diagnostic-accuracy") {
    fields.push(
      {
        key: "expectedSensitivity",
        label: "Expected sensitivity",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
      {
        key: "expectedSpecificity",
        label: "Expected specificity",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
      {
        key: "targetMetric",
        label: "Metric focus",
        type: "select",
        options: [
          { value: "sensitivity", label: "Sensitivity" },
          { value: "specificity", label: "Specificity" },
          { value: "both", label: "Both" },
        ],
      },
      {
        key: "precision",
        label: "Desired precision (half-width)",
        type: "number",
        step: "0.01",
        min: "0",
        helper: "Half-width for confidence interval (e.g. 0.05).",
      }
    );
    return fields;
  }

  if (endpointType === "binary") {
    fields.push(
      {
        key: "expectedControlEventRate",
        label: "Expected control event rate",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
      {
        key: "expectedTreatmentEventRate",
        label: "Expected treatment/exposure event rate",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
      {
        key: "dropoutRate",
        label: "Anticipated dropout proportion",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
    );
    return fields;
  }

  if (endpointType === "continuous") {
    fields.push(
      { key: "expectedMeanControl", label: "Control mean", type: "number", step: "0.1" },
      { key: "expectedMeanTreatment", label: "Treatment mean", type: "number", step: "0.1" },
      { key: "assumedSD", label: "Assumed SD", type: "number", step: "0.1", min: "0" },
      {
        key: "dropoutRate",
        label: "Anticipated dropout proportion",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      }
    );
    return fields;
  }

  if (endpointType === "time-to-event") {
    fields.push(
      { key: "hazardRatio", label: "Target hazard ratio", type: "number", step: "0.01", min: "0" },
      {
        key: "eventProportionDuringFollowUp",
        label: "Event proportion during follow-up",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      },
      {
        key: "dropoutRate",
        label: "Loss to follow-up proportion",
        type: "number",
        step: "0.01",
        min: "0",
        max: "1",
      }
    );
    return fields;
  }

  return fields;
}

function buildAssumptionsPayload(storySpec: StudySpec | null, inputs: FormInputs): Partial<SampleSizeAssumptionsBase> {
  if (!storySpec) return {};

  return {
    alpha: toNumber(inputs.alpha),
    power: toNumber(inputs.power),
    twoSided: inputs.twoSided === "two-sided",
    expectedControlEventRate: toNumber(inputs.expectedControlEventRate),
    expectedTreatmentEventRate: toNumber(inputs.expectedTreatmentEventRate),
    expectedMeanControl: toNumber(inputs.expectedMeanControl),
    expectedMeanTreatment: toNumber(inputs.expectedMeanTreatment),
    assumedSD: toNumber(inputs.assumedSD),
    hazardRatio: toNumber(inputs.hazardRatio),
    eventProportionDuringFollowUp: toNumber(inputs.eventProportionDuringFollowUp),
    expectedProportion: toNumber(inputs.expectedProportion),
    precision: toNumber(inputs.precision),
    dropoutRate: toNumber(inputs.dropoutRate),
    clusterDesignEffect: toNumber(inputs.clusterDesignEffect),
    targetMetric: inputs.targetMetric,
    notes: [],
    expectedSensitivity: toNumber(inputs.expectedSensitivity),
    expectedSpecificity: toNumber(inputs.expectedSpecificity),
  } as Partial<SampleSizeAssumptionsBase>;
}

function renderList(items: string[] | undefined) {
  if (!items || items.length === 0) return <p className="text-sm text-neutral-600">None recorded.</p>;
  return (
    <ul className="list-disc space-y-1 pl-6 text-sm text-neutral-800">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function StudyStoryPanel({ studySpec }: { studySpec: StudySpec }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Study Story (Draft)</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Draft interpretation generated from your idea using Aurora's rulebook. Requires PI and IEC review before use.
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div><span className="font-medium">Title:</span> {studySpec.title}</div>
        <div>
          <span className="font-medium">Design:</span> {studySpec.designLabel ?? "Needs classification"}
        </div>
        <div><span className="font-medium">Condition:</span> {studySpec.condition ?? "Not parsed"}</div>
        <div>
          <span className="font-medium">Population:</span> {studySpec.populationDescription ?? "Not parsed"}
        </div>
        <div><span className="font-medium">Setting:</span> {studySpec.setting ?? "Not parsed"}</div>
        <div>
          <span className="font-medium">Primary endpoint:</span> {studySpec.primaryEndpoint?.name ?? "Needs definition"}
        </div>
        {studySpec.notes.length > 0 && (
          <div>
            <span className="font-medium">Notes:</span>
            {renderList(studySpec.notes)}
          </div>
        )}
      </div>
    </section>
  );
}

function SampleSizePanel({ sampleSize }: { sampleSize: SampleSizeResult }) {
  const statusColor = sampleSize.status === "ok" ? "text-emerald-700" : "text-amber-700";
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Sample Size Result</h2>
      <p className={`mt-2 text-sm font-medium ${statusColor}`}>Status: {sampleSize.status}</p>
      <div className="mt-2 space-y-1 text-sm">
        {sampleSize.totalSampleSize && <div>Total sample size: {sampleSize.totalSampleSize}</div>}
        {sampleSize.perGroupSampleSize && <div>Per group: {sampleSize.perGroupSampleSize}</div>}
        {sampleSize.eventsRequired && <div>Events required: {sampleSize.eventsRequired}</div>}
      </div>
      {sampleSize.warnings.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
          {renderList(sampleSize.warnings)}
        </div>
      )}
      {sampleSize.notes.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-medium">Notes</h3>
          {renderList(sampleSize.notes)}
        </div>
      )}
    </section>
  );
}

function ProtocolPanel({ protocol }: { protocol: ProtocolDraft }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Protocol Draft Sections</h2>
      <ul className="mt-3 space-y-2">
        {protocol.sections.map((section) => (
          <li key={section.id} className="rounded border border-neutral-200 p-3">
            <h3 className="font-medium">{section.title}</h3>
            <p className="mt-1 text-sm text-neutral-700">{section.content}</p>
          </li>
        ))}
      </ul>
      {protocol.warnings.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
          {renderList(protocol.warnings)}
        </div>
      )}
    </section>
  );
}

function SAPPanel({ sap }: { sap: SAPPlan }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Statistical Analysis Plan (Draft)</h2>
      <div className="mt-2 text-sm text-neutral-700">
        <p><strong>Full analysis set:</strong> {sap.analysisSets.fullAnalysisSet}</p>
        {sap.analysisSets.perProtocolSet && (
          <p><strong>Per-protocol set:</strong> {sap.analysisSets.perProtocolSet}</p>
        )}
        {sap.analysisSets.safetySet && (
          <p><strong>Safety set:</strong> {sap.analysisSets.safetySet}</p>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {sap.endpoints.map((endpoint) => (
          <div key={endpoint.endpointName} className="rounded border border-neutral-200 p-3">
            <h3 className="font-medium">{endpoint.endpointName} ({endpoint.role})</h3>
            <p className="mt-1 text-sm text-neutral-700">{endpoint.testOrModel}</p>
            {endpoint.effectMeasure && (
              <p className="text-sm text-neutral-700">Effect measure: {endpoint.effectMeasure}</p>
            )}
            {endpoint.covariates && endpoint.covariates.length > 0 && (
              <p className="text-sm text-neutral-700">Covariates: {endpoint.covariates.join(", ")}</p>
            )}
            {endpoint.missingDataApproach && (
              <p className="text-sm text-neutral-700">Missing data: {endpoint.missingDataApproach}</p>
            )}
          </div>
        ))}
      </div>
      {sap.warnings.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
          {renderList(sap.warnings)}
        </div>
      )}
      <div className="mt-4 text-sm text-neutral-700">
        <p><strong>Multiplicity:</strong> {sap.multiplicity}</p>
        <p><strong>Interim analysis:</strong> {sap.interimAnalysis}</p>
        <p><strong>Subgroup analyses:</strong> {sap.subgroupAnalyses}</p>
        <p><strong>Sensitivity analyses:</strong> {sap.sensitivityAnalyses}</p>
        <p><strong>Missing data (general):</strong> {sap.missingDataGeneral}</p>
        <p><strong>Software:</strong> {sap.software}</p>
      </div>
    </section>
  );
}

function CRFPanel({ forms }: { forms: CRFForm[] }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">CRF / eCRF Schema</h2>
      <div className="mt-3 space-y-3">
        {forms.map((form) => (
          <div key={form.id} className="rounded border border-neutral-200 p-3">
            <h3 className="font-medium">{form.name}</h3>
            {form.visitLabel && <p className="text-sm text-neutral-700">Visit: {form.visitLabel}</p>}
            <p className="text-xs text-neutral-500">Purpose: {form.purpose}</p>
            <table className="mt-2 w-full table-auto text-left text-sm">
              <thead>
                <tr className="text-neutral-500">
                  <th className="py-1 pr-2">Field</th>
                  <th className="py-1 pr-2">Type</th>
                  <th className="py-1 pr-2">Required</th>
                  <th className="py-1 pr-2">Maps to endpoint</th>
                </tr>
              </thead>
              <tbody>
                {form.fields.map((field) => (
                  <tr key={field.id} className="border-t border-neutral-200">
                    <td className="py-1 pr-2">{field.label}</td>
                    <td className="py-1 pr-2">{field.type}</td>
                    <td className="py-1 pr-2">{field.required ? "Yes" : "No"}</td>
                    <td className="py-1 pr-2">{field.mapsToEndpointName ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

function PISICFPanel({ draft }: { draft: PISICFDraft }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">PIS / ICF Clauses</h2>
      <p className="text-sm text-neutral-700">
        Deterministic outline referencing ICMR and ICH-GCP consent expectations. Requires localisation and IEC approval.
      </p>
      <ul className="mt-3 space-y-2">
        {draft.sections.map((section) => (
          <li key={section.id} className="rounded border border-neutral-200 p-3">
            <h3 className="font-medium">{section.title}</h3>
            <p className="mt-1 text-sm text-neutral-700 whitespace-pre-line">{section.content}</p>
          </li>
        ))}
      </ul>
      {draft.warnings.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
          {renderList(draft.warnings)}
        </div>
      )}
    </section>
  );
}

function RegistryPanel({ sheet }: { sheet: RegistryMappingSheet }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Registry Mapping (CTRI-style)</h2>
      <table className="mt-2 w-full table-auto text-left text-sm">
        <thead>
          <tr className="text-neutral-500">
            <th className="py-1 pr-2">Field</th>
            <th className="py-1 pr-2">Value</th>
            <th className="py-1 pr-2">Source</th>
            <th className="py-1 pr-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sheet.fields.map((field) => (
            <tr key={field.fieldId} className="border-t border-neutral-200">
              <td className="py-1 pr-2">{field.label}</td>
              <td className="py-1 pr-2">{field.value ?? "To be provided"}</td>
              <td className="py-1 pr-2">{field.source === "auto" ? "Auto" : "PI required"}</td>
              <td className="py-1 pr-2">{field.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CompliancePanel({ result }: { result: BaselineBuildResult }) {
  const gate = canLockAndLaunch(result);
  const hasBlocking = gate.blockingIssues.length > 0;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-amber-900">Compliance & Validation Issues</h2>
      <p className="mt-2 text-sm text-amber-800">
        These deterministic checks highlight gaps that block launch until resolved. Aurora does not grant regulatory approval.
      </p>
      <div className="mt-3 text-sm">
        <p className={hasBlocking ? "text-red-700" : "text-emerald-700"}>
          {hasBlocking
            ? "Critical issues detected. Resolve or acknowledge before export or launch."
            : "No blocking issues detected, but PI/IEC review remains mandatory."}
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {result.issues.length === 0 ? (
          <li className="text-sm text-neutral-700">Deterministic validation checks recorded no warnings.</li>
        ) : (
          result.issues.map((issue) => (
            <li key={issue.code} className="rounded border border-amber-300 bg-white p-3 text-sm text-amber-800">
              <span className="font-medium">[{issue.severity.toUpperCase()} / {issue.scope}]</span> {issue.message}
            </li>
          ))
        )}
      </ul>
      <div className="mt-4 text-sm text-amber-800">
        <p>Checklist summary:</p>
        <ul className="mt-2 space-y-1">
          {result.regulatoryChecklist.items.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{item.label}:</span> {item.status} ({item.severity}){item.notes ? ` – ${item.notes}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LiteraturePanel({ plan }: { plan: LiteraturePlan }) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Literature Planning Scaffold</h2>
      <p className="text-sm text-neutral-700">{plan.picoSummary}</p>
      <div className="mt-3">
        <h3 className="text-sm font-medium">Suggested search keywords</h3>
        {renderList(plan.suggestedKeywords)}
      </div>
      <div className="mt-3 text-sm text-neutral-700">
        <h3 className="text-sm font-medium">Execution notes</h3>
        {renderList(plan.notes)}
      </div>
    </section>
  );
}

export default function NewStudyPage() {
  const [idea, setIdea] = useState("");
  const [storyRequested, setStoryRequested] = useState(false);
  const [assumptions, setAssumptions] = useState<FormInputs>(INITIAL_ASSUMPTIONS);
  const [baselineResult, setBaselineResult] = useState<BaselineBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const storySpec = useMemo(() => {
    if (!storyRequested || !idea.trim()) return null;
    const preSpec = parseIdeaToPreSpec(idea);
    const designId = chooseDesign(preSpec);
    return buildBaselineSpec(preSpec, designId);
  }, [idea, storyRequested]);

  const assumptionFields = useMemo(() => getAssumptionFields(storySpec), [storySpec]);

  const gate = useMemo(() => (baselineResult ? canLockAndLaunch(baselineResult) : null), [baselineResult]);

  const handleGenerateStory = () => {
    if (!idea.trim()) {
      setError("Please describe your study idea first.");
      return;
    }
    setError(null);
    setStoryRequested(true);
    setBaselineResult(null);
    setDownloadError(null);
  };

  const handleAssumptionChange = (key: keyof FormInputs, value: string) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompute = () => {
    if (!storySpec) {
      setError("Generate the study story before computing.");
      return;
    }
    const payload = buildAssumptionsPayload(storySpec, assumptions);
    const result = buildBaselinePackageFromIdea(idea, payload);
    setBaselineResult(result);
    setError(null);
    setDownloadError(null);
  };

  const handleDownload = async () => {
    if (!baselineResult || !storySpec) return;
    try {
      setDownloading(true);
      setDownloadError(null);
      const payload = buildAssumptionsPayload(storySpec, assumptions);
      const response = await fetch("/api/baseline-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, assumptions: payload }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 422 && data?.issues) {
          setDownloadError("Resolve critical compliance issues before downloading the baseline pack.");
        } else {
          setDownloadError(data?.error ?? "Failed to download baseline pack.");
        }
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "aurora-baseline-pack.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError("Unexpected error while preparing the baseline pack. Please try again after resolving issues.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-neutral-900">Aurora Research OS — New Study</h1>
        <p className="text-neutral-700">
          Aurora converts clinician ideas into deterministic drafts aligned with the India v1 rulebook. All outputs are drafts requiring Principal Investigator and IEC review.
        </p>
        <nav className="flex gap-2 text-xs uppercase tracking-widest text-neutral-500">
          {STEPS.map((step, index) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-neutral-400 px-2 py-1">{index + 1}</span>
              {step}
            </span>
          ))}
        </nav>
      </header>

      <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">1. Describe your study idea</h2>
        <textarea
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          rows={6}
          className="mt-3 w-full rounded border border-neutral-300 p-3 text-sm shadow-inner focus:border-indigo-500 focus:outline-none"
          placeholder="Example: We want to study 30-day mortality after emergency laparotomy in adults admitted to our tertiary care hospital..."
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleGenerateStory}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
          >
            Generate Study Story
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
      </section>

      {storySpec && <StudyStoryPanel studySpec={storySpec} />}

      {storySpec && (
        <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">2. Provide sample size assumptions</h2>
          <p className="text-sm text-neutral-700">
            Aurora applies deterministic formulas only when inputs are explicit. Leave fields blank if unknown—the system will flag incomplete assumptions instead of guessing.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {assumptionFields.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Add a clear primary endpoint or confirm design to unlock the assumption form.
              </p>
            ) : (
              assumptionFields.map((field) => (
                <div key={field.key} className="flex flex-col">
                  <label className="text-sm font-medium text-neutral-800">{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      value={assumptions[field.key]}
                      onChange={(event) => handleAssumptionChange(field.key, event.target.value)}
                      className="mt-1 rounded border border-neutral-300 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={assumptions[field.key]}
                      onChange={(event) => handleAssumptionChange(field.key, event.target.value)}
                      className="mt-1 rounded border border-neutral-300 p-2 text-sm focus:border-indigo-500 focus:outline-none"
                      step={field.step}
                      min={field.min}
                      max={field.max}
                    />
                  )}
                  {field.helper && <span className="mt-1 text-xs text-neutral-500">{field.helper}</span>}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={handleCompute}
            className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500"
          >
            Compute Sample Size & Drafts
          </button>
        </section>
      )}

      {baselineResult && (
        <>
          <SampleSizePanel sampleSize={baselineResult.sampleSize} />

          <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">3. Statistician-facing explanation</h2>
            <p className="text-sm text-neutral-700">{baselineResult.sapExplanation.sampleSizeSummary}</p>
            <p className="mt-2 text-sm text-neutral-700">{baselineResult.sapExplanation.analysisSummary}</p>
            <p className="mt-2 text-sm text-neutral-700">{baselineResult.sapExplanation.assumptionSummary}</p>
            {renderList(baselineResult.sapExplanation.caveats)}
          </section>

          <ProtocolPanel protocol={baselineResult.protocol} />
          <SAPPanel sap={baselineResult.sap} />
          <CRFPanel forms={baselineResult.crf.forms} />
          <PISICFPanel draft={baselineResult.pisIcf} />

          <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">IEC Cover Note Snapshot</h2>
            <p className="text-sm text-neutral-700">{baselineResult.iecCoverNote.summary}</p>
            <p className="mt-2 text-sm text-neutral-700">{baselineResult.iecCoverNote.designAndMethods}</p>
            <p className="mt-2 text-sm text-neutral-700">{baselineResult.iecCoverNote.riskBenefit}</p>
            <p className="mt-2 text-sm text-neutral-700">{baselineResult.iecCoverNote.keyEthicsHighlights}</p>
            <div className="mt-3 text-sm text-neutral-700">
              <strong>Attachments:</strong> {baselineResult.iecCoverNote.attachmentsList.join(", ")}
            </div>
            {baselineResult.iecCoverNote.warnings.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-medium text-amber-700">Warnings</h3>
                {renderList(baselineResult.iecCoverNote.warnings)}
              </div>
            )}
          </section>

          <RegistryPanel sheet={baselineResult.registryMapping} />
          <LiteraturePanel plan={baselineResult.literaturePlan} />
          <CompliancePanel result={baselineResult} />

          <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Deterministic Baseline Pack</h2>
            <p className="text-sm text-neutral-700">
              Download a zip containing protocol, SAP, consent draft, CRF schema, regulatory checklist, and registry mapping. All
              files include explicit draft disclaimers and must be reviewed by the PI and IEC.
            </p>
            <div className="mt-3 text-sm text-neutral-700">
              <p>
                Rulebook profile: <span className="font-medium">{baselineResult.versionInfo.rulebookProfile}</span> (version
                {baselineResult.versionInfo.rulebookVersion}). Generated at {new Date(baselineResult.versionInfo.generatedAt).toLocaleString()}.
              </p>
              <p className="mt-1">{baselineResult.disclaimer}</p>
            </div>
            {gate && gate.blockingIssues.length > 0 && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-100 p-3 text-sm text-amber-800">
                <p className="font-medium">Resolve these blocking issues before export:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {gate.blockingIssues.map((issue) => (
                    <li key={`blocking-${issue.code}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {downloadError && <p className="mt-3 text-sm text-red-700">{downloadError}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!gate || !gate.allowed || downloading}
                className={`rounded px-4 py-2 text-sm font-semibold text-white shadow ${
                  !gate || !gate.allowed || downloading
                    ? "cursor-not-allowed bg-neutral-400"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {downloading ? "Preparing zip..." : "Download Baseline Pack"}
              </button>
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                Launch workspace (coming soon; unlocks after critical issues resolved)
              </span>
            </div>
          </section>

          <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-red-800">Regulatory Disclaimer</h2>
            <p className="text-sm text-red-800">
              Aurora Research OS produces deterministic drafts only. Nothing here constitutes CTRI submission, IEC approval, DCGI clearance, or legal advice. Always submit through institutional channels.
            </p>
          </section>
        </>
      )}
    </main>
  );
}