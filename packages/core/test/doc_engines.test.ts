import test from "node:test";
import assert from "node:assert/strict";

import {
  AURORA_RULEBOOK,
  buildBaselinePackageFromIdea,
  buildSAPPlan,
  computeSampleSizeForStudy,
  generatePlainLanguageStatsExplanation,
} from "../src";
import type { SampleSizeAssumptionsBase, StudySpec } from "../src";

const idea =
  "We want to study 30-day mortality after emergency laparotomy in adult patients admitted to our tertiary care hospital.";

function buildStudySpec(): StudySpec {
  return {
    title: "Study on 30-day mortality",
    designId: "rct-2arm-parallel",
    designLabel: "RCT – 2 Arm Parallel",
    regulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
    condition: "Emergency laparotomy",
    populationDescription: "Adults undergoing emergency laparotomy",
    setting: "Tertiary care hospital",
    primaryEndpoint: {
      name: "30-day mortality",
      type: "binary",
      role: "primary",
      timeframe: "30-day",
    },
    secondaryEndpoints: [
      { name: "Length of stay", type: "continuous", role: "secondary" },
    ],
    objectives: { primary: ["Assess 30-day mortality"], secondary: [] },
    eligibility: { inclusion: [], exclusion: [] },
    visitScheduleSummary: "Follow-up at 30 days",
    notes: [],
    source: { fromRulebookVersion: AURORA_RULEBOOK.version },
  };
}

const assumptions: SampleSizeAssumptionsBase = {
  alpha: 0.05,
  power: 0.8,
  twoSided: true,
  hypothesisType: "superiority",
  designId: "rct-2arm-parallel",
  primaryEndpointType: "binary",
  expectedControlEventRate: 0.3,
  expectedTreatmentEventRate: 0.18,
};

test("baseline package builder produces deterministic drafts", () => {
  const result = buildBaselinePackageFromIdea(idea, assumptions);

  assert.ok(result.protocol.sections.some((section) => section.id === "sample-size"));
  assert.ok(
    result.sap.endpoints.some((endpoint) =>
      endpoint.endpointName.toLowerCase().includes("mortality")
    )
  );
  const crfCover = result.crf.forms.some((form) =>
    form.fields.some(
      (field) => field.mapsToEndpointName?.toLowerCase().includes("mortality")
    )
  );
  assert.equal(crfCover, true);
  const consentSectionTitles = new Set(result.pisIcf.sections.map((section) => section.id));
  [
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
  ].forEach((required) => assert.ok(consentSectionTitles.has(required)));
  assert.ok(result.registryMapping.fields.some((field) => field.fieldId === "ctri_public_title"));
  assert.ok(result.literaturePlan.suggestedKeywords.length > 0);
  assert.ok(result.sampleSize.status === "ok");
  assert.equal(result.disclaimer, AURORA_RULEBOOK.disclaimers.draftNotice);
  assert.equal(result.versionInfo.rulebookProfile, "india-v1");
  assert.equal(result.versionInfo.rulebookVersion, AURORA_RULEBOOK.version);
});

test("regulatory checklist flags unresolved inputs", () => {
  const result = buildBaselinePackageFromIdea(idea, assumptions);
  assert.ok(result.regulatoryChecklist.items.some((item) => item.id === "registry-mapping"));
});

test("plain language explanation handles incomplete sample size", () => {
  const spec = buildStudySpec();
  const incompleteAssumptions = { ...assumptions, expectedTreatmentEventRate: undefined };
  const incomplete = computeSampleSizeForStudy(spec, incompleteAssumptions as SampleSizeAssumptionsBase);
  const sap = buildSAPPlan(spec, incomplete);
  const explanation = generatePlainLanguageStatsExplanation(spec, incomplete, sap);

  assert.ok(explanation.sampleSizeSummary.includes("could not"));
  assert.ok(explanation.caveats.some((text) => text.includes("statistician")));
});
