import type { LiteraturePlan, StudySpec } from "./types";

function deriveKeywords(studySpec: StudySpec): string[] {
  const keywords = new Set<string>();
  if (studySpec.condition) {
    keywords.add(studySpec.condition);
  }
  if (studySpec.populationDescription) {
    keywords.add(studySpec.populationDescription);
  }
  if (studySpec.designLabel) {
    keywords.add(studySpec.designLabel);
  }
  if (studySpec.primaryEndpoint?.name) {
    keywords.add(studySpec.primaryEndpoint.name);
  }
  if (studySpec.primaryEndpoint?.type === "time-to-event") {
    keywords.add("survival analysis");
  }
  if (studySpec.primaryEndpoint?.type === "binary") {
    keywords.add("risk ratio");
  }
  return Array.from(keywords).filter(Boolean);
}

export function buildLiteraturePlan(studySpec: StudySpec): LiteraturePlan {
  const picoParts: string[] = [];
  picoParts.push(`Population: ${studySpec.populationDescription ?? "to be described"}`);
  picoParts.push(`Intervention/Exposure: ${studySpec.designId === "rct-2arm-parallel" ? "investigational arm vs control" : studySpec.designId ? "exposure per design" : "to be defined"}`);
  picoParts.push(`Comparator: ${studySpec.designId === "rct-2arm-parallel" ? "control arm" : "context-specific"}`);
  picoParts.push(`Outcome: ${studySpec.primaryEndpoint?.name ?? "primary endpoint to confirm"}`);

  const suggestedKeywords = deriveKeywords(studySpec);
  if (suggestedKeywords.length === 0) {
    suggestedKeywords.push("clinical research", "India", "ICMR");
  }

  const notes = [
    "This is a planning scaffold only. Conduct systematic searches per PRISMA/ICMR expectations.",
    "Critically appraise identified studies before inclusion in the protocol.",
  ];

  return {
    picoSummary: picoParts.join(" | "),
    suggestedKeywords,
    notes,
  };
}

