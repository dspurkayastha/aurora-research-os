"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AURORA_RULEBOOK,
  buildBaselineSpec,
  buildSAPPlan,
  chooseDesign,
  computeSampleSizeForStudy,
  generatePlainLanguageStatsExplanation,
  parseIdeaToPreSpec
} from "@aurora/core";
import type {
  SAPPlan,
  SampleSizeAssumptionsBase,
  SampleSizeResult,
  StatsExplanation
} from "@aurora/core";

const allowedDesigns = AURORA_RULEBOOK.studyDesigns;

const steps = [
  "Idea",
  "Design",
  "Sample Size",
  "Documents",
  "Review & Compliance",
  "Launch Workspace"
];

type TailOption = "two-sided" | "one-sided";
type MetricOption = "sensitivity" | "specificity" | "both";

type FormInputs = {
  alpha: string;
  power: string;
  twoSided: TailOption;
  expectedControlEventRate: string;
  expectedTreatmentEventRate: string;
  expectedMeanControl: string;
  expectedMeanTreatment: string;
  assumedSD: string;
  hazardRatio: string;
  eventProportionDuringFollowUp: string;
  expectedProportion: string;
  precision: string;
  dropoutRate: string;
  clusterDesignEffect: string;
  expectedSensitivity: string;
  expectedSpecificity: string;
  targetMetric: MetricOption;
};

const initialInputs: FormInputs = {
  alpha: "0.05",
  power: "0.8",
  twoSided: "two-sided",
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
  targetMetric: "both"
};

type FieldConfig = {
  key: keyof FormInputs;
  label: string;
  helper?: string;
  placeholder?: string;
  type?: "number" | "select";
  step?: string;
  min?: string;
  max?: string;
  options?: { value: string; label: string }[];
};

type AssumptionTemplate = {
  fields: FieldConfig[];
  notes: string[];
  scenario:
    | "two-proportions"
    | "two-means"
    | "time-to-event"
    | "single-proportion"
    | "diagnostic"
    | "binary-flex"
    | "registry"
    | "unsupported";
  preferEstimation: boolean;
};

const baseFieldConfigs: FieldConfig[] = [
  {
    key: "alpha",
    label: "Alpha (Type I error)",
    type: "number",
    step: "0.01",
    min: "0.0001",
    max: "0.2",
    helper: "Use 0.05 unless protocol specifies otherwise."
  },
  {
    key: "power",
    label: "Power",
    type: "number",
    step: "0.01",
    min: "0.5",
    max: "0.99",
    helper: "80% is common for early studies; adjust if needed."
  },
  {
    key: "twoSided",
    label: "Tail",
    type: "select",
    options: [
      { value: "two-sided", label: "Two-sided" },
      { value: "one-sided", label: "One-sided" }
    ],
    helper: "Two-sided testing is the default expectation."
  }
];

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

