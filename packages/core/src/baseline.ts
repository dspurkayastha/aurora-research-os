import { AURORA_RULEBOOK } from "./rulebook";
import {
  buildBaselineSpec,
  chooseDesign,
  parseIdeaToPreSpec,
} from "./orchestrator";
import { buildCrfSchema } from "./crf";
import { buildIecCoverNote } from "./iec";
import { buildLiteraturePlan } from "./literature";
import { buildPisIcfDraft } from "./pis_icf";
import { buildProtocolDraft } from "./protocol";
import { buildRegulatoryChecklist, buildRegistryMappingSheet } from "./regulatory";
import { buildSAPPlan, generatePlainLanguageStatsExplanation } from "./sap";
import {
  computeSampleSizeForStudy,
} from "./stats";
import type {
  BaselineBuildResult,
  BaselinePackage,
  LiteraturePlan,
  PISICFDraft,
  PreSpec,
  SampleSizeAssumptionsBase,
  SampleSizeResult,
  StatsExplanation,
  StudySpec,
  ValidationIssue,
} from "./types";

function mergeAssumptions(
  studySpec: StudySpec,
  partial: Partial<SampleSizeAssumptionsBase> | undefined
): SampleSizeAssumptionsBase {
  const defaultHypothesis: SampleSizeAssumptionsBase["hypothesisType"] =
    studySpec.designId === "single-arm" ||
    studySpec.designId === "diagnostic-accuracy" ||
    studySpec.designId === "registry"
      ? "estimation"
      : "superiority";

  const base: SampleSizeAssumptionsBase = {
    alpha: partial?.alpha ?? 0.05,
    power: partial?.power ?? 0.8,
    twoSided: partial?.twoSided ?? true,
    hypothesisType: partial?.hypothesisType ?? defaultHypothesis,
    designId: studySpec.designId ?? partial?.designId ?? "prospective-cohort",
    primaryEndpointType:
      studySpec.primaryEndpoint?.type ?? partial?.primaryEndpointType ?? "binary",
    expectedControlEventRate: partial?.expectedControlEventRate,
    expectedTreatmentEventRate: partial?.expectedTreatmentEventRate,
    expectedMeanControl: partial?.expectedMeanControl,
    expectedMeanTreatment: partial?.expectedMeanTreatment,
    assumedSD: partial?.assumedSD,
    expectedProportion: partial?.expectedProportion,
    hazardRatio: partial?.hazardRatio,
    eventProportionDuringFollowUp: partial?.eventProportionDuringFollowUp,
    precision: partial?.precision,
    dropoutRate: partial?.dropoutRate,
    clusterDesignEffect: partial?.clusterDesignEffect,
    caseControlRatio: partial?.caseControlRatio,
    exposurePrevInControls: partial?.exposurePrevInControls,
    targetMetric: partial?.targetMetric,
    notes: partial?.notes ? [...partial.notes] : [],
  };

  return base;
}

function placeholderSampleSize(
  assumptions: SampleSizeAssumptionsBase,
  message: string
): SampleSizeResult {
  return {
    status: "incomplete-input",
    assumptions,
    warnings: [message],
    notes: [],
  };
}

