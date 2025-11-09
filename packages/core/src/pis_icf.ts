import type { PISICFDraft, PISICFSection, StudySpec } from "./types";

const SECTION_BUILDERS: { id: string; title: string; content: (spec: StudySpec) => string }[] = [
  {
    id: "intro",
    title: "Introduction",
    content: (spec) =>
      `You are invited to consider participation in a research study titled "${spec.title}" conducted at ${
        spec.setting ?? "the study site"
      }. This document summarises what participation involves.`,
  },
  {
    id: "purpose",
    title: "Purpose of the Study",
    content: (spec) =>
      `Explain the purpose: to evaluate ${spec.primaryEndpoint?.name ?? "the study objectives"} in ${
        spec.populationDescription ?? "the target population"
      }. Clarify that this is research, not routine care.`,
  },
  {
    id: "procedures",
    title: "Study Procedures & Duration",
    content: (spec) =>
      `Describe required visits, assessments, and procedures. Indicate expected number of visits and overall duration (${spec.visitScheduleSummary ?? "to be defined"}).`,
  },
  {
    id: "risks",
    title: "Foreseeable Risks & Discomforts",
    content: () =>
      "List known and anticipated risks or discomforts. Include instructions for reporting side effects or concerns to the study team.",
  },
  {
    id: "benefits",
    title: "Potential Benefits",
    content: () =>
      "Explain any expected benefits. If no direct benefit is expected, state clearly that participation may not benefit the participant but may help future patients.",
  },
  {
    id: "alternatives",
    title: "Alternatives to Participation",
    content: () =>
      "Describe available standard treatments or other options, including the option not to participate, without penalty.",
  },
  {
    id: "confidentiality",
    title: "Confidentiality & Data Handling",
    content: () =>
      "Describe how data will be protected, who can access it, data de-identification, storage duration, and situations where confidentiality may be limited by law.",
  },
  {
    id: "compensation-injury",
    title: "Compensation & Medical Management for Injury",
    content: () =>
      "Explain availability of medical management and compensation for study-related injury according to institutional and Indian regulatory requirements (PI to confirm policy details).",
  },
  {
    id: "voluntary",
    title: "Voluntary Participation",
    content: () =>
      "Emphasise that participation is voluntary, refusal involves no penalty, and participants may withdraw at any time without affecting routine care.",
  },
  {
    id: "future-use",
    title: "Future Use of Data/Samples",
    content: () =>
      "State whether samples/data may be stored for future research. Obtain explicit consent choices and describe withdrawal options.",
  },
  {
    id: "contacts",
    title: "Contacts for Questions & Complaints",
    content: () =>
      "Provide placeholders for PI contact, study coordinator, and IEC contact information for rights and grievances.",
  },
  {
    id: "vulnerable",
    title: "Special Considerations for Vulnerable Participants",
    content: () =>
      "Outline additional safeguards for vulnerable populations (e.g., children, incapacitated adults) including assent and legal representative consent if applicable.",
  },
  {
    id: "consent-documentation",
    title: "Consent Documentation",
    content: () =>
      "Include signature/ thumbprint blocks for participant/LAR, date, witness (if required), and investigator obtaining consent. Add audio-visual consent statement if mandated.",
  },
];

export function buildPisIcfDraft(studySpec: StudySpec): PISICFDraft {
  const warnings: string[] = [];

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint unclear; ensure purpose and risk sections reflect confirmed objectives.");
  }
  if (!studySpec.designId) {
    warnings.push("Design not confirmed; consent procedures must be validated by PI/IEC.");
  }

  const sections: PISICFSection[] = SECTION_BUILDERS.map((builder) => ({
    id: builder.id,
    title: builder.title,
    required: true,
    content: `${builder.content(studySpec)}\n[Provide lay-language narrative and site-specific details.]`,
  }));

  return {
    sections,
    warnings,
  };
}