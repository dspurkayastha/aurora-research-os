import { STATS_METHODS } from "./rulebook";
import type {
  EndpointSpec,
  SAPEndpointPlan,
  SAPPlan,
  SampleSizeResult,
  StatsExplanation,
  StudySpec,
} from "./types";

const DEFAULT_ANALYSIS_SETS = {
  fullAnalysisSet:
    "All enrolled participants meeting eligibility criteria with at least one post-baseline assessment.",
  perProtocolSet:
    "Participants without major protocol deviations impacting the primary endpoint (to be defined by PI/statistician).",
  safetySet: "All participants exposed to study intervention or undergoing study procedures.",
};

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
  STATS_METHODS.map((method) => [method.id, method.label])
);

function mapTestOrModel(designId: string | undefined, endpoint: EndpointSpec): {
  plan: SAPEndpointPlan;
  warning?: string;
} {
  const basePlan: Omit<SAPEndpointPlan, "role" | "endpointName" | "type"> = {
    estimand: undefined,
    hypothesis: undefined,
    alphaAllocation: undefined,
    testOrModel: "Analysis approach to be specified by statistician",
    effectMeasure: undefined,
    covariates: undefined,
    missingDataApproach: undefined,
    notes: undefined,
  };

  const makePlan = (overrides: Partial<SAPEndpointPlan>): SAPEndpointPlan => ({
    endpointName: endpoint.name,
    role: endpoint.role === "primary" ? "primary" : endpoint.role === "secondary" ? "secondary" : "secondary",
    type: endpoint.type,
    ...basePlan,
    ...overrides,
  });

  if (!designId) {
    return {
      plan: makePlan({
        testOrModel: "Design not finalised; statistician to specify confirmatory method.",
        notes: "Study design pending confirmation; SAP requires PI/statistician input.",
      }),
      warning: "Design not confirmed; SAP endpoints recorded as placeholders.",
    };
  }

  switch (designId) {
    case "rct-2arm-parallel": {
      if (endpoint.type === "binary") {
        return {
          plan: makePlan({
            testOrModel: "Chi-square test or Fisher's exact test as appropriate",
            effectMeasure: "Risk ratio and risk difference with 95% confidence interval",
            covariates: ["stratification factors if used", "key baseline covariates"],
            missingDataApproach: "Multiple imputation or worst-case sensitivity analysis for missing outcomes.",
            estimand: "Treatment difference in proportion achieving outcome",
            hypothesis: "Superiority of investigational arm over control",
          }),
        };
      }
      if (endpoint.type === "continuous") {
        return {
          plan: makePlan({
            testOrModel: "Two-sample t-test (non-parametric alternative if assumptions violated)",
            effectMeasure: "Mean difference with 95% confidence interval",
            covariates: ["baseline value of outcome if available"],
            missingDataApproach: "Mixed models or multiple imputation depending on visit pattern.",
            estimand: "Difference in mean outcome between arms at specified time point",
            hypothesis: "Superiority of investigational arm over control",
          }),
        };
      }
      if (endpoint.type === "time-to-event") {
        return {
          plan: makePlan({
            testOrModel: "Log-rank test with Cox proportional hazards model",
            effectMeasure: "Hazard ratio with 95% confidence interval",
            covariates: ["stratification factors", "key prognostic covariates"],
            missingDataApproach: "Censor at last known follow-up; sensitivity analyses for informative censoring.",
            estimand: "Time-to-event difference between arms",
            hypothesis: "Superiority of investigational arm over control",
          }),
        };
      }
      break;
    }
    case "prospective-cohort":
    case "retrospective-cohort": {
      if (endpoint.type === "binary") {
        return {
          plan: makePlan({
            testOrModel: "Log-binomial or logistic regression (depending on convergence)",
            effectMeasure: "Risk ratio or odds ratio with 95% confidence interval",
            covariates: ["a priori confounders", "site or cluster if applicable"],
            missingDataApproach: "Complete case with sensitivity analyses using multiple imputation.",
            estimand: "Association between exposure and binary outcome",
            hypothesis: "Assess direction and magnitude of association",
          }),
        };
      }
      if (endpoint.type === "continuous") {
        return {
          plan: makePlan({
            testOrModel: "Linear regression with exposure and confounders",
            effectMeasure: "Adjusted mean difference with 95% confidence interval",
            covariates: ["pre-specified confounders"],
            missingDataApproach: "Multiple imputation if data are missing at random; otherwise sensitivity analyses.",
            estimand: "Difference in mean outcome by exposure status",
            hypothesis: "Assess association between exposure and continuous outcome",
          }),
        };
      }
      if (endpoint.type === "time-to-event") {
        return {
          plan: makePlan({
            testOrModel: "Cox proportional hazards model with Kaplan–Meier estimates",
            effectMeasure: "Hazard ratio with 95% confidence interval",
            covariates: ["key confounders"],
            missingDataApproach: "Censor at last follow-up; assess for informative censoring.",
            estimand: "Association between exposure and time-to-event",
            hypothesis: "Assess association magnitude",
          }),
        };
      }
      break;
    }
    case "cross-sectional": {
      if (endpoint.type === "binary") {
        return {
          plan: makePlan({
            testOrModel: "Estimate prevalence and compare proportions using chi-square / exact tests",
            effectMeasure: "Prevalence with 95% confidence interval",
            covariates: ["demographic or clinical factors if modelling"],
            missingDataApproach: "Report missingness and perform sensitivity analyses if >5% missing.",
            estimand: "Prevalence or proportion difference",
            hypothesis: "Describe prevalence / compare subgroups",
          }),
        };
      }
      if (endpoint.type === "continuous") {
        return {
          plan: makePlan({
            testOrModel: "Two-sample t-test / ANOVA or non-parametric equivalent",
            effectMeasure: "Mean difference with 95% confidence interval",
            covariates: ["key demographic factors"],
            missingDataApproach: "Report missingness; consider imputation for key variables.",
            estimand: "Difference in mean measurement across groups",
            hypothesis: "Describe distribution / compare subgroups",
          }),
        };
      }
      break;
    }
    case "single-arm": {
      return {
        plan: makePlan({
          testOrModel: "Binomial proportion with exact/Wilson 95% confidence interval",
          effectMeasure: "Response rate with 95% confidence interval",
          missingDataApproach: "Include only participants with outcome assessment; describe missingness.",
          estimand: "Response proportion in target population",
          hypothesis: "Estimate response proportion with specified precision",
        }),
      };
    }
    case "diagnostic-accuracy": {
      return {
        plan: makePlan({
          testOrModel: "Estimate sensitivity, specificity, predictive values, ROC curve",
          effectMeasure: "Sensitivity, specificity, predictive values with 95% confidence intervals",
          missingDataApproach: "Specify handling of indeterminate index test or missing reference standard.",
          estimand: "Accuracy metrics of index test versus reference standard",
          hypothesis: "Estimation of diagnostic accuracy",
        }),
      };
    }
    case "registry": {
      return {
        plan: makePlan({
          testOrModel: "Descriptive summaries with trend monitoring",
          effectMeasure: "Counts, proportions, medians with confidence intervals where relevant",
          missingDataApproach: "Track data completeness per site; implement data quality queries.",
          estimand: "Routine registry indicators over time",
          hypothesis: "Descriptive monitoring",
        }),
        warning: "Registry analyses are typically feasibility-driven; confirm objectives with PI.",
      };
    }
    case "case-control": {
      return {
        plan: makePlan({
          testOrModel: "Logistic regression adjusting for matching/stratification",
          effectMeasure: "Odds ratio with 95% confidence interval",
          covariates: ["matching factors", "key confounders"],
          missingDataApproach: "Perform complete-case analysis with sensitivity analyses.",
          estimand: "Association between exposure and odds of outcome",
          hypothesis: "Assess association magnitude",
        }),
      };
    }
    default:
      break;
  }

  return {
    plan: makePlan({
      testOrModel: "Method to be defined by statistician",
      notes: "Deterministic catalogue has no template for this combination; escalate to PI/statistician.",
    }),
    warning: `No deterministic SAP mapping for design ${designId} with endpoint type ${endpoint.type}.`,
  };
}

