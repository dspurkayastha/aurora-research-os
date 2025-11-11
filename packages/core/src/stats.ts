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

/**
 * Calculate inflation factor for group sequential designs
 * Based on alpha spending functions: O'Brien-Fleming, Pocock, Lan-DeMets
 */
function getSequentialInflationFactor(
  numberOfInterimAnalyses: number,
  alphaSpendingFunction: "obrien-fleming" | "pocock" | "lan-deMets"
): number {
  if (numberOfInterimAnalyses <= 0) {
    return 1.0;
  }

  // Inflation factors are approximate and depend on the alpha spending function
  // These are conservative estimates based on common practice
  const k = numberOfInterimAnalyses + 1; // k = number of analyses (interim + final)

  switch (alphaSpendingFunction) {
    case "obrien-fleming":
      // O'Brien-Fleming: More conservative early, less inflation needed
      // Approximate inflation factor: 1 + 0.01 * (k - 1)
      return 1 + 0.01 * (k - 1);
    
    case "pocock":
      // Pocock: Equal alpha at each analysis, more inflation needed
      // Approximate inflation factor: 1 + 0.05 * (k - 1)
      return 1 + 0.05 * (k - 1);
    
    case "lan-deMets":
      // Lan-DeMets: Flexible alpha spending, intermediate inflation
      // Approximate inflation factor: 1 + 0.03 * (k - 1)
      return 1 + 0.03 * (k - 1);
    
    default:
      return 1.0;
  }
}

function applyDesignEffectAdjustments(
  n: number,
  assumptions: SampleSizeAssumptionsBase,
  notes: string[],
  warnings: string[]
): number {
  let adjusted = n;

  // Sequential/group sequential design adjustment
  if (typeof assumptions.numberOfInterimAnalyses === "number" && assumptions.numberOfInterimAnalyses > 0) {
    const spendingFunction = assumptions.alphaSpendingFunction || "obrien-fleming";
    const inflationFactor = getSequentialInflationFactor(
      assumptions.numberOfInterimAnalyses,
      spendingFunction
    );
    adjusted *= inflationFactor;
    notes.push(
      `Adjusted for ${assumptions.numberOfInterimAnalyses} interim analysis(es) using ${spendingFunction} alpha spending function ` +
      `(inflation factor: ${inflationFactor.toFixed(3)}).`
    );
  }

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

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  let rawPerGroup: number;
  let description: string;

  if (assumptions.hypothesisType === "noninferiority") {
    if (typeof assumptions.nonInferiorityMargin !== "number" || assumptions.nonInferiorityMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Non-inferiority margin (delta) is required and must be positive."
      );
    }
    const delta = assumptions.nonInferiorityMargin;
    
    // Non-inferiority: H0: p2 - p1 <= -delta vs H1: p2 - p1 > -delta
    // Using Farrington-Manning method for non-inferiority
    // Sample size formula: n = (z_alpha + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (p1 - p2 + delta)^2
    // For non-inferiority, we test if treatment is not worse than control by more than delta
    const effectSize = p1 - p2 + delta; // Expected difference under alternative
    if (effectSize <= 0) {
      return invalidResult(
        assumptions,
        `Non-inferiority margin (${delta}) must be less than the expected control rate minus treatment rate (${p1 - p2}).`
      );
    }
    
    rawPerGroup = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / Math.pow(effectSize, 2);
    description = `Two-sample comparison of proportions (non-inferiority, margin=${delta})`;
    notes.push(`Non-inferiority margin: ${delta} (absolute difference)`);
  } else if (assumptions.hypothesisType === "equivalence") {
    if (typeof assumptions.equivalenceMargin !== "number" || assumptions.equivalenceMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Equivalence margin is required and must be positive."
      );
    }
    const delta = assumptions.equivalenceMargin;
    
    // Equivalence (TOST): Test both H0: p2 - p1 <= -delta and H0: p2 - p1 >= delta
    // Use two one-sided tests, each at alpha/2
    const zAlphaEquiv = zFromAlpha(assumptions.alpha / 2, false); // One-sided for each test
    const effectSize = Math.abs(p1 - p2);
    
    if (effectSize >= delta) {
      warnings.push(
        `Expected difference (${effectSize.toFixed(4)}) exceeds equivalence margin (${delta}). ` +
        `Equivalence may not be achievable with these assumptions.`
      );
    }
    
    // Sample size for equivalence is larger than for non-inferiority
    // Formula: n = (z_alpha/2 + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (delta - |p1-p2|)^2
    const denominator = Math.pow(delta - effectSize, 2);
    if (denominator <= 0) {
      return invalidResult(
        assumptions,
        `Equivalence margin (${delta}) must be greater than the absolute difference between rates (${effectSize}).`
      );
    }
    
    rawPerGroup = Math.pow(zAlphaEquiv + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / denominator;
    description = `Two-sample comparison of proportions (equivalence, margin=±${delta})`;
    notes.push(`Equivalence margin: ±${delta} (two one-sided tests)`);
  } else if (assumptions.hypothesisType === "superiority") {
    if (Math.abs(p1 - p2) < 1e-9) {
      return invalidResult(assumptions, "Event rates must differ to compute sample size.");
    }
    const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
    const denominator = Math.pow(p1 - p2, 2);
    rawPerGroup = numerator / denominator;
    description = "Two-sample comparison of proportions (superiority)";
  } else {
    return unsupportedResult(
      assumptions,
      `Hypothesis type "${assumptions.hypothesisType}" not yet supported for two-proportion calculations.`
    );
  }

  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: assumptions.hypothesisType === "noninferiority" ? "noninferiority-proportions" : 
              assumptions.hypothesisType === "equivalence" ? "equivalence-proportions" : "two-proportions",
    description,
    perGroupSampleSize: perGroup,
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

