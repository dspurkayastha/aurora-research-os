import { AURORA_RULEBOOK, STATS_METHODS } from "./rulebook";
import type {
  SAPAnalysisStep,
  SAPPlan,
  SampleSizeResult,
  StatsExplanation,
  StudySpec
} from "./types";

function cloneWarnings(warnings: string[] | undefined): string[] {
  return warnings ? [...warnings] : [];
}

function findMethodLabel(methodId: string | undefined): string | undefined {
  if (!methodId) {
    return undefined;
  }
  return STATS_METHODS.find((method) => method.id === methodId)?.label;
}

function buildPrimaryStep(studySpec: StudySpec): SAPAnalysisStep | null {
  const endpoint = studySpec.primaryEndpoint;
  if (!endpoint) {
    return null;
  }

  const labelBase = `Primary analysis: ${endpoint.name}`;

  switch (studySpec.designId) {
    case "rct-2arm-parallel": {
      if (endpoint.type === "binary") {
        return {
          label: "Primary analysis: compare event proportions between arms",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Chi-square test or Fisher's exact test (as appropriate)",
          effectMeasure: "Risk ratio and risk difference with 95% CI",
          adjusted: true,
          notes: "Adjust for stratification or key covariates if prespecified."
        };
      }
      if (endpoint.type === "continuous") {
        return {
          label: "Primary analysis: compare mean outcomes between arms",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Two-sample t-test (or non-parametric alternative if assumptions violated)",
          effectMeasure: "Mean difference with 95% CI",
          adjusted: false
        };
      }
      if (endpoint.type === "time-to-event") {
        return {
          label: "Primary analysis: compare time-to-event outcomes between arms",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Log-rank test",
          effectMeasure: "Hazard ratio from Cox proportional hazards model with 95% CI",
          adjusted: true,
          notes: "Assess proportional hazards assumption and report Kaplan–Meier curves."
        };
      }
      break;
    }
    case "prospective-cohort":
    case "retrospective-cohort": {
      if (endpoint.type === "binary") {
        return {
          label: "Primary analysis: assess association between exposure and binary outcome",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Log-binomial or logistic regression depending on convergence",
          effectMeasure: "Risk ratio or odds ratio with 95% CI",
          adjusted: true,
          notes: "Adjust for key confounders based on protocol and data availability."
        };
      }
      if (endpoint.type === "continuous") {
        return {
          label: "Primary analysis: compare mean outcome across exposure groups",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Linear regression with exposure as primary predictor",
          effectMeasure: "Adjusted mean difference with 95% CI",
          adjusted: true
        };
      }
      if (endpoint.type === "time-to-event") {
        return {
          label: "Primary analysis: evaluate time-to-event differences across exposures",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Cox proportional hazards model with Kaplan–Meier curves",
          effectMeasure: "Hazard ratio with 95% CI",
          adjusted: true,
          notes: "Assess proportional hazards and consider competing risks if relevant."
        };
      }
      break;
    }
    case "cross-sectional": {
      if (endpoint.type === "binary") {
        return {
          label: "Primary analysis: estimate prevalence or compare proportions",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Chi-square test / proportion estimate with 95% CI",
          effectMeasure: "Prevalence or risk difference with 95% CI",
          adjusted: false
        };
      }
      if (endpoint.type === "continuous") {
        return {
          label: "Primary analysis: compare mean values across groups",
          population: "full",
          endpointRole: "primary",
          endpointName: endpoint.name,
          testOrModel: "Two-sample t-test or ANOVA as applicable",
          effectMeasure: "Mean difference with 95% CI",
          adjusted: false
        };
      }
      break;
    }
    case "single-arm": {
      return {
        label: "Primary analysis: estimate single-arm response proportion",
        population: "full",
        endpointRole: "primary",
        endpointName: endpoint.name,
        testOrModel: "Binomial proportion with exact or Wilson 95% CI",
        effectMeasure: "Point estimate with confidence interval",
        adjusted: false
      };
    }
    case "diagnostic-accuracy": {
      return {
        label: "Primary analysis: evaluate diagnostic accuracy",
        population: "full",
        endpointRole: "primary",
        endpointName: endpoint.name,
        testOrModel: "Estimate sensitivity, specificity, predictive values, and ROC curve",
        effectMeasure: "Sensitivity, specificity, predictive values with 95% CI",
        adjusted: false,
        notes: "Document index test, reference standard, and any indeterminate handling."
      };
    }
    case "case-control": {
      return {
        label: "Primary analysis: estimate association between exposure and odds of outcome",
        population: "full",
        endpointRole: "primary",
        endpointName: endpoint.name,
        testOrModel: "Logistic regression",
        effectMeasure: "Odds ratio with 95% CI",
        adjusted: true,
        notes: "Include matching factors or confounders as covariates."
      };
    }
    case "registry": {
      return {
        label: "Primary analysis: descriptive registry summaries",
        population: "full",
        endpointRole: "primary",
        endpointName: endpoint.name,
        testOrModel: "Descriptive statistics with trend monitoring",
        effectMeasure: "Summary measures with 95% CI where applicable",
        adjusted: false,
        notes: "Registry analyses typically emphasise longitudinal trends and data completeness."
      };
    }
    default:
      break;
  }

  return {
    label: labelBase,
    population: "full",
    endpointRole: "primary",
    endpointName: endpoint.name,
    testOrModel: "Analysis approach to be confirmed by statistician",
    adjusted: false,
    notes: "No deterministic template available for this design-endpoint combination."
  };
}

