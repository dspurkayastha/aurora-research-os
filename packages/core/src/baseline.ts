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
import { computeSampleSizeForStudy } from "./stats";
import { getResearchBackedDefaults } from "./research-defaults";
import type {
  BaselineBuildResult,
  BaselinePackage,
  BaselineVersionInfo,
  LiteraturePlan,
  PISICFDraft,
  PreSpec,
  SampleSizeAssumptionsBase,
  SampleSizeResult,
  StatsExplanation,
  StudySpec,
  ValidationIssue,
} from "./types";

const DEFAULT_VERSION_INFO: Pick<BaselineVersionInfo, "rulebookProfile" | "rulebookVersion"> = {
  rulebookProfile: "india-v1",
  rulebookVersion: AURORA_RULEBOOK.version,
};

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

  // Get research-backed defaults
  const researchDefaults = getResearchBackedDefaults(
    studySpec.condition,
    studySpec.designId,
    studySpec.primaryEndpoint?.type
  );

  // Merge: user input > research defaults > system defaults
  return {
    alpha: partial?.alpha ?? 0.05,
    power: partial?.power ?? 0.8,
    twoSided: partial?.twoSided ?? true,
    hypothesisType: partial?.hypothesisType ?? defaultHypothesis,
    designId: studySpec.designId ?? partial?.designId ?? "prospective-cohort",
    primaryEndpointType:
      studySpec.primaryEndpoint?.type ?? partial?.primaryEndpointType ?? "binary",
    expectedControlEventRate: partial?.expectedControlEventRate ?? researchDefaults.assumptions.expectedControlEventRate,
    expectedTreatmentEventRate: partial?.expectedTreatmentEventRate ?? researchDefaults.assumptions.expectedTreatmentEventRate,
    expectedMeanControl: partial?.expectedMeanControl ?? researchDefaults.assumptions.expectedMeanControl,
    expectedMeanTreatment: partial?.expectedMeanTreatment ?? researchDefaults.assumptions.expectedMeanTreatment,
    assumedSD: partial?.assumedSD ?? researchDefaults.assumptions.assumedSD,
    expectedProportion: partial?.expectedProportion ?? researchDefaults.assumptions.expectedProportion,
    hazardRatio: partial?.hazardRatio ?? researchDefaults.assumptions.hazardRatio,
    eventProportionDuringFollowUp: partial?.eventProportionDuringFollowUp ?? researchDefaults.assumptions.eventProportionDuringFollowUp,
    precision: partial?.precision ?? researchDefaults.assumptions.precision,
    dropoutRate: partial?.dropoutRate ?? researchDefaults.assumptions.dropoutRate,
    clusterDesignEffect: partial?.clusterDesignEffect ?? researchDefaults.assumptions.clusterDesignEffect,
    caseControlRatio: partial?.caseControlRatio ?? researchDefaults.assumptions.caseControlRatio,
    exposurePrevInControls: partial?.exposurePrevInControls ?? researchDefaults.assumptions.exposurePrevInControls,
    targetMetric: partial?.targetMetric ?? researchDefaults.assumptions.targetMetric,
    expectedSensitivity: partial?.expectedSensitivity ?? researchDefaults.assumptions.expectedSensitivity,
    expectedSpecificity: partial?.expectedSpecificity ?? researchDefaults.assumptions.expectedSpecificity,
    notes: partial?.notes ? [...partial.notes] : [],
  };
}

/**
 * Get research sources for sample size assumptions
 */
