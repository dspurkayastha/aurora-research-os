import { ADVANCED_STUDY_DESIGNS, STUDY_DESIGNS } from "./rulebook";
import type {
  DiagnosticAccuracyAssumptions,
  SampleSizeAssumptionsBase,
  SampleSizeResult,
  StudySpec,
  TimeToEventAssumptions,
  TwoMeansAssumptions,
  TwoProportionsAssumptions,
  SingleProportionAssumptions
} from "./types";

const DEFAULT_CLUSTER_EFFECT = 1;

function cloneAssumptions<T extends SampleSizeAssumptionsBase>(assumptions: T): SampleSizeAssumptionsBase {
  return { ...assumptions };
}

function inverseStandardNormal(p: number): number {
  if (p <= 0 || p >= 1) {
    return Number.NaN;
  }

  const a = [
    -3.969683028665376e01,
    2.209460984245205e02,
    -2.759285104469687e02,
    1.383577518672690e02,
    -3.066479806614716e01,
    2.506628277459239e00
  ];
  const b = [
    -5.447609879822406e01,
    1.615858368580409e02,
    -1.556989798598866e02,
    6.680131188771972e01,
    -1.328068155288572e01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e00,
    -2.549732539343734e00,
    4.374664141464968e00,
    2.938163982698783e00
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e00,
    3.754408661907416e00
  ];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;

  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (phigh < p) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  q = p - 0.5;
  r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

export function zFromAlpha(alpha: number, twoSided: boolean): number {
  if (!(alpha > 0 && alpha < 0.5)) {
    return Number.NaN;
  }

  const knownTwoSided: Record<number, number> = {
    0.05: 1.96,
    0.01: 2.576
  };
  const knownOneSided: Record<number, number> = {
    0.05: 1.645,
    0.01: 2.326
  };

  if (twoSided && knownTwoSided[alpha]) {
    return knownTwoSided[alpha];
  }
  if (!twoSided && knownOneSided[alpha]) {
    return knownOneSided[alpha];
  }

  const tailProbability = twoSided ? 1 - alpha / 2 : 1 - alpha;
  return inverseStandardNormal(tailProbability);
}

export function zFromPower(power: number): number {
  if (!(power > 0.5 && power < 0.999)) {
    return Number.NaN;
  }
  return inverseStandardNormal(power);
}

function invalidResult(
  assumptions: SampleSizeAssumptionsBase,
  message: string
): SampleSizeResult {
  return {
    status: "invalid-input",
    assumptions: cloneAssumptions(assumptions),
    warnings: [message],
    notes: []
  };
}

function incompleteResult(
  assumptions: SampleSizeAssumptionsBase,
  message: string
): SampleSizeResult {
  return {
    status: "incomplete-input",
    assumptions: cloneAssumptions(assumptions),
    warnings: [message],
    notes: []
  };
}

function unsupportedResult(
  assumptions: SampleSizeAssumptionsBase,
  message: string
): SampleSizeResult {
  return {
    status: "unsupported-design",
    assumptions: cloneAssumptions(assumptions),
    warnings: [message],
    notes: []
  };
}

function applyDesignEffectAdjustments(
  n: number,
  assumptions: SampleSizeAssumptionsBase,
  notes: string[],
  warnings: string[]
): number {
  let adjusted = n;

  if (typeof assumptions.dropoutRate === "number") {
    if (assumptions.dropoutRate <= 0 || assumptions.dropoutRate >= 1) {
      warnings.push("Dropout rate must be between 0 and 1 (exclusive). Ignored.");
    } else {
      adjusted = adjusted / (1 - assumptions.dropoutRate);
      notes.push(`Adjusted for anticipated dropout of ${(assumptions.dropoutRate * 100).toFixed(1)}%.`);
    }
  }

  if (typeof assumptions.clusterDesignEffect === "number") {
    if (assumptions.clusterDesignEffect <= 0) {
      warnings.push("Cluster design effect must be greater than 0. Ignored.");
    } else if (assumptions.clusterDesignEffect !== DEFAULT_CLUSTER_EFFECT) {
      adjusted *= assumptions.clusterDesignEffect;
      notes.push(
        `Adjusted for cluster design effect of ${assumptions.clusterDesignEffect.toFixed(2)}.`
      );
    }
  }

  return adjusted;
}

export function computeTwoProportionsSampleSize(
  assumptions: TwoProportionsAssumptions
): SampleSizeResult {
  if (assumptions.hypothesisType !== "superiority") {
    return unsupportedResult(
      assumptions,
      "Two-proportion calculations currently support superiority hypotheses only."
    );
  }

  const { expectedControlEventRate: p1, expectedTreatmentEventRate: p2 } = assumptions;

  if (p1 == null || p2 == null) {
    return incompleteResult(
      assumptions,
      "Control and intervention event rates are required."
    );
  }

  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1)) {
    return invalidResult(assumptions, "Event rates must be between 0 and 1.");
  }

  if (Math.abs(p1 - p2) < 1e-9) {
    return invalidResult(assumptions, "Event rates must differ to compute sample size.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p1 - p2, 2);
  const rawPerGroup = numerator / denominator;

  const notes: string[] = [];
  const warnings: string[] = [];
  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: "two-proportions",
    description: "Two-sample comparison of proportions (superiority)",
    perGroupSampleSize: perGroup,
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

export function computeTwoMeansSampleSize(assumptions: TwoMeansAssumptions): SampleSizeResult {
  if (assumptions.hypothesisType !== "superiority") {
    return unsupportedResult(
      assumptions,
      "Two-means calculations currently support superiority hypotheses only."
    );
  }

  if (!(typeof assumptions.assumedSD === "number" && assumptions.assumedSD > 0)) {
    return invalidResult(assumptions, "Standard deviation must be a positive number.");
  }

  if (
    !(typeof assumptions.expectedMeanControl === "number") ||
    !(typeof assumptions.expectedMeanTreatment === "number")
  ) {
    return incompleteResult(assumptions, "Both mean estimates are required.");
  }

  const delta = Math.abs(assumptions.expectedMeanTreatment - assumptions.expectedMeanControl);
  if (delta <= 0) {
    return invalidResult(assumptions, "Means must differ to compute sample size.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const rawPerGroup =
    (2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(assumptions.assumedSD, 2)) /
    Math.pow(delta, 2);

  const notes: string[] = [];
  const warnings: string[] = [];
  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: "two-means",
    description: "Two-sample comparison of means (superiority)",
    perGroupSampleSize: perGroup,
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

export function computeSingleProportionPrecisionSampleSize(
  assumptions: SingleProportionAssumptions
): SampleSizeResult {
  if (assumptions.hypothesisType !== "estimation") {
    return unsupportedResult(
      assumptions,
      "Single proportion precision calculations require estimation hypothesis type."
    );
  }

  const p = assumptions.expectedProportion;
  const d = assumptions.precision;

  if (!(p > 0 && p < 1)) {
    return invalidResult(assumptions, "Expected proportion must be between 0 and 1.");
  }

  if (!(d > 0)) {
    return invalidResult(assumptions, "Desired precision (half-width) must be positive.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  if (!Number.isFinite(zAlpha)) {
    return invalidResult(assumptions, "Alpha input is outside supported ranges.");
  }

  const rawN = (Math.pow(zAlpha, 2) * p * (1 - p)) / Math.pow(d, 2);
  const notes: string[] = [];
  const warnings: string[] = [];
  const adjustedN = applyDesignEffectAdjustments(rawN, assumptions, notes, warnings);
  const total = Math.ceil(adjustedN);

  return {
    status: "ok",
    methodId: "single-proportion-precision",
    description: "Single proportion precision target",
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

export function computeTimeToEventLogrankSampleSize(
  assumptions: TimeToEventAssumptions
): SampleSizeResult {
  if (assumptions.hypothesisType !== "superiority") {
    return unsupportedResult(
      assumptions,
      "Time-to-event calculations currently support superiority hypotheses only."
    );
  }

  const hr = assumptions.hazardRatio;

  if (!(typeof hr === "number" && hr > 0 && hr !== 1)) {
    return invalidResult(assumptions, "Hazard ratio must be positive and not equal to 1.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);
  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const eventsRequired = Math.pow(zAlpha + zBeta, 2) / Math.pow(Math.log(hr), 2);

  if (typeof assumptions.eventProportionDuringFollowUp !== "number") {
    return incompleteResult(
      assumptions,
      "Event proportion during follow-up is required to translate events into total sample size."
    );
  }

  const eventProportion = assumptions.eventProportionDuringFollowUp;

  if (!(eventProportion > 0 && eventProportion <= 1)) {
    return invalidResult(
      assumptions,
      "Event proportion during follow-up must be between 0 and 1 (inclusive)."
    );
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  let total = eventsRequired / eventProportion;
  total = applyDesignEffectAdjustments(total, assumptions, notes, warnings);
  const roundedEvents = Math.ceil(eventsRequired);
  const roundedTotal = Math.ceil(total);

  return {
    status: "ok",
    methodId: "time-to-event-logrank",
    description: "Log-rank test power for time-to-event endpoint",
    eventsRequired: roundedEvents,
    totalSampleSize: roundedTotal,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

export function computeDiagnosticAccuracySampleSize(
  assumptions: DiagnosticAccuracyAssumptions
): SampleSizeResult {
  if (assumptions.hypothesisType !== "estimation") {
    return unsupportedResult(
      assumptions,
      "Diagnostic accuracy calculations require estimation hypothesis type."
    );
  }

  const d = assumptions.precision;
  if (!(d > 0)) {
    return invalidResult(assumptions, "Desired precision (half-width) must be positive.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  if (!Number.isFinite(zAlpha)) {
    return invalidResult(assumptions, "Alpha input is outside supported ranges.");
  }

  const metrics: { label: string; probability?: number }[] = [];

  if (assumptions.targetMetric === "sensitivity" || assumptions.targetMetric === "both") {
    metrics.push({ label: "sensitivity", probability: assumptions.expectedSensitivity });
  }
  if (assumptions.targetMetric === "specificity" || assumptions.targetMetric === "both") {
    metrics.push({ label: "specificity", probability: assumptions.expectedSpecificity });
  }

  if (metrics.length === 0) {
    return incompleteResult(
      assumptions,
      "Specify whether sensitivity, specificity, or both should be estimated."
    );
  }

  const warnings: string[] = [];
  const notes: string[] = [];
  let required = 0;

  for (const metric of metrics) {
    if (!(typeof metric.probability === "number") || !(metric.probability > 0 && metric.probability < 1)) {
      return invalidResult(
        assumptions,
        `Expected ${metric.label} must be a probability between 0 and 1.`
      );
    }
    const n = (Math.pow(zAlpha, 2) * metric.probability * (1 - metric.probability)) / Math.pow(d, 2);
    required = Math.max(required, n);
  }

  const adjusted = applyDesignEffectAdjustments(required, assumptions, notes, warnings);
  const total = Math.ceil(adjusted);

  return {
    status: "ok",
    methodId: "diagnostic-accuracy",
    description: "Precision for diagnostic accuracy metric",
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

function ensureDesignAlignment(
  studySpec: StudySpec,
  assumptions: SampleSizeAssumptionsBase,
  warnings: string[]
) {
  if (studySpec.designId !== assumptions.designId) {
    warnings.push("Assumptions designId does not match the study specification design.");
  }
  if (
    studySpec.primaryEndpoint &&
    studySpec.primaryEndpoint.type !== assumptions.primaryEndpointType
  ) {
    warnings.push("Primary endpoint type in assumptions does not match study specification.");
  }
}

function isAdvancedDesign(designId: string): boolean {
  return ADVANCED_STUDY_DESIGNS.some((design) => design.id === designId);
}

function rulebookDesignLabel(designId: string): string | undefined {
  return STUDY_DESIGNS.find((design) => design.id === designId)?.label;
}

export function computeSampleSizeForStudy(
  studySpec: StudySpec,
  assumptions: SampleSizeAssumptionsBase
): SampleSizeResult {
  if (!studySpec.designId) {
    return incompleteResult(
      assumptions,
      "Study design is required before sample size calculations."
    );
  }

  if (!studySpec.primaryEndpoint) {
    return incompleteResult(
      assumptions,
      "Primary endpoint is required before sample size calculations."
    );
  }

  if (isAdvancedDesign(studySpec.designId)) {
    return unsupportedResult(
      assumptions,
      "Advanced designs are not supported in this automation step."
    );
  }

  const routingWarnings: string[] = [];
  ensureDesignAlignment(studySpec, assumptions, routingWarnings);

  const endpointType = studySpec.primaryEndpoint.type;
  const designId = studySpec.designId;

  let result: SampleSizeResult | null = null;

  const needsSingleProportion = () =>
    typeof assumptions.expectedProportion === "number" &&
    typeof assumptions.precision === "number";

  switch (designId) {
    case "rct-2arm-parallel": {
      if (endpointType === "binary") {
        result = computeTwoProportionsSampleSize(assumptions as TwoProportionsAssumptions);
      } else if (endpointType === "continuous") {
        result = computeTwoMeansSampleSize(assumptions as TwoMeansAssumptions);
      } else if (endpointType === "time-to-event") {
        result = computeTimeToEventLogrankSampleSize(assumptions as TimeToEventAssumptions);
      }
      break;
    }
    case "prospective-cohort":
    case "retrospective-cohort": {
      if (endpointType === "binary") {
        result = computeTwoProportionsSampleSize(assumptions as TwoProportionsAssumptions);
      } else if (endpointType === "continuous") {
        result = computeTwoMeansSampleSize(assumptions as TwoMeansAssumptions);
      } else if (endpointType === "time-to-event") {
        result = computeTimeToEventLogrankSampleSize(assumptions as TimeToEventAssumptions);
      }
      break;
    }
    case "cross-sectional": {
      let handled = false;
      if (
        endpointType === "binary" &&
        assumptions.expectedControlEventRate != null &&
        assumptions.expectedTreatmentEventRate != null
      ) {
        result = computeTwoProportionsSampleSize(assumptions as TwoProportionsAssumptions);
        handled = true;
      } else if (
        endpointType === "continuous" &&
        assumptions.expectedMeanControl != null &&
        assumptions.expectedMeanTreatment != null
      ) {
        result = computeTwoMeansSampleSize(assumptions as TwoMeansAssumptions);
        handled = true;
      } else if (needsSingleProportion()) {
        result = computeSingleProportionPrecisionSampleSize(
          assumptions as SingleProportionAssumptions
        );
        handled = true;
      }
      if (!handled) {
        return incompleteResult(
          assumptions,
          "Cross-sectional designs require group parameters or a prevalence with precision target."
        );
      }
      break;
    }
    case "single-arm": {
      if (needsSingleProportion()) {
        result = computeSingleProportionPrecisionSampleSize(
          assumptions as SingleProportionAssumptions
        );
      } else {
        return incompleteResult(
          assumptions,
          "Single-arm designs require expected response proportion and desired precision."
        );
      }
      break;
    }
    case "diagnostic-accuracy": {
      result = computeDiagnosticAccuracySampleSize(assumptions as DiagnosticAccuracyAssumptions);
      break;
    }
    case "registry": {
      if (needsSingleProportion()) {
        result = computeSingleProportionPrecisionSampleSize(assumptions as SingleProportionAssumptions);
      } else {
        return incompleteResult(
          assumptions,
          "Registry sample size is typically feasibility-driven and not auto-calculated without a key proportion."
        );
      }
      break;
    }
    case "case-control": {
      return unsupportedResult(
        assumptions,
        "Automated case-control sample size not implemented; consult a statistician."
      );
    }
    default: {
      return unsupportedResult(assumptions, `No sample size support configured for design ${designId}.`);
    }
  }

  if (!result) {
    return unsupportedResult(
      assumptions,
      `No supported sample size method mapped for design ${rulebookDesignLabel(designId) ?? designId} with primary endpoint type ${endpointType}.`
    );
  }

  if (routingWarnings.length > 0) {
    result.warnings.push(...routingWarnings);
  }

  return result;
}
