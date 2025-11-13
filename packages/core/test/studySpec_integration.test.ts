import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBaselinePackageFromIdea,
  buildProtocolDraft,
  buildSAPPlan,
  buildCrfSchema,
  buildPisIcfDraft,
  buildLiteraturePlan,
  computeSampleSizeForStudy,
  type StudySpec,
} from "../src";
import { mergeAssumptions } from "../src/baseline";

/**
 * Integration tests with StudySpec fixtures to verify consistency across generators
 */

// Fixture 1: RCT - parallel, binary primary endpoint
const RCT_FIXTURE: StudySpec = {
  title: "30-Day Mortality Study",
  designId: "rct-2arm-parallel",
  designLabel: "Randomised Controlled Trial (2-arm parallel)",
  regulatoryProfileId: "india-v1",
  condition: "Emergency laparotomy",
  populationDescription: "Adult patients",
  setting: "Tertiary care hospital",
  primaryEndpoint: {
    name: "30-day mortality",
    type: "binary",
    role: "primary",
    timeframe: "30 days",
  },
  secondaryEndpoints: [],
  objectives: {
    primary: ["Evaluate 30-day mortality in the defined population."],
    secondary: [],
  },
  eligibility: {
    inclusion: ["Age ≥18 years", "Emergency laparotomy"],
    exclusion: ["Pregnant women", "Known terminal illness"],
  },
  followUpDuration: "30 days",
  groupLabels: ["Intervention", "Control"],
  interventionName: "Enhanced recovery protocol",
  comparatorName: "Standard care",
  notes: [],
  source: { fromRulebookVersion: "1.0.0" },
};

// Fixture 2: Prospective cohort, binary primary endpoint
const COHORT_FIXTURE: StudySpec = {
  title: "Complication Incidence Study",
  designId: "prospective-cohort",
  designLabel: "Prospective Cohort Study",
  regulatoryProfileId: "india-v1",
  condition: "Surgical procedure",
  populationDescription: "Adult patients undergoing surgery",
  setting: "Tertiary care hospital",
  primaryEndpoint: {
    name: "Incidence of complication",
    type: "binary",
    role: "primary",
    timeframe: "12 months",
  },
  secondaryEndpoints: [],
  objectives: {
    primary: ["Evaluate incidence of complication in the defined population."],
    secondary: [],
  },
  eligibility: {
    inclusion: ["Age ≥18 years", "Scheduled for surgery"],
    exclusion: ["Emergency surgery"],
  },
  followUpDuration: "12 months",
  groupLabels: ["Exposed", "Unexposed"],
  notes: [],
  source: { fromRulebookVersion: "1.0.0" },
};

// Fixture 3: Cross-sectional, continuous primary endpoint
const CROSS_SECTIONAL_FIXTURE: StudySpec = {
  title: "Blood Pressure Measurement Study",
  designId: "cross-sectional",
  designLabel: "Cross-Sectional Study",
  regulatoryProfileId: "india-v1",
  condition: "Hypertension",
  populationDescription: "Adult patients",
  setting: "Outpatient clinic",
  primaryEndpoint: {
    name: "Mean blood pressure",
    type: "continuous",
    role: "primary",
  },
  secondaryEndpoints: [],
  objectives: {
    primary: ["Evaluate mean blood pressure in the defined population."],
    secondary: [],
  },
  eligibility: {
    inclusion: ["Age ≥18 years", "Diagnosed hypertension"],
    exclusion: [],
  },
  // No follow-up duration for cross-sectional
  notes: [],
  source: { fromRulebookVersion: "1.0.0" },
};

