import type { PisIcfClause, PisIcfDraft, SAPPlan, SampleSizeResult, StudySpec } from "./types";

const BASE_CLAUSES: PisIcfClause[] = [
  {
    id: "intro-statement",
    category: "intro",
    required: true,
    contentTemplate:
      "You are invited to consider participation in the research study titled {{studyTitle}} being conducted at {{siteName}}.",
  },
  {
    id: "purpose",
    category: "purpose",
    required: true,
    contentTemplate:
      "Explain in plain language why the study is being conducted and how it relates to {{condition}} or the health question being addressed.",
  },
  {
    id: "procedures",
    category: "procedures",
    required: true,
    contentTemplate:
      "Describe what participation involves, including number of visits, procedures, tests, and approximate duration for each visit.",
  },
  {
    id: "risks",
    category: "risks",
    required: true,
    contentTemplate:
      "List potential risks, discomforts, or inconveniences. Include monitoring and emergency contact pathways for participants.",
  },
  {
    id: "benefits",
    category: "benefits",
    required: true,
    contentTemplate:
      "State expected benefits to participants or to society. If no direct benefit is anticipated, clearly say so.",
  },
  {
    id: "alternatives",
    category: "alternatives",
    required: true,
    contentTemplate:
      "Explain available alternatives to participation, including standard of care or other research options.",
  },
  {
    id: "confidentiality",
    category: "confidentiality",
    required: true,
    contentTemplate:
      "Describe how data and samples will be stored, who can access them, and how confidentiality will be maintained in line with applicable regulations.",
  },
  {
    id: "injury-compensation",
    category: "compensation_injury",
    required: true,
    contentTemplate:
      "Provide the compensation and medical management plan for research-related injury according to Indian regulations and institutional policies.",
  },
  {
    id: "voluntariness",
    category: "voluntary_right_to_withdraw",
    required: true,
    contentTemplate:
      "Participation is voluntary. Explain that refusal or withdrawal will not affect routine care and describe how to withdraw consent.",
  },
  {
    id: "future-use",
    category: "data_use_future",
    required: false,
    contentTemplate:
      "If samples or data may be used in future studies, describe the scope, storage duration, and re-consent requirements.",
  },
  {
    id: "contacts",
    category: "contacts",
    required: true,
    contentTemplate:
      "List contact details for the principal investigator ({{principalInvestigator}}) and the ethics committee for questions or complaints.",
  },
  {
    id: "vulnerable",
    category: "vulnerable_populations",
    required: false,
    contentTemplate:
      "Describe additional safeguards for vulnerable participants such as children, pregnant women, or those unable to consent independently.",
  },
  {
    id: "miscellaneous",
    category: "misc",
    required: true,
    contentTemplate:
      "Include statements on compensation for participation if any, audio-visual consent (where mandated), and language translation availability.",
  },
];

export function buildPisIcfDraft(
  studySpec: StudySpec,
  sampleSizeResult: SampleSizeResult | null,
  sapPlan: SAPPlan | null
): PisIcfDraft {
  const warnings: string[] = [];

  if (!studySpec.title.trim()) {
    warnings.push("Study title missing; consent introduction requires completion.");
  }

  if (!studySpec.populationDescription) {
    warnings.push("Population description absent; assess whether vulnerable population safeguards apply.");
  }

  if (studySpec.populationDescription) {
    const lower = studySpec.populationDescription.toLowerCase();
    if (/(child|adolescent|pregnan|neonate|elderly)/.test(lower)) {
      warnings.push("Potential vulnerable participants detected; ensure dedicated safeguards and assent/witness wording.");
    }
  }

  if (!sampleSizeResult || sampleSizeResult.status !== "ok") {
    warnings.push("Consent document must include final sample size and visit commitments once approved.");
  }

  if (!sapPlan || sapPlan.steps.length === 0) {
    warnings.push("Statistical description for participants should be updated after SAP confirmation.");
  }

  warnings.push(
    "Confirm local language translations, signature blocks, and IEC-required statements before participant use."
  );

  return {
    studyId: studySpec.id,
    language: "en",
    clauses: BASE_CLAUSES.map((clause) => ({ ...clause })),
    warnings,
  };
}
