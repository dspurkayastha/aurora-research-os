import test from "node:test";
import assert from "node:assert/strict";

import {
  AURORA_RULEBOOK,
  buildSAPPlan,
  computeSampleSizeForStudy,
  generatePlainLanguageStatsExplanation
} from "../src";
import type { SampleSizeAssumptionsBase, StudySpec } from "../src";

const baseStudySpec: StudySpec = {
  title: "Study on outcomes in target population",
  designId: "rct-2arm-parallel",
  designLabel: "RCT – 2 Arm Parallel",
  regulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
  condition: "Condition X",
  populationDescription: "Adults",
  setting: "Tertiary hospital",
  primaryEndpoint: {
    name: "30-day mortality",
    type: "binary",
    role: "primary",
    timeframe: "30-day"
  },
  secondaryEndpoints: [],
  isAdvancedDesign: false,
  notes: [],
  source: { fromRulebookVersion: AURORA_RULEBOOK.version }
};

const baseAssumptions: SampleSizeAssumptionsBase = {
  alpha: 0.05,
  power: 0.8,
  twoSided: true,
  hypothesisType: "superiority",
  designId: "rct-2arm-parallel",
  primaryEndpointType: "binary",
  expectedControlEventRate: 0.3,
  expectedTreatmentEventRate: 0.18
};

test("computeSampleSizeForStudy returns ok for supported RCT binary endpoint", () => {
  const result = computeSampleSizeForStudy(baseStudySpec, baseAssumptions);
  assert.equal(result.status, "ok");
  assert.ok(result.totalSampleSize && result.totalSampleSize > 0);
  assert.ok(result.perGroupSampleSize && result.perGroupSampleSize > 0);
});

test("computeSampleSizeForStudy flags incomplete input when effect size missing", () => {
  const result = computeSampleSizeForStudy(baseStudySpec, {
    ...baseAssumptions,
    expectedTreatmentEventRate: undefined
  });
  assert.equal(result.status, "incomplete-input");
});

test("registry design without key proportion returns incomplete", () => {
  const registrySpec: StudySpec = {
    ...baseStudySpec,
    designId: "registry",
    designLabel: "Registry",
    isAdvancedDesign: false
  };

  const result = computeSampleSizeForStudy(registrySpec, {
    ...baseAssumptions,
    designId: "registry",
    primaryEndpointType: "binary"
  });

  assert.equal(result.status, "incomplete-input");
  assert.ok(result.warnings.some((warning) => warning.includes("Registry")));
});

test("advanced designs are marked unsupported", () => {
  const advancedConfig = AURORA_RULEBOOK.advancedStudyDesigns[0];
  const advancedSpec: StudySpec = {
    ...baseStudySpec,
    designId: advancedConfig.id,
    designLabel: advancedConfig.label,
    isAdvancedDesign: true
  };

  const result = computeSampleSizeForStudy(advancedSpec, {
    ...baseAssumptions,
    designId: advancedConfig.id
  });

  assert.equal(result.status, "unsupported-design");
});

test("SAP plan and explanation align with sample size outputs", () => {
  const sampleSizeResult = computeSampleSizeForStudy(baseStudySpec, baseAssumptions);
  const plan = buildSAPPlan(baseStudySpec, sampleSizeResult);
  const explanation = generatePlainLanguageStatsExplanation(baseStudySpec, sampleSizeResult, plan);

  assert.ok(plan.steps.length > 0);
  assert.ok(plan.steps[0].label.includes("Primary analysis"));
  assert.ok(explanation.sampleSizeSummary.toLowerCase().includes("total sample size"));
  assert.ok(explanation.caveats.length >= 2);
});

test("Explanation for non-ok result highlights inability to compute", () => {
  const registrySpec: StudySpec = {
    ...baseStudySpec,
    designId: "registry",
    designLabel: "Registry",
    isAdvancedDesign: false
  };

  const incompleteResult = computeSampleSizeForStudy(registrySpec, {
    ...baseAssumptions,
    designId: "registry",
    primaryEndpointType: "binary"
  });

  const plan = buildSAPPlan(registrySpec, incompleteResult);
  const explanation = generatePlainLanguageStatsExplanation(registrySpec, incompleteResult, plan);

  assert.ok(explanation.sampleSizeSummary.includes("could not safely compute"));
  assert.ok(explanation.caveats.some((text) => text.includes("statistician")));
});
