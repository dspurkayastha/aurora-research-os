"use client";

import { useEffect, useMemo, useState, useRef } from "react";

import {
  BaselineBuildResult,
  buildBaselinePackageFromIdea,
  canLockAndLaunch,
  getResearchBackedDefaults,
  getResearchSourcesForAssumptions,
  formatResearchCitation,
  buildBaselineSpec,
  type ResearchSource,
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
import { checkAIAvailability, parseIdeaWithAI, selectDesignWithAI } from "../../lib/ai-service";

const STEPS = ["Idea", "Design", "Sample Size", "Documents", "Review & Compliance", "Launch Workspace"];

type StepStatus = "pending" | "in-progress" | "completed" | "error";

interface WorkflowStep {
  id: string;
  label: string;
  status: StepStatus;
  ref?: React.RefObject<HTMLDivElement>;
}

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

function StudyStoryPanel({ 
  studySpec, 
  designConfidence, 
  designReasoning 
}: { 
  studySpec: StudySpec;
  designConfidence?: number | null;
  designReasoning?: string | null;
}) {
  return (
    <section className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Study Story (Draft)</h2>
      <p className="mt-2 text-sm text-neutral-700">
        Draft interpretation generated from your idea using AI and Aurora's rulebook. Requires PI and IEC review before use.
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div><span className="font-medium">Title:</span> {studySpec.title}</div>
        <div>
          <span className="font-medium">Design:</span> {studySpec.designLabel ?? "Needs classification"}
          {designConfidence !== null && designConfidence !== undefined && (
            <span className="ml-2 text-xs text-neutral-600">
              (AI confidence: {designConfidence}%)
            </span>
          )}
        </div>
        {designReasoning && (
          <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-800">
            <span className="font-medium">AI Reasoning:</span> {designReasoning}
          </div>
        )}
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
  const [parsing, setParsing] = useState(false);
  const [assumptions, setAssumptions] = useState<FormInputs>(INITIAL_ASSUMPTIONS);
  const [baselineResult, setBaselineResult] = useState<BaselineBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [acknowledgeCritical, setAcknowledgeCritical] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [storySpec, setStorySpec] = useState<StudySpec | null>(null);
  const [designConfidence, setDesignConfidence] = useState<number | null>(null);
  const [designReasoning, setDesignReasoning] = useState<string | null>(null);
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [useAIEnhancement, setUseAIEnhancement] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<{
    active: boolean;
    progress: number;
    currentFile?: string;
  }>({ active: false, progress: 0 });
  
  // Refs for auto-scrolling to steps
  const ideaStepRef = useRef<HTMLDivElement>(null);
  const designStepRef = useRef<HTMLDivElement>(null);
  const sampleSizeStepRef = useRef<HTMLDivElement>(null);
  const documentsStepRef = useRef<HTMLDivElement>(null);
  const reviewStepRef = useRef<HTMLDivElement>(null);
  const downloadStepRef = useRef<HTMLDivElement>(null);
  
  // Determine current step status
  const getCurrentStep = (): number => {
    if (downloading) return 5; // Download
    if (baselineResult) return 4; // Review
    if (storySpec && baselineResult) return 3; // Documents
    if (storySpec) return 2; // Sample Size
    if (storySpec || parsing) return 1; // Design
    return 0; // Idea
  };
  
  const getStepStatus = (stepIndex: number): StepStatus => {
    const current = getCurrentStep();
    if (stepIndex < current) return "completed";
    if (stepIndex === current) {
      if (parsing || downloading) return "in-progress";
      return "completed";
    }
    return "pending";
  };
  
  // Auto-scroll to current step
  useEffect(() => {
    const currentStep = getCurrentStep();
    const refs = [ideaStepRef, designStepRef, sampleSizeStepRef, documentsStepRef, reviewStepRef, downloadStepRef];
    const ref = refs[currentStep];
    if (ref?.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [storySpec, baselineResult, downloading, parsing]);

  // Check AI availability on mount (MANDATORY)
  useEffect(() => {
    async function checkAI() {
      const status = await checkAIAvailability();
      setAiAvailable(status.available);
      if (!status.available) {
        setAiError(status.reason || "AI service unavailable");
      }
    }
    checkAI();
  }, []);

  // Get research sources when story spec changes
  useEffect(() => {
    if (storySpec) {
      const sources = getResearchSourcesForAssumptions(storySpec);
      setResearchSources(sources);
      
      // Populate assumptions with research-backed defaults
      const defaults = getResearchBackedDefaults(
        storySpec.condition,
        storySpec.designId,
        storySpec.primaryEndpoint?.type
      );
      
      if (defaults.assumptions.expectedControlEventRate !== undefined) {
        setAssumptions(prev => ({
          ...prev,
          expectedControlEventRate: defaults.assumptions.expectedControlEventRate?.toString() || "",
        }));
      }
      if (defaults.assumptions.expectedTreatmentEventRate !== undefined) {
        setAssumptions(prev => ({
          ...prev,
          expectedTreatmentEventRate: defaults.assumptions.expectedTreatmentEventRate?.toString() || "",
        }));
      }
      if (defaults.assumptions.assumedSD !== undefined) {
        setAssumptions(prev => ({
          ...prev,
          assumedSD: defaults.assumptions.assumedSD?.toString() || "",
        }));
      }
      if (defaults.assumptions.expectedMeanControl !== undefined) {
        setAssumptions(prev => ({
          ...prev,
          expectedMeanControl: defaults.assumptions.expectedMeanControl?.toString() || "",
        }));
      }
      if (defaults.assumptions.expectedMeanTreatment !== undefined) {
        setAssumptions(prev => ({
          ...prev,
          expectedMeanTreatment: defaults.assumptions.expectedMeanTreatment?.toString() || "",
        }));
      }
    }
  }, [storySpec]);

  const assumptionFields = useMemo(() => getAssumptionFields(storySpec), [storySpec]);

  const gate = useMemo(() => (baselineResult ? canLockAndLaunch(baselineResult) : null), [baselineResult]);
  const criticalIssues = useMemo(
    () => baselineResult?.issues.filter((issue) => issue.severity === "critical") ?? [],
    [baselineResult]
  );
  const hasCriticalIssues = criticalIssues.length > 0;

  const handleGenerateStory = async () => {
    if (!idea.trim()) {
      setError("Please describe your study idea first.");
      return;
    }
    
    if (aiAvailable === false) {
      setError("AI service is required but unavailable. Please check your API configuration.");
      return;
    }
    
    setError(null);
    setParsing(true);
    setStoryRequested(true);
    setBaselineResult(null);
    setDownloadError(null);
    setAcknowledgeCritical(false);
    
    try {
      // Step 1: Parse idea with AI (MANDATORY)
      const preSpec = await parseIdeaWithAI(idea);
      
      // Step 2: Select design with AI (MANDATORY)
      const designResult = await selectDesignWithAI(preSpec, idea);
      setDesignConfidence(designResult.confidence);
      setDesignReasoning(designResult.reasoning);
      
      // Step 3: Build spec with AI-selected design
      const spec = buildBaselineSpec(preSpec, designResult.designId as any);
      setStorySpec(spec);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse study idea with AI");
      setStoryRequested(false);
      setStorySpec(null);
    } finally {
      setParsing(false);
    }
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
    setAcknowledgeCritical(false);
  };

  const handleDownload = async () => {
    if (!baselineResult || !storySpec) return;
    if (hasCriticalIssues && !acknowledgeCritical) {
      setDownloadError(
        "Acknowledge the critical compliance issues before downloading the baseline pack."
      );
      return;
    }
    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadProgress({ active: true, progress: 0, currentFile: "Preparing files..." });
      
      const payload = buildAssumptionsPayload(storySpec, assumptions);
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 200);
      
      const response = await fetch("/api/baseline-pack/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          assumptions: payload,
          acknowledgeCritical: hasCriticalIssues ? acknowledgeCritical : undefined,
          useAIEnhancement: useAIEnhancement && aiAvailable === true,
        }),
      });

      clearInterval(progressInterval);
      setDownloadProgress({ active: true, progress: 95, currentFile: "Generating zip file..." });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setDownloadProgress({ active: false, progress: 0 });
        if (response.status === 422 && data?.issues) {
          setDownloadError(
            "Baseline pack export blocked until critical issues are acknowledged or resolved."
          );
        } else {
          setDownloadError(data?.error ?? "Failed to download baseline pack.");
        }
        return;
      }

      setDownloadProgress({ active: true, progress: 100, currentFile: "Download complete!" });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "aurora-baseline-pack.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setTimeout(() => {
        setDownloadProgress({ active: false, progress: 0 });
      }, 1000);
    } catch (err) {
      setDownloadProgress({ active: false, progress: 0 });
      setDownloadError("Unexpected error while preparing the baseline pack. Please try again after resolving issues.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Aurora Research OS — New Study</h1>
          <p className="mt-2 text-neutral-700">
            Aurora converts clinician ideas into deterministic drafts aligned with the India v1 rulebook. All outputs are drafts requiring Principal Investigator and IEC review.
          </p>
        </div>
        
        {/* Enhanced Workflow Progress Indicator */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              const isCurrent = index === getCurrentStep();
              const isCompleted = status === "completed";
              const isInProgress = status === "in-progress";
              
              return (
                <div key={step} className="flex flex-col items-center flex-1 relative">
                  {/* Connection line */}
                  {index < STEPS.length - 1 && (
                    <div className="absolute top-5 left-[60%] right-[-40%] h-0.5 z-0">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isCompleted ? "bg-indigo-600" : "bg-neutral-300"
                        }`}
                        style={{ width: isCompleted ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                  
                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      isCurrent && isInProgress
                        ? "border-indigo-600 bg-indigo-100 animate-pulse"
                        : isCompleted
                        ? "border-emerald-600 bg-emerald-50"
                        : isCurrent
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isInProgress ? (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={`text-sm font-semibold ${
                        isCurrent ? "text-indigo-600" : "text-neutral-500"
                      }`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  
                  {/* Step label */}
                  <span className={`mt-2 text-xs font-medium text-center max-w-[100px] ${
                    isCurrent ? "text-indigo-600" : isCompleted ? "text-emerald-600" : "text-neutral-500"
                  }`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* AI Availability Banner */}
      {aiAvailable === false && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-red-900">AI Service Unavailable (Required)</h2>
          <p className="mt-2 text-sm text-red-800">
            Aurora Research OS requires AI to function. Please configure your GEMINI_API_KEY.
          </p>
          {aiError && (
            <p className="mt-1 text-xs text-red-700">Error: {aiError}</p>
          )}
          <div className="mt-3 text-sm text-red-800">
            <p className="font-medium">Troubleshooting steps:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-6">
              <li>Check that GEMINI_API_KEY is set in services/api/.env</li>
              <li>Get your API key from: https://makersuite.google.com/app/apikey</li>
              <li>Restart the API service after setting the key</li>
              <li>Check your internet connection</li>
            </ol>
          </div>
        </section>
      )}
      
      {aiAvailable === true && (
        <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 shadow-sm">
          <p className="text-sm text-emerald-800">✓ AI service available and ready</p>
        </section>
      )}

      <section 
        ref={ideaStepRef}
        id="step-idea"
        className={`rounded-lg border-2 transition-all duration-300 ${
          getCurrentStep() === 0 
            ? "border-indigo-500 bg-indigo-50 shadow-lg" 
            : "border-neutral-300 bg-white shadow-sm"
        } p-4`}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            getStepStatus(0) === "completed" 
              ? "bg-emerald-600 text-white" 
              : getStepStatus(0) === "in-progress"
              ? "bg-indigo-600 text-white animate-pulse"
              : "bg-neutral-300 text-neutral-600"
          }`}>
            {getStepStatus(0) === "completed" ? "✓" : "1"}
          </span>
          Describe your study idea
        </h2>
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
            disabled={parsing || aiAvailable === false}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:bg-neutral-400 disabled:cursor-not-allowed"
          >
            {parsing ? "Parsing with AI..." : "Parse with AI"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
        {parsing && <p className="mt-2 text-sm text-neutral-600">Using AI to parse your study idea...</p>}
      </section>

      {storySpec && (
        <div ref={designStepRef} id="step-design">
          <StudyStoryPanel 
            studySpec={storySpec} 
            designConfidence={designConfidence}
            designReasoning={designReasoning}
          />
        </div>
      )}

      {storySpec && (
        <section 
          ref={sampleSizeStepRef}
          id="step-sample-size"
          className={`rounded-lg border-2 transition-all duration-300 ${
            getCurrentStep() === 2 
              ? "border-indigo-500 bg-indigo-50 shadow-lg" 
              : "border-neutral-300 bg-white shadow-sm"
          } p-4`}
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              getStepStatus(2) === "completed" 
                ? "bg-emerald-600 text-white" 
                : getStepStatus(2) === "in-progress"
                ? "bg-indigo-600 text-white animate-pulse"
                : "bg-neutral-300 text-neutral-600"
            }`}>
              {getStepStatus(2) === "completed" ? "✓" : "2"}
            </span>
            Provide sample size assumptions
          </h2>
          <p className="text-sm text-neutral-700">
            Aurora applies deterministic formulas only when inputs are explicit. Research-backed defaults are provided where available. All fields are fully editable.
          </p>
          {researchSources.length > 0 && (
            <div className="mt-3 rounded bg-blue-50 border border-blue-200 p-3">
              <h3 className="text-sm font-medium text-blue-900">Research Sources</h3>
              <ul className="mt-2 space-y-1 text-xs text-blue-800">
                {researchSources.map((source, idx) => (
                  <li key={idx}>
                    {formatResearchCitation(source)}
                    {source.pubmedId && (
                      <a 
                        href={`https://pubmed.ncbi.nlm.nih.gov/${source.pubmedId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 underline"
                      >
                        View on PubMed
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {assumptionFields.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Add a clear primary endpoint or confirm design to unlock the assumption form.
              </p>
            ) : (
              assumptionFields.map((field) => {
                // Find research source for this field
                const fieldSource = researchSources.find((source) => {
                  const fieldKey = field.key;
                  if (fieldKey === "expectedControlEventRate" || fieldKey === "expectedTreatmentEventRate") {
                    return typeof source.value === "number";
                  }
                  if (fieldKey === "assumedSD") {
                    return typeof source.value === "object" && "mean" in source.value;
                  }
                  return false;
                });
                
                return (
                  <div key={field.key} className="flex flex-col">
                    <label className="text-sm font-medium text-neutral-800">
                      {field.label}
                      {fieldSource && (
                        <span 
                          className="ml-1 text-xs text-blue-600 cursor-help"
                          title={formatResearchCitation(fieldSource)}
                        >
                          ℹ️
                        </span>
                      )}
                    </label>
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
                    {fieldSource && (
                      <span className="mt-1 text-xs text-blue-600">
                        Based on: {fieldSource.studyName} ({fieldSource.year})
                        {fieldSource.pubmedId && (
                          <a 
                            href={`https://pubmed.ncbi.nlm.nih.gov/${fieldSource.pubmedId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 underline"
                          >
                            PubMed
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                );
              })
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
        <div ref={documentsStepRef} id="step-documents">
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
          
          <div ref={reviewStepRef} id="step-review">
            <CompliancePanel result={baselineResult} />
          </div>

          <section 
            ref={downloadStepRef}
            id="step-download"
            className={`rounded-lg border-2 transition-all duration-300 ${
              getCurrentStep() === 5 
                ? "border-indigo-500 bg-indigo-50 shadow-lg" 
                : "border-neutral-300 bg-white shadow-sm"
            } p-4`}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                getStepStatus(5) === "completed" 
                  ? "bg-emerald-600 text-white" 
                  : getStepStatus(5) === "in-progress"
                  ? "bg-indigo-600 text-white animate-pulse"
                  : "bg-neutral-300 text-neutral-600"
              }`}>
                {getStepStatus(5) === "completed" ? "✓" : "6"}
              </span>
              Baseline Pack Download
            </h2>
            <p className="text-sm text-neutral-700">
              Download a zip containing protocol, SAP, consent draft, CRF schema, regulatory checklist, and registry mapping. All
              files include explicit draft disclaimers and must be reviewed by the PI and IEC.
            </p>
            {aiAvailable === true && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useAIEnhancement"
                  checked={useAIEnhancement}
                  onChange={(e) => setUseAIEnhancement(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="useAIEnhancement" className="text-sm text-neutral-700">
                  Use AI enhancement for document narratives (recommended)
                </label>
              </div>
            )}
            <div className="mt-3 text-sm text-neutral-700">
              <p>
                Rulebook profile: <span className="font-medium">{baselineResult.versionInfo.rulebookProfile}</span> (version
                {baselineResult.versionInfo.rulebookVersion}). Generated at {new Date(baselineResult.versionInfo.generatedAt).toLocaleString()}.
              </p>
              <p className="mt-1">{baselineResult.disclaimer}</p>
            </div>
            {gate && gate.blockingIssues.length > 0 && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-100 p-3 text-sm text-amber-800">
                <p className="font-medium">Resolve or formally acknowledge these blocking issues before export:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {gate.blockingIssues.map((issue) => (
                    <li key={`blocking-${issue.code}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasCriticalIssues && (
              <label className="mt-4 flex items-start gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={acknowledgeCritical}
                  onChange={(event) => setAcknowledgeCritical(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  I understand these drafts contain critical unresolved issues and acknowledge that they are not IEC-approved or
                  ready for launch.
                </span>
              </label>
            )}
            {downloadError && <p className="mt-3 text-sm text-red-700">{downloadError}</p>}
            
            {/* Download Progress Indicator */}
            {downloadProgress.active && (
              <div className="mt-4 space-y-2 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-indigo-900 font-medium">{downloadProgress.currentFile}</span>
                  <span className="text-indigo-700 font-semibold">{downloadProgress.progress}%</span>
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${downloadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                disabled={
                  downloading || !baselineResult || (hasCriticalIssues && !acknowledgeCritical)
                }
                className={`rounded px-4 py-2 text-sm font-semibold text-white shadow transition-all duration-200 flex items-center gap-2 ${
                  downloading || !baselineResult || (hasCriticalIssues && !acknowledgeCritical)
                    ? "cursor-not-allowed bg-neutral-400"
                    : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-md"
                }`}
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Preparing zip...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Baseline Pack
                  </>
                )}
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
        </div>
      )}
      
      {/* Download Success Toast */}
      {downloadProgress.progress === 100 && !downloadProgress.active && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Download complete!</span>
        </div>
      )}
    </main>
  );
}