test("RCT fixture - Protocol contains correct design description", () => {
  const assumptions = mergeAssumptions(RCT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(RCT_FIXTURE, assumptions);
  const sap = buildSAPPlan(RCT_FIXTURE, sampleSize);
  const protocol = buildProtocolDraft(RCT_FIXTURE, sap, sampleSize);

  // Protocol should mention randomisation
  const designSection = protocol.sections.find((s) => s.id === "study-design");
  assert.ok(designSection);
  assert.ok(designSection.content.toLowerCase().includes("randomised") || designSection.content.toLowerCase().includes("randomization"));
  
  // Protocol should mention the primary endpoint and timeframe
  const endpointsSection = protocol.sections.find((s) => s.id === "endpoints");
  assert.ok(endpointsSection);
  assert.ok(endpointsSection.content.includes("30-day mortality"));
  assert.ok(endpointsSection.content.includes("30 days") || endpointsSection.content.includes("30-day"));
  
  // Protocol should mention group labels
  assert.ok(designSection.content.includes("Intervention") || designSection.content.includes("Control"));
});

test("RCT fixture - SAP renders endpoints table with primary endpoint", () => {
  const assumptions = mergeAssumptions(RCT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(RCT_FIXTURE, assumptions);
  const sap = buildSAPPlan(RCT_FIXTURE, sampleSize);

  assert.ok(sap.endpoints.length > 0);
  const primaryEndpoint = sap.endpoints.find((ep) => ep.role === "primary" && ep.endpointName === "30-day mortality");
  assert.ok(primaryEndpoint, "SAP should include primary endpoint");
  assert.equal(primaryEndpoint?.endpointName, "30-day mortality");
  assert.equal(primaryEndpoint?.type, "binary");
  assert.ok(primaryEndpoint?.timeframe === "30 days" || primaryEndpoint?.timeframe === RCT_FIXTURE.followUpDuration);
});

test("RCT fixture - CRF has design-appropriate fields (arms only for RCT)", () => {
  const assumptions = mergeAssumptions(RCT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(RCT_FIXTURE, assumptions);
  const sap = buildSAPPlan(RCT_FIXTURE, sampleSize);
  const crf = buildCrfSchema(RCT_FIXTURE, sap);

  // CRF should have treatment form with randomisation fields
  const treatmentForm = crf.forms.find((f) => f.id === "treatment" || f.purpose === "treatment");
  assert.ok(treatmentForm, "RCT should have treatment form");
  
  // Should have field for assigned arm
  const armField = treatmentForm.fields.find((f) => 
    f.id.includes("arm") || f.label.toLowerCase().includes("arm")
  );
  assert.ok(armField, "RCT CRF should have arm assignment field");
  
  // Should have randomisation date field
  const allocationDateField = treatmentForm.fields.find((f) => 
    f.id.includes("allocation") || f.id.includes("random")
  );
  assert.ok(allocationDateField, "RCT CRF should have allocation/randomisation date field");
});

test("RCT fixture - CRF includes explicit fields for primary endpoint", () => {
  const assumptions = mergeAssumptions(RCT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(RCT_FIXTURE, assumptions);
  const sap = buildSAPPlan(RCT_FIXTURE, sampleSize);
  const crf = buildCrfSchema(RCT_FIXTURE, sap);

  // CRF should have fields mapped to primary endpoint
  const hasPrimaryField = crf.forms.some((form) =>
    form.fields.some((field) => field.mapsToEndpointName === "30-day mortality")
  );
  assert.ok(hasPrimaryField, "CRF should have fields mapped to primary endpoint '30-day mortality'");
  
  // Should have at least one field with isCore: true for primary endpoint
  const primaryFields = crf.forms.flatMap((form) =>
    form.fields.filter((field) => 
      field.mapsToEndpointName === "30-day mortality" && field.isCore === true
    )
  );
  assert.ok(primaryFields.length > 0, "CRF should have core fields for primary endpoint");
});

test("Cohort fixture - Protocol does not mention randomisation", () => {
  const assumptions = mergeAssumptions(COHORT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(COHORT_FIXTURE, assumptions);
  const sap = buildSAPPlan(COHORT_FIXTURE, sampleSize);
  const protocol = buildProtocolDraft(COHORT_FIXTURE, sap, sampleSize);

  const designSection = protocol.sections.find((s) => s.id === "study-design");
  assert.ok(designSection);
  
  // Should NOT mention randomisation for cohort design
  const contentLower = designSection.content.toLowerCase();
  assert.ok(
    !contentLower.includes("randomised") && !contentLower.includes("randomization"),
    "Cohort design should not mention randomisation"
  );
  
  // Should mention follow-up duration
  assert.ok(designSection.content.includes("12 months") || designSection.content.includes(COHORT_FIXTURE.followUpDuration));
});

test("Cohort fixture - SAP endpoint table shows timeframe", () => {
  const assumptions = mergeAssumptions(COHORT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(COHORT_FIXTURE, assumptions);
  const sap = buildSAPPlan(COHORT_FIXTURE, sampleSize);

  const primaryEndpoint = sap.endpoints.find((ep) => ep.role === "primary");
  assert.ok(primaryEndpoint);
  assert.ok(primaryEndpoint.timeframe === "12 months" || primaryEndpoint.timeframe === COHORT_FIXTURE.followUpDuration);
});

test("Cohort fixture - CRF includes explicit fields for primary endpoint", () => {
  const assumptions = mergeAssumptions(COHORT_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(COHORT_FIXTURE, assumptions);
  const sap = buildSAPPlan(COHORT_FIXTURE, sampleSize);
  const crf = buildCrfSchema(COHORT_FIXTURE, sap);

  const hasPrimaryField = crf.forms.some((form) =>
    form.fields.some((field) => field.mapsToEndpointName === "Incidence of complication")
  );
  assert.ok(hasPrimaryField, "CRF should have fields mapped to primary endpoint");
});

test("Cross-sectional fixture - No follow-up duration", () => {
  const assumptions = mergeAssumptions(CROSS_SECTIONAL_FIXTURE, {});
  const sampleSize = computeSampleSizeForStudy(CROSS_SECTIONAL_FIXTURE, assumptions);
  const sap = buildSAPPlan(CROSS_SECTIONAL_FIXTURE, sampleSize);
  const protocol = buildProtocolDraft(CROSS_SECTIONAL_FIXTURE, sap, sampleSize);

  // Cross-sectional should not have follow-up duration
  assert.equal(CROSS_SECTIONAL_FIXTURE.followUpDuration, undefined);
  
  // Protocol should still work without follow-up
  assert.ok(protocol.sections.length > 0);
});

test("All fixtures - PIS/ICF generated and does not contain rawIdea", () => {
  const fixtures = [RCT_FIXTURE, COHORT_FIXTURE, CROSS_SECTIONAL_FIXTURE];
  
  for (const fixture of fixtures) {
    const pisIcf = buildPisIcfDraft(fixture);
    
    // PIS/ICF should have sections
    assert.ok(pisIcf.sections.length > 0);
    
    // Should NOT contain rawIdea (even if it was set)
    const allContent = pisIcf.sections.map((s) => s.content).join(" ");
    assert.ok(!allContent.includes("rawIdea"), "PIS/ICF should not contain rawIdea");
    assert.ok(!allContent.includes("I want to study"), "PIS/ICF should not contain raw idea text");
  }
});

test("All fixtures - Literature plan uses PICO-derived terms, never raw idea", () => {
  const fixtures = [RCT_FIXTURE, COHORT_FIXTURE, CROSS_SECTIONAL_FIXTURE];
  
  for (const fixture of fixtures) {
    const literaturePlan = buildLiteraturePlan(fixture);
    
    // Should have keywords
    assert.ok(literaturePlan.suggestedKeywords.length > 0);
    
    // Keywords should include structured fields
    if (fixture.condition) {
      assert.ok(
        literaturePlan.suggestedKeywords.some((kw) => 
          kw.toLowerCase().includes(fixture.condition.toLowerCase())
        ),
        `Keywords should include condition: ${fixture.condition}`
      );
    }
    
    if (fixture.primaryEndpoint?.name) {
      assert.ok(
        literaturePlan.suggestedKeywords.some((kw) => 
          kw.toLowerCase().includes(fixture.primaryEndpoint!.name.toLowerCase())
        ) ||
        literaturePlan.picoSummary.includes(fixture.primaryEndpoint.name),
        `PICO summary or keywords should include primary endpoint: ${fixture.primaryEndpoint.name}`
      );
    }
    
    // Should NOT contain rawIdea
    const allText = [
      literaturePlan.picoSummary,
      ...literaturePlan.suggestedKeywords,
      ...literaturePlan.notes,
    ].join(" ");
    assert.ok(!allText.includes("rawIdea"), "Literature plan should not contain rawIdea");
    assert.ok(!allText.includes("I want to study"), "Literature plan should not contain raw idea text");
  }
});

test("Precedence test - Clarifying answers override AI parsing", () => {
  // Create PreSpec with AI-parsed design
  const preSpec = {
    rawIdea: "Study idea",
    condition: "AI-parsed condition",
    populationDescription: "AI-parsed population",
    designId: "rct-2arm-parallel" as const,
    clarifyingQuestions: [
      {
        id: "q1",
        question: "What is the study design?",
        priority: "critical" as const,
        field: "designId",
        answer: "prospective-cohort",
        skipped: false,
      },
      {
        id: "q2",
        question: "What is the condition?",
        priority: "important" as const,
        field: "condition",
        answer: "Clarified condition",
        skipped: false,
      },
    ],
  };
  
  const studySpec = buildBaselineSpec(preSpec, null);
  
  // Clarifying answer should override AI parsing
  assert.equal(studySpec.designId, "prospective-cohort", "Clarifying answer should override AI-parsed design");
  assert.equal(studySpec.condition, "Clarified condition", "Clarifying answer should override AI-parsed condition");
});

test("Follow-up duration propagation test", () => {
  const fixture: StudySpec = {
    ...RCT_FIXTURE,
    followUpDuration: "12 months",
    primaryEndpoint: {
      ...RCT_FIXTURE.primaryEndpoint!,
      timeframe: "12 months",
    },
  };
  
  const assumptions = mergeAssumptions(fixture, {});
  const sampleSize = computeSampleSizeForStudy(fixture, assumptions);
  const sap = buildSAPPlan(fixture, sampleSize);
  const protocol = buildProtocolDraft(fixture, sap, sampleSize);
  
  // Protocol should contain timeframe
  const endpointsSection = protocol.sections.find((s) => s.id === "endpoints");
  assert.ok(endpointsSection);
  assert.ok(endpointsSection.content.includes("12 months"));
  
  // SAP endpoint should have timeframe
  const primaryEndpoint = sap.endpoints.find((ep) => ep.role === "primary");
  assert.ok(primaryEndpoint);
  assert.ok(primaryEndpoint.timeframe === "12 months");
});

