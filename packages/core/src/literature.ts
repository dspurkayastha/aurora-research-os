import type { LiteraturePlan, StudySpec } from "./types";

function keywordList(studySpec: StudySpec): string[] {
  const baseKeywords = new Set<string>();
  
  // PICO decomposition - Condition
  if (studySpec.condition) {
    baseKeywords.add(studySpec.condition);
    // Add condition-related terms
    const conditionLower = studySpec.condition.toLowerCase();
    if (conditionLower.includes("diabetes")) {
      baseKeywords.add("diabetes mellitus");
    }
    if (conditionLower.includes("hypertension")) {
      baseKeywords.add("hypertension");
    }
  }
  
  // PICO decomposition - Population
  if (studySpec.populationDescription) {
    baseKeywords.add(studySpec.populationDescription);
    // Extract key population descriptors
    const popLower = studySpec.populationDescription.toLowerCase();
    if (popLower.includes("adult")) {
      baseKeywords.add("adults");
    }
    if (popLower.includes("pediatric") || popLower.includes("child")) {
      baseKeywords.add("pediatric");
    }
  }
  
  // PICO decomposition - Intervention/Exposure
  if (studySpec.interventionName) {
    baseKeywords.add(studySpec.interventionName);
  }
  if (studySpec.comparatorName) {
    baseKeywords.add(studySpec.comparatorName);
  }
  if (studySpec.groupLabels && studySpec.groupLabels.length > 0) {
    studySpec.groupLabels.forEach((label) => baseKeywords.add(label));
  }
  
  // PICO decomposition - Outcome
  if (studySpec.primaryEndpoint?.name) {
    baseKeywords.add(studySpec.primaryEndpoint.name);
    // Add outcome-related terms based on type
    switch (studySpec.primaryEndpoint.type) {
      case "time-to-event":
        baseKeywords.add("survival analysis");
        baseKeywords.add("hazard ratio");
        baseKeywords.add("time to event");
        break;
      case "binary":
        baseKeywords.add("risk ratio");
        baseKeywords.add("odds ratio");
        baseKeywords.add("binary outcome");
        break;
      case "continuous":
        baseKeywords.add("mean difference");
        baseKeywords.add("continuous outcome");
        break;
      case "diagnostic":
        baseKeywords.add("diagnostic accuracy");
        baseKeywords.add("sensitivity");
        baseKeywords.add("specificity");
        break;
      default:
        break;
    }
  }
  
  // Add secondary endpoints
  for (const secondary of studySpec.secondaryEndpoints) {
    if (secondary.name) {
      baseKeywords.add(secondary.name);
    }
  }
  
  // Design-specific keywords
  if (studySpec.designLabel) {
    baseKeywords.add(studySpec.designLabel);
  }
  
  // Geographic/context keywords
  baseKeywords.add("India");
  if (studySpec.setting) {
    baseKeywords.add(studySpec.setting);
  }
  
  return Array.from(baseKeywords).slice(0, 15); // Increased limit for better coverage
}

export function buildLiteraturePlan(studySpec: StudySpec): LiteraturePlan {
  // Build PICO summary using structured fields - never use raw idea
  const population = studySpec.populationDescription ?? "target participants";
  
  // Intervention/Exposure from structured fields
  let interventionExposure = "to be detailed";
  if (studySpec.interventionName) {
    interventionExposure = studySpec.interventionName;
  } else if (studySpec.groupLabels && studySpec.groupLabels.length > 0) {
    interventionExposure = studySpec.groupLabels.join(" vs ");
  } else if (studySpec.designId === "rct-2arm-parallel") {
    interventionExposure = "investigational arm versus control";
  } else if (studySpec.designId) {
    interventionExposure = "exposure defined by study design";
  }
  
  // Comparator from structured fields
  let comparator = "context-specific comparator";
  if (studySpec.comparatorName) {
    comparator = studySpec.comparatorName;
  } else if (studySpec.groupLabels && studySpec.groupLabels.length >= 2) {
    comparator = studySpec.groupLabels[1];
  } else if (studySpec.designId === "rct-2arm-parallel") {
    comparator = "standard care/control arm";
  }
  
  // Outcome from structured fields
  const outcome = studySpec.primaryEndpoint?.name ?? "primary outcome to define";
  
  const picoSummary = [
    `Population: ${population}`,
    `Intervention/Exposure: ${interventionExposure}`,
    `Comparator: ${comparator}`,
    `Outcome: ${outcome}`,
  ].join(" | ");

  const suggestedKeywords = keywordList(studySpec);

  const notes = [
    "Use these keywords as starting points in PubMed, IndMED, and CTRI searches.",
    "Follow institutional SOPs for systematic reviews, screening, and bias assessment.",
    "Document inclusion/exclusion criteria and maintain a PRISMA-style flow diagram in the protocol annex.",
    "Combine keywords using Boolean operators (AND, OR, NOT) for effective search strategies.",
  ];

  return {
    picoSummary,
    suggestedKeywords,
    notes,
  };
}