export function computeTwoMeansSampleSize(assumptions: TwoMeansAssumptions): SampleSizeResult {
  if (!(typeof assumptions.assumedSD === "number" && assumptions.assumedSD > 0)) {
    return invalidResult(assumptions, "Standard deviation must be a positive number.");
  }

  if (
    !(typeof assumptions.expectedMeanControl === "number") ||
    !(typeof assumptions.expectedMeanTreatment === "number")
  ) {
    return incompleteResult(assumptions, "Both mean estimates are required.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  let rawPerGroup: number;
  let description: string;

  if (assumptions.hypothesisType === "noninferiority") {
    if (typeof assumptions.nonInferiorityMargin !== "number" || assumptions.nonInferiorityMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Non-inferiority margin (delta) is required and must be positive."
      );
    }
    const delta = assumptions.nonInferiorityMargin;
    const meanDiff = assumptions.expectedMeanTreatment - assumptions.expectedMeanControl;
    
    // Non-inferiority: H0: mu2 - mu1 <= -delta vs H1: mu2 - mu1 > -delta
    // Sample size: n = 2 * (z_alpha + z_beta)^2 * sigma^2 / (meanDiff + delta)^2
    const effectSize = meanDiff + delta;
    if (effectSize <= 0) {
      return invalidResult(
        assumptions,
        `Non-inferiority margin (${delta}) must be less than treatment mean minus control mean (${meanDiff}).`
      );
    }
    
    rawPerGroup = (2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(assumptions.assumedSD, 2)) / Math.pow(effectSize, 2);
    description = `Two-sample comparison of means (non-inferiority, margin=${delta})`;
    notes.push(`Non-inferiority margin: ${delta} (absolute difference in means)`);
  } else if (assumptions.hypothesisType === "equivalence") {
    if (typeof assumptions.equivalenceMargin !== "number" || assumptions.equivalenceMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Equivalence margin is required and must be positive."
      );
    }
    const delta = assumptions.equivalenceMargin;
    const meanDiff = Math.abs(assumptions.expectedMeanTreatment - assumptions.expectedMeanControl);
    
    if (meanDiff >= delta) {
      warnings.push(
        `Expected difference (${meanDiff.toFixed(4)}) exceeds equivalence margin (${delta}). ` +
        `Equivalence may not be achievable with these assumptions.`
      );
    }
    
    // Equivalence (TOST): Each test at alpha/2
    const zAlphaEquiv = zFromAlpha(assumptions.alpha / 2, false);
    const denominator = Math.pow(delta - meanDiff, 2);
    
    if (denominator <= 0) {
      return invalidResult(
        assumptions,
        `Equivalence margin (${delta}) must be greater than the absolute difference between means (${meanDiff}).`
      );
    }
    
    rawPerGroup = (2 * Math.pow(zAlphaEquiv + zBeta, 2) * Math.pow(assumptions.assumedSD, 2)) / denominator;
    description = `Two-sample comparison of means (equivalence, margin=±${delta})`;
    notes.push(`Equivalence margin: ±${delta} (two one-sided tests)`);
  } else if (assumptions.hypothesisType === "superiority") {
    const delta = Math.abs(assumptions.expectedMeanTreatment - assumptions.expectedMeanControl);
    if (delta <= 0) {
      return invalidResult(assumptions, "Means must differ to compute sample size.");
    }
    rawPerGroup =
      (2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(assumptions.assumedSD, 2)) /
      Math.pow(delta, 2);
    description = "Two-sample comparison of means (superiority)";
  } else {
    return unsupportedResult(
      assumptions,
      `Hypothesis type "${assumptions.hypothesisType}" not yet supported for two-means calculations.`
    );
  }

  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: assumptions.hypothesisType === "noninferiority" ? "noninferiority-means" : 
              assumptions.hypothesisType === "equivalence" ? "equivalence-means" : "two-means",
    description,
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
  const hr = assumptions.hazardRatio;

  if (!(typeof hr === "number" && hr > 0)) {
    return invalidResult(assumptions, "Hazard ratio must be positive.");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);
  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  let eventsRequired: number;
  let description: string;

  if (assumptions.hypothesisType === "noninferiority") {
    if (typeof assumptions.nonInferiorityMargin !== "number" || assumptions.nonInferiorityMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Non-inferiority margin (on log HR scale) is required and must be positive."
      );
    }
    const deltaLogHR = assumptions.nonInferiorityMargin; // Margin on log hazard ratio scale
    
    // Non-inferiority: H0: log(HR) >= deltaLogHR vs H1: log(HR) < deltaLogHR
    // For non-inferiority, we want to show treatment is not worse than control
    // Expected log HR under alternative: log(hr) - deltaLogHR
    const logHR = Math.log(hr);
    const effectSize = Math.abs(logHR - deltaLogHR);
    
    if (effectSize <= 0) {
      return invalidResult(
        assumptions,
        `Non-inferiority margin (${deltaLogHR}) on log HR scale must be less than |log(HR)| (${Math.abs(logHR)}).`
      );
    }
    
    eventsRequired = Math.pow(zAlpha + zBeta, 2) / Math.pow(effectSize, 2);
    description = `Log-rank test for time-to-event (non-inferiority, margin=${deltaLogHR} on log HR scale)`;
    notes.push(`Non-inferiority margin: ${deltaLogHR} (on log hazard ratio scale)`);
    notes.push(`This corresponds to HR margin of ${Math.exp(deltaLogHR).toFixed(4)}`);
  } else if (assumptions.hypothesisType === "equivalence") {
    if (typeof assumptions.equivalenceMargin !== "number" || assumptions.equivalenceMargin <= 0) {
      return incompleteResult(
        assumptions,
        "Equivalence margin (on log HR scale) is required and must be positive."
      );
    }
    const deltaLogHR = assumptions.equivalenceMargin;
    const logHR = Math.abs(Math.log(hr));
    
    if (logHR >= deltaLogHR) {
      warnings.push(
        `Expected |log(HR)| (${logHR.toFixed(4)}) exceeds equivalence margin (${deltaLogHR}). ` +
        `Equivalence may not be achievable with these assumptions.`
      );
    }
    
    // Equivalence (TOST): Each test at alpha/2
    const zAlphaEquiv = zFromAlpha(assumptions.alpha / 2, false);
    const denominator = Math.pow(deltaLogHR - logHR, 2);
    
    if (denominator <= 0) {
      return invalidResult(
        assumptions,
        `Equivalence margin (${deltaLogHR}) must be greater than |log(HR)| (${logHR}).`
      );
    }
    
    eventsRequired = Math.pow(zAlphaEquiv + zBeta, 2) / denominator;
    description = `Log-rank test for time-to-event (equivalence, margin=±${deltaLogHR} on log HR scale)`;
    notes.push(`Equivalence margin: ±${deltaLogHR} (on log hazard ratio scale, two one-sided tests)`);
    notes.push(`This corresponds to HR margin of ${Math.exp(deltaLogHR).toFixed(4)}`);
  } else if (assumptions.hypothesisType === "superiority") {
    if (hr === 1) {
      return invalidResult(assumptions, "Hazard ratio must not equal 1 for superiority test.");
    }
    eventsRequired = Math.pow(zAlpha + zBeta, 2) / Math.pow(Math.log(hr), 2);
    description = "Log-rank test power for time-to-event endpoint (superiority)";
  } else {
    return unsupportedResult(
      assumptions,
      `Hypothesis type "${assumptions.hypothesisType}" not yet supported for time-to-event calculations.`
    );
  }

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

  let total = eventsRequired / eventProportion;
  total = applyDesignEffectAdjustments(total, assumptions, notes, warnings);
  const roundedEvents = Math.ceil(eventsRequired);
  const roundedTotal = Math.ceil(total);

  return {
    status: "ok",
    methodId: assumptions.hypothesisType === "noninferiority" ? "noninferiority-time-to-event" : 
              assumptions.hypothesisType === "equivalence" ? "equivalence-time-to-event" : "time-to-event-logrank",
    description,
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

/**
 * Compute sample size for linear mixed model (LMM) with repeated measures
 * Accounts for within-subject correlation and between-subject variability
 */
export function computeMixedModelSampleSize(
  assumptions: TwoMeansAssumptions
): SampleSizeResult {
  if (!(typeof assumptions.assumedSD === "number" && assumptions.assumedSD > 0)) {
    return invalidResult(assumptions, "Standard deviation must be a positive number.");
  }

  if (
    !(typeof assumptions.expectedMeanControl === "number") ||
    !(typeof assumptions.expectedMeanTreatment === "number")
  ) {
    return incompleteResult(assumptions, "Both mean estimates are required.");
  }

  const numberOfRepeatedMeasures = assumptions.numberOfRepeatedMeasures || 1;
  const icc = assumptions.intraclassCorrelation || 0.5; // Default ICC if not specified

  if (icc < 0 || icc >= 1) {
    return invalidResult(assumptions, "Intraclass correlation must be between 0 and 1 (exclusive).");
  }

  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const delta = Math.abs(assumptions.expectedMeanTreatment - assumptions.expectedMeanControl);
  if (delta <= 0) {
    return invalidResult(assumptions, "Means must differ to compute sample size.");
  }

  // LMM sample size formula accounting for repeated measures and ICC
  // Effective variance = sigma^2 * (1 + (m-1)*ICC) / m
  // where m = number of repeated measures
  const effectiveVariance = Math.pow(assumptions.assumedSD, 2) * (1 + (numberOfRepeatedMeasures - 1) * icc) / numberOfRepeatedMeasures;
  
  const rawPerGroup = (2 * Math.pow(zAlpha + zBeta, 2) * effectiveVariance) / Math.pow(delta, 2);

  const notes: string[] = [];
  const warnings: string[] = [];
  notes.push(`Linear mixed model with ${numberOfRepeatedMeasures} repeated measure(s) per subject`);
  notes.push(`Intraclass correlation (ICC): ${icc.toFixed(3)}`);
  
  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: "mixed-model-lmm",
    description: `Linear mixed model with repeated measures (${numberOfRepeatedMeasures} per subject)`,
    perGroupSampleSize: perGroup,
    totalSampleSize: total,
    assumptions: cloneAssumptions(assumptions),
    warnings,
    notes
  };
}