function buildEndpointPlans(
  studySpec: StudySpec,
  warnings: string[]
): SAPEndpointPlan[] {
  const endpoints: EndpointSpec[] = [];
  if (studySpec.primaryEndpoint) {
    endpoints.push({ ...studySpec.primaryEndpoint, role: "primary" });
  }
  for (const secondary of studySpec.secondaryEndpoints) {
    endpoints.push({ ...secondary, role: secondary.role ?? "secondary" });
  }

  if (endpoints.length === 0) {
    warnings.push("No endpoints defined; SAP is a placeholder draft.");
    return [];
  }

  return endpoints.map((endpoint) => {
    const { plan, warning } = mapTestOrModel(studySpec.designId, endpoint);
    if (warning) {
      warnings.push(warning);
    }
    if (plan.role === "primary" && studySpec.primaryEndpoint && endpoint.name === studySpec.primaryEndpoint.name) {
      plan.alphaAllocation = 0.05;
    }
    return plan;
  });
}

export function buildSAPPlan(studySpec: StudySpec, sampleSize: SampleSizeResult): SAPPlan {
  const warnings: string[] = [];

  if (!studySpec.designId) {
    warnings.push("Design not finalised; SAP entries are provisional.");
  }

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint missing; confirm before finalising SAP.");
  }

  if (sampleSize.status !== "ok") {
    warnings.push(
      "Sample size assumptions incomplete or unsupported; confirm calculations before locking SAP."
    );
  }

  const endpointPlans = buildEndpointPlans(studySpec, warnings);

  return {
    analysisSets: { ...DEFAULT_ANALYSIS_SETS },
    endpoints: endpointPlans,
    multiplicity:
      "Primary endpoint tested at two-sided alpha 0.05. Secondary endpoints exploratory unless alpha allocation specified.",
    interimAnalysis: "No formal interim analyses planned unless specified by PI/statistician.",
    subgroupAnalyses: "Exploratory subgroup analyses based on pre-specified demographic or clinical factors.",
    sensitivityAnalyses:
      "Perform sensitivity analyses for missing data assumptions, protocol deviations, and alternative model specifications.",
    missingDataGeneral:
      "Document missing data patterns. Apply multiple imputation or sensitivity analyses where material to conclusions.",
    software: "R / Python / SAS / Stata — final selection by responsible statistician.",
    warnings,
  };
}