export function getResearchSourcesForAssumptions(
  studySpec: StudySpec
): import("./research-defaults").ResearchSource[] {
  const researchDefaults = getResearchBackedDefaults(
    studySpec.condition,
    studySpec.designId,
    studySpec.primaryEndpoint?.type
  );
  return researchDefaults.sources;
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

function crossLinkIssues(baseline: BaselinePackage, sapExplanation: StatsExplanation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { studySpec, sap, crf, protocol, pisIcf, regulatoryChecklist, sampleSize } = baseline;

  if (!studySpec.designId) {
    issues.push({
      code: "unsupported-design",
      scope: "design",
      severity: "error",
      message: "Study design could not be classified using the Aurora rulebook.",
    });
  } else if (!AURORA_RULEBOOK.studyDesigns.some((design) => design.id === studySpec.designId)) {
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
      message: "Primary endpoint is missing; IEC submissions must not proceed until defined.",
    });
  }

  const primaryName = studySpec.primaryEndpoint?.name;
  if (primaryName) {
    const protocolMentionsPrimary = protocol.sections.some((section) =>
      section.content.toLowerCase().includes(primaryName.toLowerCase())
    );
    if (!protocolMentionsPrimary) {
      issues.push({
        code: "protocol-primary-mismatch",
        scope: "protocol",
        severity: "critical",
        message: `Protocol draft does not explicitly mention the primary endpoint "${primaryName}".`,
      });
    }

    const sapHasPrimary = sap.endpoints.some(
      (endpoint) => endpoint.role === "primary" && endpoint.endpointName === primaryName
    );
    if (!sapHasPrimary) {
      issues.push({
        code: "sap-primary-missing",
        scope: "sap",
        severity: "critical",
        message: `SAP draft lacks an analysis plan for the primary endpoint "${primaryName}".`,
      });
    }

    const crfCapturesPrimary = crf.forms.some((form) =>
      form.fields.some((field) => field.mapsToEndpointName === primaryName)
    );
    if (!crfCapturesPrimary) {
      issues.push({
        code: "crf-primary-missing",
        scope: "crf",
        severity: "critical",
        message: `CRF schema does not include a field mapped to the primary endpoint "${primaryName}".`,
      });
    }
  }

  if (sap.endpoints.length === 0) {
    issues.push({
      code: "sap-no-endpoints",
      scope: "sap",
      severity: "error",
      message: "No endpoints listed in SAP draft; statistician input required before IEC submission.",
    });
  }

  if (sampleSize.status !== "ok") {
    issues.push({
      code: `sample-size-${sampleSize.status}`,
      scope: "sample-size",
      severity: sampleSize.status === "invalid-input" ? "critical" : "warning",
      message:
        sampleSize.warnings.join("; ") ||
        "Sample size calculation not finalised; IEC should not receive this as-is.",
    });
  }

  if (sapExplanation.sampleSizeSummary.includes("could not")) {
    issues.push({
      code: "sample-size-explanation-incomplete",
      scope: "sample-size",
      severity: "warning",
      message: "Plain-language explanation indicates incomplete assumptions; confirm with statistician.",
    });
  }

  const mandatoryConsentSections = new Set([
    "intro",
    "purpose",
    "procedures",
    "risks",
    "benefits",
    "alternatives",
    "confidentiality",
    "compensation_injury",
    "voluntary_right_to_withdraw",
    "contacts",
  ]);
  const consentCategoriesPresent = new Set(
    pisIcf.sections.map((section) => section.id)
  );
  for (const id of mandatoryConsentSections) {
    if (!consentCategoriesPresent.has(id)) {
      issues.push({
        code: `pis-icf-${id}-missing`,
        scope: "pis-icf",
        severity: "critical",
        message: `PIS/ICF draft is missing the mandatory section "${id}".`,
      });
    }
  }

  const checklistBlocking = regulatoryChecklist.items.filter(
    (item) => item.status !== "ok" && (item.severity === "error" || item.severity === "critical")
  );
  for (const item of checklistBlocking) {
    issues.push({
      code: `reg-${item.id}`,
      scope: "regulatory",
      severity: item.severity,
      message: `${item.label}: ${item.notes ?? "Action required"}.`,
    });
  }

  return issues;
}

/**
 * Build baseline package from an existing StudySpec (preserves clarifying question answers)
 */
export function buildBaselinePackageFromSpec(
  studySpec: StudySpec,
  assumptions?: Partial<SampleSizeAssumptionsBase>
): BaselineBuildResult {
  const mergedAssumptions = mergeAssumptions(studySpec, assumptions);
  const sampleSize: SampleSizeResult =
    studySpec.designId && studySpec.primaryEndpoint
      ? computeSampleSizeForStudy(studySpec, mergedAssumptions)
      : placeholderSampleSize(
          mergedAssumptions,
          "Design or primary endpoint incomplete; sample size not computed."
        );

  const sap = buildSAPPlan(studySpec, sampleSize);
  const crf = buildCrfSchema(studySpec, sap);
  const pisIcf: PISICFDraft = buildPisIcfDraft(studySpec);
  const protocol = buildProtocolDraft(studySpec, sap, sampleSize);
  const iecCoverNote = buildIecCoverNote({ studySpec, protocol, sap, pisIcf, crf, sampleSize });
  const registryMapping = buildRegistryMappingSheet(studySpec, sampleSize, sap);
  const literaturePlan: LiteraturePlan = buildLiteraturePlan(studySpec);
  const regulatoryChecklist = buildRegulatoryChecklist({
    studySpec,
    sampleSize,
    sap,
    protocol,
    pisIcf,
    crf,
    registryMapping,
    literaturePlan,
  });

  const sapExplanation: StatsExplanation = generatePlainLanguageStatsExplanation(
    studySpec,
    sampleSize,
    sap
  );

  const baseline: BaselinePackage = {
    studySpec,
    sampleSize,
    sap,
    protocol,
    crf,
    pisIcf,
    iecCoverNote,
    regulatoryChecklist,
    registryMapping,
    literaturePlan,
    sapExplanation,
    issues: [],
    disclaimer: AURORA_RULEBOOK.disclaimers.draftNotice,
    versionInfo: {
      ...DEFAULT_VERSION_INFO,
      generatedAt: new Date().toISOString(),
    },
  };

  const issues = crossLinkIssues(baseline, sapExplanation);

  return {
    ...baseline,
    issues,
  };
}

export function buildBaselinePackageFromIdea(
  rawIdea: string,
  assumptions?: Partial<SampleSizeAssumptionsBase>
): BaselineBuildResult {
  const preSpec: PreSpec = parseIdeaToPreSpec(rawIdea);
  const designId = chooseDesign(preSpec);
  const studySpec: StudySpec = buildBaselineSpec(preSpec, designId ?? null);

  return buildBaselinePackageFromSpec(studySpec, assumptions);
}

export function canLockAndLaunch(
  baseline: BaselineBuildResult
): { allowed: boolean; blockingIssues: ValidationIssue[] } {
  const blockingIssues = baseline.issues.filter((issue) => {
    if (issue.acknowledged) {
      return false;
    }
    return issue.severity === "critical" || issue.severity === "error";
  });

  return { allowed: blockingIssues.length === 0, blockingIssues };
}

