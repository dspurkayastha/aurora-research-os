import type { LiteraturePlan, StudySpec } from "./types";

function keywordList(studySpec: StudySpec): string[] {
  const baseKeywords = new Set<string>();
  if (studySpec.condition) {
    baseKeywords.add(studySpec.condition);
  }
  if (studySpec.populationDescription) {
    baseKeywords.add(studySpec.populationDescription);
  }
  if (studySpec.designLabel) {
    baseKeywords.add(studySpec.designLabel);
  }
  if (studySpec.primaryEndpoint?.name) {
    baseKeywords.add(studySpec.primaryEndpoint.name);
  }
  switch (studySpec.primaryEndpoint?.type) {
    case "time-to-event":
      baseKeywords.add("survival analysis");
      baseKeywords.add("hazard ratio");
      break;
    case "binary":
      baseKeywords.add("risk ratio");
      baseKeywords.add("odds ratio");
      break;
    case "continuous":
      baseKeywords.add("mean difference");
      break;
    case "diagnostic":
      baseKeywords.add("diagnostic accuracy");
      baseKeywords.add("sensitivity specificity");
      break;
    default:
      break;
  }
  baseKeywords.add("India");
  baseKeywords.add("tertiary care");
  return Array.from(baseKeywords).slice(0, 10);
}

export function buildLiteraturePlan(studySpec: StudySpec): LiteraturePlan {
  const picoSummary = [
    `Population: ${studySpec.populationDescription ?? "target participants"}`,
    `Intervention/Exposure: ${
      studySpec.designId === "rct-2arm-parallel"
        ? "investigational arm versus control"
        : studySpec.designId
        ? "exposure defined by study design"
        : "to be detailed"
    }`,
    `Comparator: ${
      studySpec.designId === "rct-2arm-parallel"
        ? "standard care/control arm"
        : "context-specific comparator"
    }`,
    `Outcome: ${studySpec.primaryEndpoint?.name ?? "primary outcome to define"}`,
  ].join(" | ");

  const suggestedKeywords = keywordList(studySpec);

  const notes = [
    "Use these keywords as starting points in PubMed, IndMED, and CTRI searches.",
    "Follow institutional SOPs for systematic reviews, screening, and bias assessment.",
    "Document inclusion/exclusion criteria and maintain a PRISMA-style flow diagram in the protocol annex.",
  ];

  return {
    picoSummary,
    suggestedKeywords,
    notes,
  };
}