export function buildSAPPlan(studySpec: StudySpec, ss: SampleSizeResult): SAPPlan {
  const steps: SAPAnalysisStep[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const primaryStep = buildPrimaryStep(studySpec);
  if (primaryStep) {
    steps.push(primaryStep);
  } else {
    warnings.push("Primary endpoint missing; SAP requires clarification.");
  }

  for (const endpoint of studySpec.secondaryEndpoints) {
    steps.push({
      label: `Secondary analysis: ${endpoint.name}`,
      population: "full",
      endpointRole: "secondary",
      endpointName: endpoint.name,
      testOrModel: "Appropriate model per endpoint type (exploratory)",
      adjusted: false
    });
  }

  const multiplicityHandling =
    "Primary endpoint analysed at two-sided alpha 0.05; secondary endpoints are exploratory unless prespecified otherwise.";
  const missingDataHandling =
    "Primary analysis based on available data (complete cases); perform sensitivity analyses as feasible.";
  const software = "R / Python / SAS / Stata — final choice by PI or statistician.";

  if (ss.status !== "ok") {
    warnings.push(
      "Sample size not finalised; SAP remains a draft and must be confirmed by a qualified statistician."
    );
  }

  const primaryMethodId = ss.status === "ok" ? ss.methodId : undefined;

  return {
    primaryMethodId,
    steps,
    multiplicityHandling,
    missingDataHandling,
    software,
    warnings: [...warnings, ...cloneWarnings(ss.warnings)],
    notes: [...notes, ...ss.notes]
  };
}

function buildAssumptionSummary(ss: SampleSizeResult): string {
  const a = ss.assumptions;
  const parts: string[] = [];

  parts.push(`Alpha ${a.alpha} (${a.twoSided ? "two-sided" : "one-sided"}) and power ${a.power}.`);

  if (typeof a.expectedControlEventRate === "number" || typeof a.expectedTreatmentEventRate === "number") {
    parts.push(
      `Expected control event rate ${a.expectedControlEventRate ?? "?"}, treatment event rate ${a.expectedTreatmentEventRate ?? "?"}.`
    );
  }
  if (typeof a.expectedMeanControl === "number" || typeof a.expectedMeanTreatment === "number") {
    parts.push(
      `Expected mean control ${a.expectedMeanControl ?? "?"}, treatment ${a.expectedMeanTreatment ?? "?"}.`
    );
  }
  if (typeof a.assumedSD === "number") {
    parts.push(`Assumed standard deviation ${a.assumedSD}.`);
  }
  if (typeof a.hazardRatio === "number") {
    parts.push(`Target hazard ratio ${a.hazardRatio}.`);
  }
  if (typeof a.eventProportionDuringFollowUp === "number") {
    parts.push(`Expected event proportion during follow-up ${a.eventProportionDuringFollowUp}.`);
  }
  if (typeof a.expectedProportion === "number") {
    parts.push(`Expected proportion ${a.expectedProportion}.`);
  }
  if (typeof a.precision === "number") {
    parts.push(`Desired half-width of confidence interval ${a.precision}.`);
  }
  if (typeof a.dropoutRate === "number") {
    parts.push(`Dropout rate ${a.dropoutRate}.`);
  }
  if (typeof a.clusterDesignEffect === "number") {
    parts.push(`Cluster design effect ${a.clusterDesignEffect}.`);
  }

  return parts.join(" ");
}

function buildAnalysisSummary(plan: SAPPlan): string {
  if (plan.steps.length === 0) {
    return "Analysis plan pending statistician input.";
  }

  const primary = plan.steps[0];
  return `${primary.label}. Planned method: ${primary.testOrModel}.`;
}

export function generatePlainLanguageStatsExplanation(
  studySpec: StudySpec,
  ss: SampleSizeResult,
  sap: SAPPlan
): StatsExplanation {
  const caveats = [
    "If actual event rates or variances differ from assumptions, achieved power will change.",
    "A qualified statistician must review and confirm these calculations before use.",
    AURORA_RULEBOOK.disclaimers.draftNotice
  ];

  if (ss.status !== "ok") {
    const summary =
      "The system could not safely compute a sample size with the information provided. " +
      `Status: ${ss.status}.`;
    const assumptionSummary = buildAssumptionSummary(ss);
    const analysisSummary = buildAnalysisSummary(sap);
    const caveatList = [...caveats, "Provide the missing inputs or consult a statistician."];

    return {
      sampleSizeSummary: summary,
      analysisSummary,
      assumptionSummary,
      caveats: caveatList
    };
  }

  const methodLabel = findMethodLabel(ss.methodId);
  const total = ss.totalSampleSize ? `Total sample size ${ss.totalSampleSize}.` : "";
  const perGroup = ss.perGroupSampleSize
    ? `Per group sample size ${ss.perGroupSampleSize}.`
    : "";
  const eventSummary = ss.eventsRequired ? `Events required ${ss.eventsRequired}.` : "";
  const sampleSizeSummary =
    `${methodLabel ?? "Sample size"} calculation complete. ${total} ${perGroup} ${eventSummary}`.trim();

  const analysisSummary = buildAnalysisSummary(sap);
  const assumptionSummary = buildAssumptionSummary(ss);
  const caveatList = [...caveats, ...(ss.notes.length ? ss.notes : [])];

  return {
    sampleSizeSummary,
    analysisSummary,
    assumptionSummary,
    caveats: caveatList
  };
}