export default function NewStudyPage() {
  const [idea, setIdea] = useState("");
  const [storyRequested, setStoryRequested] = useState(false);
  const [assumptionInputs, setAssumptionInputs] = useState<FormInputs>(initialInputs);
  const [sampleSizeResult, setSampleSizeResult] = useState<SampleSizeResult | null>(null);
  const [sapPlan, setSapPlan] = useState<SAPPlan | null>(null);
  const [statsExplanation, setStatsExplanation] = useState<StatsExplanation | null>(null);
  const [computeAttempted, setComputeAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const story = useMemo(() => {
    if (!storyRequested || !idea.trim()) {
      return null;
    }

    const preSpec = parseIdeaToPreSpec(idea);
    const designId = chooseDesign(preSpec);
    const studySpec = buildBaselineSpec(preSpec, designId);

    return {
      preSpec,
      designId,
      studySpec,
      designKnown: Boolean(designId)
    };
  }, [idea, storyRequested]);

  const designKey = story
    ? `${story.studySpec.designId}|${story.studySpec.primaryEndpoint?.type ?? "none"}`
    : "none";

  useEffect(() => {
    setAssumptionInputs(initialInputs);
    setSampleSizeResult(null);
    setSapPlan(null);
    setStatsExplanation(null);
    setComputeAttempted(false);
    setFormError(null);
  }, [designKey]);

  const assumptionTemplate: AssumptionTemplate = useMemo(() => {
    if (!story?.studySpec.primaryEndpoint) {
      return { fields: [], notes: [], scenario: "unsupported", preferEstimation: false };
    }

    const designId = story.studySpec.designId;
    const endpointType = story.studySpec.primaryEndpoint.type;
    const fields: FieldConfig[] = [...baseFieldConfigs];
    const notes: string[] = [];
    let scenario: AssumptionTemplate["scenario"] = "unsupported";
    let preferEstimation = false;

    const addDropoutAndCluster = () => {
      fields.push(
        {
          key: "dropoutRate",
          label: "Expected dropout rate (0-1)",
          type: "number",
          step: "0.01",
          helper: "Optional. Leave blank if not planning an adjustment."
        },
        {
          key: "clusterDesignEffect",
          label: "Cluster design effect",
          type: "number",
          step: "0.1",
          helper: "Optional. Enter >1 if clustering inflates sample size."
        }
      );
    };

    switch (designId) {
      case "rct-2arm-parallel": {
        if (endpointType === "binary") {
          fields.push(
            {
              key: "expectedControlEventRate",
              label: "Control group event rate (0-1)",
              type: "number",
              step: "0.01"
            },
            {
              key: "expectedTreatmentEventRate",
              label: "Intervention group event rate (0-1)",
              type: "number",
              step: "0.01"
            }
          );
          scenario = "two-proportions";
          addDropoutAndCluster();
        } else if (endpointType === "continuous") {
          fields.push(
            {
              key: "expectedMeanControl",
              label: "Control group mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "expectedMeanTreatment",
              label: "Intervention group mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "assumedSD",
              label: "Assumed common SD",
              type: "number",
              step: "0.1"
            }
          );
          scenario = "two-means";
          addDropoutAndCluster();
        } else if (endpointType === "time-to-event") {
          fields.push(
            {
              key: "hazardRatio",
              label: "Target hazard ratio",
              type: "number",
              step: "0.01"
            },
            {
              key: "eventProportionDuringFollowUp",
              label: "Expected event proportion during follow-up (0-1)",
              type: "number",
              step: "0.01"
            }
          );
          scenario = "time-to-event";
          addDropoutAndCluster();
        }
        break;
      }
      case "prospective-cohort":
      case "retrospective-cohort": {
        if (endpointType === "binary") {
          fields.push(
            {
              key: "expectedControlEventRate",
              label: "Reference group event rate (0-1)",
              type: "number",
              step: "0.01"
            },
            {
              key: "expectedTreatmentEventRate",
              label: "Comparison group event rate (0-1)",
              type: "number",
              step: "0.01"
            }
          );
          scenario = "two-proportions";
          addDropoutAndCluster();
        } else if (endpointType === "continuous") {
          fields.push(
            {
              key: "expectedMeanControl",
              label: "Reference group mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "expectedMeanTreatment",
              label: "Comparison group mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "assumedSD",
              label: "Assumed common SD",
              type: "number",
              step: "0.1"
            }
          );
          scenario = "two-means";
          addDropoutAndCluster();
        } else if (endpointType === "time-to-event") {
          fields.push(
            {
              key: "hazardRatio",
              label: "Target hazard ratio",
              type: "number",
              step: "0.01"
            },
            {
              key: "eventProportionDuringFollowUp",
              label: "Expected event proportion during follow-up (0-1)",
              type: "number",
              step: "0.01"
            }
          );
          scenario = "time-to-event";
          addDropoutAndCluster();
        }
        break;
      }
      case "cross-sectional": {
        if (endpointType === "binary") {
          fields.push(
            {
              key: "expectedControlEventRate",
              label: "Group A proportion (0-1)",
              type: "number",
              step: "0.01",
              helper: "Provide group proportions for comparisons."
            },
            {
              key: "expectedTreatmentEventRate",
              label: "Group B proportion (0-1)",
              type: "number",
              step: "0.01"
            },
            {
              key: "expectedProportion",
              label: "Overall prevalence estimate (0-1)",
              type: "number",
              step: "0.01",
              helper: "For prevalence precision calculations, provide prevalence and precision below."
            },
            {
              key: "precision",
              label: "Desired half-width of CI",
              type: "number",
              step: "0.01"
            }
          );
          scenario = "binary-flex";
          addDropoutAndCluster();
          notes.push(
            "For cross-sectional designs, fill either the group proportions for a comparison or a single prevalence and precision for estimation."
          );
        } else if (endpointType === "continuous") {
          fields.push(
            {
              key: "expectedMeanControl",
              label: "Group A mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "expectedMeanTreatment",
              label: "Group B mean",
              type: "number",
              step: "0.1"
            },
            {
              key: "assumedSD",
              label: "Assumed SD",
              type: "number",
              step: "0.1"
            }
          );
          scenario = "two-means";
          addDropoutAndCluster();
        }
        break;
      }
      case "single-arm": {
        fields.push(
          {
            key: "expectedProportion",
            label: "Expected response rate (0-1)",
            type: "number",
            step: "0.01"
          },
          {
            key: "precision",
            label: "Desired half-width of CI",
            type: "number",
            step: "0.01"
          }
        );
        scenario = "single-proportion";
        preferEstimation = true;
        addDropoutAndCluster();
        break;
      }
      case "diagnostic-accuracy": {
        fields.push(
          {
            key: "targetMetric",
            label: "Metric to estimate",
            type: "select",
            options: [
              { value: "both", label: "Sensitivity and specificity" },
              { value: "sensitivity", label: "Sensitivity only" },
              { value: "specificity", label: "Specificity only" }
            ],
            helper: "Choose which diagnostic accuracy metrics require precision."
          },
          {
            key: "expectedSensitivity",
            label: "Expected sensitivity (0-1)",
            type: "number",
            step: "0.01"
          },
          {
            key: "expectedSpecificity",
            label: "Expected specificity (0-1)",
            type: "number",
            step: "0.01"
          },
          {
            key: "precision",
            label: "Desired half-width of CI",
            type: "number",
            step: "0.01"
          }
        );
        scenario = "diagnostic";
        preferEstimation = true;
        addDropoutAndCluster();
        break;
      }
      case "registry": {
        fields.push(
          {
            key: "expectedProportion",
            label: "Key proportion to track (0-1)",
            type: "number",
            step: "0.01",
            helper: "Optional — registry sample size is often feasibility-driven."
          },
          {
            key: "precision",
            label: "Desired half-width of CI",
            type: "number",
            step: "0.01"
          }
        );
        scenario = "registry";
        preferEstimation = true;
        addDropoutAndCluster();
        notes.push(
          "Registries are usually constrained by operational capacity; provide a key proportion only if a precision target is required."
        );
        break;
      }
      case "case-control": {
        scenario = "unsupported";
        notes.push("Automated case-control sample size is not implemented. Consult a statistician.");
        break;
      }
      default:
        scenario = "unsupported";
    }

    return { fields, notes, scenario, preferEstimation };
  }, [story]);

  const handleGenerate = () => {
    setStoryRequested(true);
    if (!idea.trim()) {
      return;
    }
  };

  const handleInputChange = (key: keyof FormInputs, value: string) => {
    setAssumptionInputs((previous) => ({ ...previous, [key]: value }) as FormInputs);
  };

  const handleCompute = () => {
    setComputeAttempted(true);

    if (!story?.studySpec.primaryEndpoint) {
      setFormError("Define a primary endpoint before computing sample size.");
      setSampleSizeResult(null);
      setSapPlan(null);
      setStatsExplanation(null);
      return;
    }

    if (assumptionTemplate.scenario === "unsupported") {
      setFormError("Sample size automation is not available for this design in v1.");
      setSampleSizeResult(null);
      setSapPlan(null);
      setStatsExplanation(null);
      return;
    }

    const alpha = parseOptionalNumber(assumptionInputs.alpha);
    const power = parseOptionalNumber(assumptionInputs.power);

    if (alpha === undefined || power === undefined) {
      setFormError("Provide numeric values for alpha and power.");
      setSampleSizeResult(null);
      setSapPlan(null);
      setStatsExplanation(null);
      return;
    }

    const twoSided = assumptionInputs.twoSided === "two-sided";

    const expectedProportion = parseOptionalNumber(assumptionInputs.expectedProportion);
    const precision = parseOptionalNumber(assumptionInputs.precision);

    let hypothesisType: "superiority" | "estimation" = assumptionTemplate.preferEstimation
      ? "estimation"
      : "superiority";

    if (expectedProportion !== undefined && precision !== undefined) {
      hypothesisType = "estimation";
    }
    if (story.studySpec.designId === "diagnostic-accuracy") {
      hypothesisType = "estimation";
    }

    const assembled: SampleSizeAssumptionsBase = {
      alpha,
      power,
      twoSided,
      hypothesisType,
      designId: story.studySpec.designId,
      primaryEndpointType: story.studySpec.primaryEndpoint.type
    };

    const controlRate = parseOptionalNumber(assumptionInputs.expectedControlEventRate);
    const treatmentRate = parseOptionalNumber(assumptionInputs.expectedTreatmentEventRate);
    const meanControl = parseOptionalNumber(assumptionInputs.expectedMeanControl);
    const meanTreatment = parseOptionalNumber(assumptionInputs.expectedMeanTreatment);
    const assumedSD = parseOptionalNumber(assumptionInputs.assumedSD);
    const hazardRatio = parseOptionalNumber(assumptionInputs.hazardRatio);
    const eventProportion = parseOptionalNumber(assumptionInputs.eventProportionDuringFollowUp);
    const dropoutRate = parseOptionalNumber(assumptionInputs.dropoutRate);
    const clusterDesignEffect = parseOptionalNumber(assumptionInputs.clusterDesignEffect);
    const expectedSensitivity = parseOptionalNumber(assumptionInputs.expectedSensitivity);
    const expectedSpecificity = parseOptionalNumber(assumptionInputs.expectedSpecificity);

    if (controlRate !== undefined) {
      assembled.expectedControlEventRate = controlRate;
    }
    if (treatmentRate !== undefined) {
      assembled.expectedTreatmentEventRate = treatmentRate;
    }
    if (meanControl !== undefined) {
      assembled.expectedMeanControl = meanControl;
    }
    if (meanTreatment !== undefined) {
      assembled.expectedMeanTreatment = meanTreatment;
    }
    if (assumedSD !== undefined) {
      assembled.assumedSD = assumedSD;
    }
    if (expectedProportion !== undefined) {
      assembled.expectedProportion = expectedProportion;
    }
    if (precision !== undefined) {
      assembled.precision = precision;
    }
    if (hazardRatio !== undefined) {
      assembled.hazardRatio = hazardRatio;
    }
    if (eventProportion !== undefined) {
      assembled.eventProportionDuringFollowUp = eventProportion;
    }
    if (dropoutRate !== undefined) {
      assembled.dropoutRate = dropoutRate;
    }
    if (clusterDesignEffect !== undefined) {
      assembled.clusterDesignEffect = clusterDesignEffect;
    }
    if (expectedSensitivity !== undefined) {
      assembled.expectedSensitivity = expectedSensitivity;
    }
    if (expectedSpecificity !== undefined) {
      assembled.expectedSpecificity = expectedSpecificity;
    }
    if (story.studySpec.designId === "diagnostic-accuracy") {
      assembled.targetMetric = assumptionInputs.targetMetric;
    }

    const result = computeSampleSizeForStudy(story.studySpec, assembled);
    const plan = buildSAPPlan(story.studySpec, result);
    const explanation = generatePlainLanguageStatsExplanation(story.studySpec, result, plan);

    setFormError(null);
    setSampleSizeResult(result);
    setSapPlan(plan);
    setStatsExplanation(explanation);
  };

  const combinedWarnings = useMemo(() => {
    const unique = new Set<string>();
    if (sampleSizeResult) {
      sampleSizeResult.warnings.forEach((warning) => unique.add(warning));
    }
    if (sapPlan) {
      sapPlan.warnings.forEach((warning) => unique.add(warning));
    }
    return Array.from(unique.values());
  }, [sampleSizeResult, sapPlan]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">New study workspace</h1>
          <p className="text-slate-600">
            Share your clinical question or unmet need. Aurora will map it to the India v1 rulebook and draft a structured study
            blueprint without making regulatory claims.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800">Workflow overview</h2>
          <ol className="mt-4 space-y-3 text-slate-600">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-slate-700" htmlFor="study-idea">
            Describe your study idea
          </label>
          <textarea
            id="study-idea"
            name="study-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Example: Evaluate a 12-week lifestyle intervention to improve HbA1c control in adults with newly diagnosed type 2 diabetes at our urban clinic."
            className="min-h-[180px] w-full rounded-lg border border-slate-300 bg-white p-4 text-base text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Generate study story
            </button>
            {!idea.trim() && storyRequested ? (
              <span className="text-xs text-red-600">Add your idea to generate a study story.</span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            Aurora will keep the narrative intact while structuring downstream documents and compliance artifacts.
          </p>
        </div>

        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Sample size &amp; SAP draft</h2>
            <p className="mt-1 text-sm text-slate-600">
              Deterministic calculators aligned with the India v1 rulebook. Provide the assumptions you know; the system will stay silent rather than guess.
            </p>
          </div>

          {!story ? (
            <p className="text-sm text-slate-500">Generate a study story first to unlock sample size planning.</p>
          ) : (
            <>
              {!story.studySpec.primaryEndpoint ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                  Primary endpoint not clearly identified; sample size automation is paused until it is confirmed.
                </p>
              ) : null}

              {assumptionTemplate.notes.length > 0 ? (
                <ul className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {assumptionTemplate.notes.map((note) => (
                    <li key={note}>• {note}</li>
                  ))}
                </ul>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {assumptionTemplate.fields.map((field) => {
                  if (field.type === "select") {
                    return (
                      <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-700">
                        {field.label}
                        <select
                          value={assumptionInputs[field.key]}
                          onChange={(event) => handleInputChange(field.key, event.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
                      </label>
                    );
                  }

                  return (
                    <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-700">
                      {field.label}
                      <input
                        type="number"
                        value={assumptionInputs[field.key]}
                        onChange={(event) => handleInputChange(field.key, event.target.value)}
                        step={field.step}
                        min={field.min}
                        max={field.max}
                        placeholder={field.placeholder}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                      {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCompute}
                  className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  disabled={!story.studySpec.primaryEndpoint}
                >
                  Compute sample size &amp; SAP (draft)
                </button>
                {formError ? <span className="text-xs text-red-600">{formError}</span> : null}
              </div>

              {computeAttempted ? (
                <div className="space-y-4">
                  {sampleSizeResult ? (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                        <span className="text-slate-800">{sampleSizeResult.status}</span>
                      </div>
                      {sampleSizeResult.status === "ok" ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total sample size</p>
                            <p className="text-slate-800">
                              {sampleSizeResult.totalSampleSize ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Per group</p>
                            <p className="text-slate-800">
                              {sampleSizeResult.perGroupSampleSize ?? "—"}
                            </p>
                          </div>
                          {sampleSizeResult.eventsRequired ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Events required</p>
                              <p className="text-slate-800">{sampleSizeResult.eventsRequired}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">
                          No automated number provided. Review warnings below and refine assumptions or consult a statistician.
                        </p>
                      )}
                      {sampleSizeResult.notes.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                            {sampleSizeResult.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No calculation attempted yet. Provide assumptions and run the deterministic engine.
                    </p>
                  )}

                  {combinedWarnings.length > 0 ? (
                    <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                      {combinedWarnings.map((warning) => (
                        <div key={warning}>• {warning}</div>
                      ))}
                    </div>
                  ) : null}

                  {sapPlan ? (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">SAP outline</h3>
                        <ul className="mt-2 space-y-2">
                          {sapPlan.steps.map((step) => (
                            <li key={`${step.endpointRole}-${step.endpointName}-${step.label}`} className="rounded border border-slate-200 bg-slate-50 p-3">
                              <p className="font-medium text-slate-800">{step.label}</p>
                              <p className="text-xs text-slate-600">Method: {step.testOrModel}</p>
                              {step.effectMeasure ? (
                                <p className="text-xs text-slate-600">Effect measure: {step.effectMeasure}</p>
                              ) : null}
                              {step.notes ? <p className="text-xs text-slate-500">{step.notes}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-1 text-xs text-slate-500">
                        <p>{sapPlan.multiplicityHandling}</p>
                        <p>{sapPlan.missingDataHandling}</p>
                        <p>Preferred software: {sapPlan.software}</p>
                      </div>
                    </div>
                  ) : null}

                  {statsExplanation ? (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sample size summary</p>
                        <p className="text-slate-800">{statsExplanation.sampleSizeSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analysis summary</p>
                        <p className="text-slate-800">{statsExplanation.analysisSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assumptions</p>
                        <p className="text-slate-800">{statsExplanation.assumptionSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caveats</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                          {statsExplanation.caveats.map((caveat) => (
                            <li key={caveat}>{caveat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <p className="text-xs text-slate-500">
            These numbers and analyses are AI-assisted drafts based on standard formulas and your inputs. They must be reviewed and confirmed by a qualified statistician and your ethics committee.
          </p>
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Study story</h2>
          <p className="mt-2 text-sm text-slate-600">
            Deterministic interpretation powered by the India v1 rulebook. Review every element before progressing.
          </p>
        </div>

        {story ? (
          <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed title</h3>
              <p className="mt-1 text-slate-800">{story.studySpec.title}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Design</h3>
              <p className="mt-1 text-slate-800">
                {story.designKnown ? story.studySpec.designLabel : "Needs clarification"}
              </p>
              {!story.designKnown && (
                <p className="text-xs text-amber-600">
                  Design suggestion is uncertain; please refine your idea or consult a methodologist.
                </p>
              )}
            </div>
            {story.studySpec.condition ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition focus</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.condition}</p>
              </div>
            ) : null}
            {story.studySpec.populationDescription ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Population</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.populationDescription}</p>
              </div>
            ) : null}
            {story.studySpec.setting ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Setting</h3>
                <p className="mt-1 text-slate-800">{story.studySpec.setting}</p>
              </div>
            ) : null}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary endpoint</h3>
              {story.studySpec.primaryEndpoint ? (
                <div className="mt-1 space-y-1">
                  <p className="text-slate-800">{story.studySpec.primaryEndpoint.name}</p>
                  <p className="text-xs text-slate-500">Type: {story.studySpec.primaryEndpoint.type}</p>
                  {story.studySpec.primaryEndpoint.timeframe ? (
                    <p className="text-xs text-slate-500">Timeframe: {story.studySpec.primaryEndpoint.timeframe}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-xs text-amber-600">Primary endpoint not clearly identified; please define it.</p>
              )}
            </div>
            {story.studySpec.notes.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  {story.studySpec.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
            Enter your idea and generate to see the structured story.
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Allowed study designs</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {allowedDesigns.map((design) => (
              <li key={design.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="font-medium">{design.label}</div>
                <div className="text-xs text-slate-500">Category: {design.category}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
          Draft interpretation generated from your idea using Aurora’s rulebook. This is not a final protocol and requires expert review.
        </div>
      </aside>
    </div>
  );
}