/**
 * Compute sample size for Bayesian analysis
 * Uses prior information to potentially reduce sample size requirements
 */
export function computeBayesianSampleSize(
  assumptions: TwoMeansAssumptions | TwoProportionsAssumptions
): SampleSizeResult {
  const zAlpha = zFromAlpha(assumptions.alpha, assumptions.twoSided);
  const zBeta = zFromPower(assumptions.power);

  if (!Number.isFinite(zAlpha) || !Number.isFinite(zBeta)) {
    return invalidResult(assumptions, "Alpha or power inputs are outside supported ranges.");
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  
  // Bayesian sample size calculation incorporates prior information
  // If prior is informative, sample size may be reduced
  // If prior is vague/uninformative, sample size approaches frequentist
  const priorVariance = assumptions.priorVariance || Infinity; // Default to uninformative
  
  let rawPerGroup: number;
  let description: string;

  if ("expectedMeanControl" in assumptions && "expectedMeanTreatment" in assumptions && "assumedSD" in assumptions) {
    // Bayesian for means
    const meanAssumptions = assumptions as TwoMeansAssumptions;
    if (typeof meanAssumptions.expectedMeanControl !== "number" || typeof meanAssumptions.expectedMeanTreatment !== "number" || typeof meanAssumptions.assumedSD !== "number") {
      return incompleteResult(assumptions, "Both mean estimates and standard deviation are required.");
    }
    
    const delta = Math.abs(meanAssumptions.expectedMeanTreatment - meanAssumptions.expectedMeanControl);
    if (delta <= 0) {
      return invalidResult(assumptions, "Means must differ to compute sample size.");
    }

    // Bayesian sample size with prior: n = 2 * (z_alpha + z_beta)^2 * (sigma^2 + prior_variance) / delta^2
    // If prior is informative (small variance), sample size is reduced
    const effectiveVariance = Math.pow(meanAssumptions.assumedSD, 2) + (priorVariance === Infinity ? 0 : priorVariance);
    rawPerGroup = (2 * Math.pow(zAlpha + zBeta, 2) * effectiveVariance) / Math.pow(delta, 2);
    description = "Bayesian sample size for two-sample comparison of means";
    
    if (priorVariance !== Infinity) {
      notes.push(`Informative prior variance: ${priorVariance.toFixed(4)}`);
      notes.push("Prior information may reduce required sample size compared to frequentist approach");
    } else {
      notes.push("Uninformative prior (approximates frequentist sample size)");
    }
  } else if ("expectedControlEventRate" in assumptions && "expectedTreatmentEventRate" in assumptions) {
    // Bayesian for proportions
    const p1 = assumptions.expectedControlEventRate;
    const p2 = assumptions.expectedTreatmentEventRate;
    
    if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1)) {
      return invalidResult(assumptions, "Event rates must be between 0 and 1.");
    }

    // Bayesian sample size for proportions (approximate)
    // Uses beta prior, approximated by normal
    const pooledVariance = (p1 * (1 - p1) + p2 * (1 - p2)) / 2;
    const effectiveVariance = pooledVariance + (priorVariance === Infinity ? 0 : priorVariance);
    const delta = Math.abs(p1 - p2);
    
    if (delta <= 0) {
      return invalidResult(assumptions, "Event rates must differ to compute sample size.");
    }
    
    rawPerGroup = Math.pow(zAlpha + zBeta, 2) * effectiveVariance / Math.pow(delta, 2);
    description = "Bayesian sample size for two-sample comparison of proportions";
    
    if (priorVariance !== Infinity) {
      notes.push(`Informative prior variance: ${priorVariance.toFixed(4)}`);
      notes.push("Prior information may reduce required sample size compared to frequentist approach");
    } else {
      notes.push("Uninformative prior (approximates frequentist sample size)");
    }
  } else {
    return incompleteResult(assumptions, "Bayesian calculations require either means or proportions assumptions.");
  }

  const adjustedPerGroup = applyDesignEffectAdjustments(rawPerGroup, assumptions, notes, warnings);
  const perGroup = Math.ceil(adjustedPerGroup);
  const total = perGroup * 2;

  return {
    status: "ok",
    methodId: "bayesian",
    description,
    perGroupSampleSize: perGroup,
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