function collectIssues(
  studySpec: StudySpec,
  sampleSize: SampleSizeResult,
  sapExplanation: StatsExplanation,
  baseline: Omit<BaselinePackage, "issues">
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!studySpec.designId) {
    issues.push({
      code: "unsupported-design",
      scope: "design",
      severity: "error",
      message: "Study design could not be classified using the Aurora rulebook.",
    });
  } else if (!AURORA_RULEBOOK.studyDesigns.find((design) => design.id === studySpec.designId)) {
    issues.push({
      code: "design-not-whitelisted",
      scope: "design",
      severity: "error",
      message: "Selected design is not in the whitelisted Aurora designs and requires PI confirmation.",
    });
  }

  if (!studySpec.primaryEndpoint) {
    issues.push({
      code: "missing-primary-endpoint",
      scope: "endpoints",
      severity: "critical",
      message: "Primary endpoint is not defined; compliance gate cannot proceed.",
    });
  }

  if (sampleSize.status !== "ok") {
    issues.push({
      code: `sample-size-${sampleSize.status}`,
      scope: "sample-size",
      severity: sampleSize.status === "invalid-input" ? "critical" : "warning",
      message: sampleSize.warnings.join("; ") || "Sample size not finalised.",
    });
  }

  if (baseline.sap.endpoints.length === 0) {
    issues.push({
      code: "sap-missing-endpoints",
      scope: "sap",
      severity: "error",
      message: "SAP does not list any endpoints; confirm design and analysis before IEC submission.",
    });
  }

  const primaryName = studySpec.primaryEndpoint?.name;
  if (primaryName) {
    const crfHasPrimary = baseline.crf.forms.some((form) =>
      form.fields.some((field) => field.mapsToEndpointName === primaryName)
    );
    if (!crfHasPrimary) {
      issues.push({
        code: "crf-missing-primary",
        scope: "crf",
        severity: "error",
        message: `CRF schema does not map any field to the primary endpoint (${primaryName}).`,
      });
    }
  }

  if (baseline.protocol.warnings.length > 0) {
    issues.push({
      code: "protocol-warnings",
      scope: "protocol",
      severity: "warning",
      message: baseline.protocol.warnings.join("; "),
    });
  }

  if (baseline.pisIcf.warnings.length > 0) {
    issues.push({
      code: "pis-icf-warnings",
      scope: "pis-icf",
      severity: "warning",
      message: baseline.pisIcf.warnings.join("; "),
    });
  }

  if (baseline.crf.warnings.length > 0) {
    issues.push({
      code: "crf-warnings",
      scope: "crf",
      severity: "warning",
      message: baseline.crf.warnings.join("; "),
    });
  }

  if (baseline.regulatoryChecklist.items.some((item) => item.status !== "ok")) {
    issues.push({
      code: "regulatory-checklist-pending",
      scope: "regulatory",
      severity: "warning",
      message: "Regulatory checklist contains pending or missing items requiring PI attention.",
    });
  }

  if (sapExplanation.sampleSizeSummary.includes("could not")) {
    issues.push({
      code: "sap-explanation-incomplete",
      scope: "sap",
      severity: "warning",
      message: "SAP explanation indicates incomplete inputs; confirm assumptions with statistician.",
    });
  }

  return issues;
}

export function buildBaselinePackageFromIdea(
  rawIdea: string,
  assumptions?: Partial<SampleSizeAssumptionsBase>
): BaselineBuildResult {
  const preSpec: PreSpec = parseIdeaToPreSpec(rawIdea);
  const designId = chooseDesign(preSpec);
  const studySpec: StudySpec = buildBaselineSpec(preSpec, designId);

  const mergedAssumptions = mergeAssumptions(studySpec, assumptions);

  const sampleSize: SampleSizeResult =
    studySpec.designId && studySpec.primaryEndpoint
      ? computeSampleSizeForStudy(studySpec, mergedAssumptions)
      : placeholderSampleSize(
          mergedAssumptions,
          "Design or primary endpoint incomplete; sample size not computed."
        );

  const sap = buildSAPPlan(studySpec, sampleSize);
  const crf = buildCrfSchema(studySpec);
  const pisIcf = buildPisIcfDraft(studySpec);
  const registryMapping = buildRegistryMappingSheet(studySpec);
  const literaturePlan: LiteraturePlan = buildLiteraturePlan(studySpec);
  const protocol = buildProtocolDraft(studySpec, sap, sampleSize);
  const iecCoverNote = buildIecCoverNote({ studySpec, protocol, sap, pisIcf, crf });
  const baselineWithoutChecklist: BaselinePackage = {
    studySpec,
    protocol,
    sap,
    crf,
    pisIcf,
    iecCoverNote,
    regulatoryChecklist: { items: [] },
    registryMapping,
    literaturePlan,
    issues: [],
  };
  const regulatoryChecklist = buildRegulatoryChecklist(baselineWithoutChecklist);

  const sapExplanation: StatsExplanation = generatePlainLanguageStatsExplanation(
    studySpec,
    sampleSize,
    sap
  );

  const baseline: BaselinePackage = {
    ...baselineWithoutChecklist,
    regulatoryChecklist,
  };

  const issues = collectIssues(studySpec, sampleSize, sapExplanation, baseline);

  return {
    ...baseline,
    issues,
    sampleSize,
    sapExplanation,
  };
}

