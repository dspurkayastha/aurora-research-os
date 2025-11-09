import type {
  LiteraturePlan,
  LiteratureQuestion,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

function uniqueKeywords(values: (string | undefined)[]): string[] {
  const keywords = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    value
      .split(/[,;/]|\band\b|\bor\b|\s+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
      .forEach((token) => keywords.add(token.toLowerCase()));
  }
  return Array.from(keywords).slice(0, 12);
}

export function buildLiteraturePlan(
  studySpec: StudySpec,
  sampleSizeResult: SampleSizeResult | null,
  sapPlan: SAPPlan | null
): LiteraturePlan {
  const questions: LiteratureQuestion[] = [];
  const warnings: string[] = [];

  if (!studySpec.condition) {
    warnings.push("Condition not specified; refine literature keywords for disease burden searches.");
  }

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint absent; evidence table must be updated once defined.");
  }

  questions.push(
    {
      id: "burden-setting",
      label: "Burden of disease in proposed setting",
      description:
        "Identify epidemiology and burden of {{condition}} within settings similar to {{setting}} and {{populationDescription}}.",
    },
    {
      id: "existing-evidence",
      label: "Existing interventions or exposures",
      description:
        "Summarize prior studies evaluating similar interventions/exposures and their outcomes relevant to {{primaryEndpoint.name}}.",
    },
    {
      id: "standard-of-care",
      label: "Current standard of care and gaps",
      description:
        "Describe usual care pathways for {{condition}} in {{setting}} and highlight unresolved needs motivating this study.",
    }
  );

  if (studySpec.designId === "diagnostic-accuracy") {
    questions.push({
      id: "diagnostic-comparators",
      label: "Existing diagnostic accuracy evidence",
      description:
        "Review sensitivity, specificity, and AUC from previous diagnostic accuracy studies for comparable index tests and reference standards.",
    });
  } else {
    questions.push({
      id: "endpoint-evidence",
      label: "Evidence on primary endpoint",
      description:
        "Compile data on the incidence or distribution of {{primaryEndpoint.name}} within comparable populations and interventions.",
    });
  }

  const suggestedKeywords = uniqueKeywords([
    studySpec.condition,
    studySpec.populationDescription,
    studySpec.setting,
    studySpec.designLabel,
    studySpec.primaryEndpoint?.name,
  ]);

  if (!sapPlan || sapPlan.steps.length === 0) {
    warnings.push("Analysis approach pending; update literature synthesis focus when SAP is finalized.");
  }

  if (!sampleSizeResult || sampleSizeResult.status !== "ok") {
    warnings.push("Sample size unresolved; evidence appraisal should revisit feasibility once numbers are confirmed.");
  }

  const tableTemplate = [
    "First author",
    "Year",
    "Country",
    "Study design",
    "Population",
    "Intervention/Exposure",
    "Comparator",
    "Primary outcome",
    "Key findings",
    "Risk of bias / limitations",
  ];

  warnings.push(
    "This plan is a scaffold; conduct systematic searches, screening, and appraisal per institutional SOPs before drafting.",
  );

  return {
    studyId: studySpec.id,
    questions,
    suggestedKeywords,
    tableTemplate,
    warnings,
  };
}