export function generatePlainLanguageStatsExplanation(
  studySpec: StudySpec,
  sampleSize: SampleSizeResult,
  sap: SAPPlan
): StatsExplanation {
  if (sampleSize.status !== "ok") {
    return {
      sampleSizeSummary:
        "The system could not safely compute a sample size with the current information. Please provide complete assumptions or consult a statistician.",
      analysisSummary:
        "The draft SAP outlines default analytical approaches for the defined endpoints. These remain placeholders until a statistician confirms the design and methods.",
      assumptionSummary:
        "Key inputs such as event rates, effect size, or follow-up expectations are missing or inconsistent.",
      caveats: [
        "A qualified statistician must review assumptions, methods, and feasibility before any submission.",
        "No numerical sample size has been locked in this draft.",
      ],
    };
  }

  const methodLabel = sampleSize.methodId ? METHOD_LABELS[sampleSize.methodId] : undefined;
  const sampleSizeFragments: string[] = [];
  if (sampleSize.totalSampleSize) {
    sampleSizeFragments.push(`Total sample size ${sampleSize.totalSampleSize}`);
  }
  if (sampleSize.perGroupSampleSize) {
    sampleSizeFragments.push(`Per-group ${sampleSize.perGroupSampleSize}`);
  }
  if (sampleSize.eventsRequired) {
    sampleSizeFragments.push(`Events required ${sampleSize.eventsRequired}`);
  }

  const assumptions: string[] = [];
  if (typeof sampleSize.assumptions.expectedControlEventRate === "number") {
    assumptions.push(
      `Control event rate ${Math.round(sampleSize.assumptions.expectedControlEventRate * 100)}%`
    );
  }
  if (typeof sampleSize.assumptions.expectedTreatmentEventRate === "number") {
    assumptions.push(
      `Treatment event rate ${Math.round(sampleSize.assumptions.expectedTreatmentEventRate * 100)}%`
    );
  }
  if (typeof sampleSize.assumptions.expectedProportion === "number") {
    assumptions.push(
      `Expected proportion ${(sampleSize.assumptions.expectedProportion * 100).toFixed(1)}%`
    );
  }
  if (typeof sampleSize.assumptions.assumedSD === "number") {
    assumptions.push(`Assumed standard deviation ${sampleSize.assumptions.assumedSD}`);
  }
  if (typeof sampleSize.assumptions.precision === "number") {
    assumptions.push(`Precision target ±${sampleSize.assumptions.precision}`);
  }
  if (typeof sampleSize.assumptions.hazardRatio === "number") {
    assumptions.push(`Hazard ratio ${sampleSize.assumptions.hazardRatio}`);
  }
  if (typeof sampleSize.assumptions.eventProportionDuringFollowUp === "number") {
    assumptions.push(
      `Event proportion during follow-up ${(sampleSize.assumptions.eventProportionDuringFollowUp * 100).toFixed(1)}%`
    );
  }
  if (typeof sampleSize.assumptions.dropoutRate === "number") {
    assumptions.push(`Dropout allowance ${(sampleSize.assumptions.dropoutRate * 100).toFixed(1)}%`);
  }

  return {
    sampleSizeSummary: [
      methodLabel ? `${methodLabel} selected.` : undefined,
      sampleSizeFragments.length ? sampleSizeFragments.join(", ") : undefined,
      `Alpha ${sampleSize.assumptions.alpha}, power ${sampleSize.assumptions.power}.`,
    ]
      .filter(Boolean)
      .join(" "),
    analysisSummary:
      sap.endpoints.length > 0
        ? `Primary analysis uses ${sap.endpoints[0].testOrModel}. Secondary endpoints are exploratory unless multiplicity adjustments are defined.`
        : "No confirmed endpoints; SAP requires statistician input.",
    assumptionSummary: assumptions.length
      ? `Key assumptions: ${assumptions.join(", " )}.`
      : "Explicit effect size or event rate assumptions were not captured; confirm before submission.",
    caveats: [
      "If true rates or variances differ, actual power may change.",
      "A qualified statistician and the PI must review and approve these calculations before use.",
    ],
  };
}

