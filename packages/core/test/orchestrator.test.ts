import test from "node:test";
import assert from "node:assert/strict";

import {
  AURORA_RULEBOOK,
  buildBaselineSpec,
  chooseDesign,
  parseIdeaToPreSpec
} from "../src";

test("parseIdeaToPreSpec extracts key hints", () => {
  const idea =
    "I want to study 30-day mortality after emergency laparotomy in adult patients in our tertiary care hospital.";
  const preSpec = parseIdeaToPreSpec(idea);

  assert.equal(preSpec.rawIdea, idea.trim());
  assert.ok(preSpec.primaryOutcomeHint && preSpec.primaryOutcomeHint.toLowerCase().includes("mortality"));
  assert.ok(preSpec.timeframeHint && preSpec.timeframeHint.includes("30-day"));
  assert.ok(preSpec.populationDescription && preSpec.populationDescription.length > 0);
});

test("chooseDesign selects a rulebook whitelisted design", () => {
  const idea =
    "I want to study 30-day mortality after emergency laparotomy in adult patients in our tertiary care hospital.";
  const preSpec = parseIdeaToPreSpec(idea);
  const designId = chooseDesign(preSpec);

  assert.ok(designId);
  assert.ok(AURORA_RULEBOOK.studyDesigns.some((design) => design.id === designId));
  assert.ok(!AURORA_RULEBOOK.advancedStudyDesigns.some((design) => design.id === designId));
});

test("buildBaselineSpec produces aligned study spec", () => {
  const idea =
    "I want to study 30-day mortality after emergency laparotomy in adult patients in our tertiary care hospital.";
  const preSpec = parseIdeaToPreSpec(idea);
  const designId = chooseDesign(preSpec);
  const studySpec = buildBaselineSpec(preSpec, designId);

  assert.ok(studySpec.designLabel.length > 0);
  assert.equal(studySpec.regulatoryProfileId, AURORA_RULEBOOK.defaultRegulatoryProfileId);
  assert.ok(studySpec.primaryEndpoint);
  assert.equal(studySpec.primaryEndpoint?.role, "primary");
  assert.equal(studySpec.isAdvancedDesign, false);
});
