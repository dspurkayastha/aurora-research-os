import test from "node:test";
import assert from "node:assert/strict";

import {
  AURORA_RULEBOOK,
  buildCrfSchema,
  buildLiteraturePlan,
  buildPisIcfDraft,
  buildProtocolDraft,
  buildRegulatoryChecklist,
} from "../src";
import type {
  LiteraturePlan,
  PisIcfClauseCategory,
  PisIcfDraft,
  ProtocolDraft,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "../src";

const studySpec: StudySpec = {
  id: "study-001",
  title: "Study on 30-day mortality in adults",
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
    {
      name: "Length of stay",
      type: "continuous",
      role: "secondary",
    },
  ],
  isAdvancedDesign: false,
  notes: [],
  source: { fromRulebookVersion: AURORA_RULEBOOK.version },
};

const sampleSizeResult: SampleSizeResult = {
  status: "ok",
  methodId: "two-proportions",
  description: "Two-sample proportion comparison",
  totalSampleSize: 200,
  perGroupSampleSize: 100,
  assumptions: {
    alpha: 0.05,
    power: 0.8,
    twoSided: true,
    hypothesisType: "superiority",
    designId: "rct-2arm-parallel",
    primaryEndpointType: "binary",
    expectedControlEventRate: 0.3,
    expectedTreatmentEventRate: 0.18,
  },
  warnings: [],
  notes: [],
};

const sapPlan: SAPPlan = {
  primaryMethodId: "two-proportions",
  steps: [
    {
      label: "Primary analysis: compare event proportions between arms",
      population: "full",
      endpointRole: "primary",
      endpointName: "30-day mortality",
      testOrModel: "Chi-square test",
      effectMeasure: "Risk ratio with 95% CI",
      adjusted: false,
    },
  ],
  multiplicityHandling: "Primary endpoint analysed at two-sided alpha 0.05.",
  missingDataHandling: "Complete-case primary analysis with sensitivity checks.",
  software: "R / Python / SAS / Stata",
  warnings: [],
  notes: [],
};

function getDocumentDrafts(): {
  protocol: ProtocolDraft;
  crf: ReturnType<typeof buildCrfSchema>;
  pisIcf: PisIcfDraft;
  regulatory: ReturnType<typeof buildRegulatoryChecklist>;
  literature: LiteraturePlan;
} {
  const protocol = buildProtocolDraft(studySpec, sampleSizeResult, sapPlan);
  const crf = buildCrfSchema(studySpec, sampleSizeResult, sapPlan);
  const pisIcf = buildPisIcfDraft(studySpec, sampleSizeResult, sapPlan);
  const regulatory = buildRegulatoryChecklist(studySpec, sampleSizeResult, sapPlan);
  const literature = buildLiteraturePlan(studySpec, sampleSizeResult, sapPlan);

  return { protocol, crf, pisIcf, regulatory, literature };
}

test("Protocol draft contains core sections", () => {
  const { protocol } = getDocumentDrafts();
  assert.ok(protocol.sections.length >= 10);
  assert.ok(protocol.sections.some((section) => section.id === "sample-size-stats"));
  assert.equal(protocol.warnings.length, 0);
});

test("CRF schema captures baseline and primary endpoint fields", () => {
  const { crf } = getDocumentDrafts();
  const baselineForm = crf.forms.find((form) => form.id === "screening-baseline");
  assert.ok(baselineForm);
  assert.ok(
    baselineForm?.fields.some((field) => field.id.includes("baseline") && field.core)
  );
});

test("PIS/ICF clauses include mandatory categories", () => {
  const { pisIcf } = getDocumentDrafts();
  const categories = new Set(pisIcf.clauses.map((clause) => clause.category));
  const requiredCategories: PisIcfClauseCategory[] = [
    "intro",
    "purpose",
    "procedures",
    "risks",
    "benefits",
    "voluntary_right_to_withdraw",
    "compensation_injury",
    "contacts",
  ];

  requiredCategories.forEach((category) => {
    assert.ok(categories.has(category), `Missing clause category: ${category}`);
  });
});

test("Regulatory checklist flags unresolved fields", () => {
  const { regulatory } = getDocumentDrafts();
  assert.ok(regulatory.mappings.some((mapping) => mapping.fieldId === "ctri_public_title"));
  assert.ok(
    regulatory.missing.some((message) =>
      message.toLowerCase().includes("target sample size")
    )
  );
});

test("Literature plan provides keywords derived from study spec", () => {
  const { literature } = getDocumentDrafts();
  assert.ok(literature.questions.length >= 3);
  assert.ok(
    literature.suggestedKeywords.some((keyword) => keyword.includes("mortality"))
  );
});
