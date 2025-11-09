import { AURORA_RULEBOOK } from "./rulebook";
import type {
  ProtocolDraft,
  ProtocolSection,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

const SECTION_ORDER: ProtocolSection[] = [
  {
    id: "general-info",
    title: "General Information & Administrative Details",
    required: true,
    contentTemplate:
      "List administrative identifiers, sponsor/coordinator contacts, version history, and study governance details for {{title}}.",
  },
  {
    id: "background-rationale",
    title: "Background & Rationale",
    required: true,
    contentTemplate:
      "Summarize existing evidence and justify why studying {{condition}} in {{populationDescription}} is necessary for this setting.",
  },
  {
    id: "objectives",
    title: "Objectives",
    required: true,
    contentTemplate:
      "Define primary and secondary objectives aligned with the planned endpoints, ensuring the primary objective matches {{primaryEndpoint.name}}.",
  },
  {
    id: "design-overview",
    title: "Study Design Overview",
    required: true,
    contentTemplate:
      "Describe the {{designLabel}} design, including observational/interventional classification, setting, and overall flow of participants.",
  },
  {
    id: "population-eligibility",
    title: "Study Population & Eligibility Criteria",
    required: true,
    contentTemplate:
      "Detail inclusion and exclusion criteria for {{populationDescription}} and describe recruitment or identification methods at each site.",
  },
  {
    id: "procedures",
    title: "Study Treatments / Exposures / Procedures",
    required: true,
    contentTemplate:
      "Outline interventions, exposures, and study procedures, including visit schedules, assessments, and handling of protocol deviations.",
  },
  {
    id: "outcomes",
    title: "Outcome Measures",
    required: true,
    contentTemplate:
      "List primary and secondary endpoints. Confirm the primary endpoint {{primaryEndpoint.name}} is consistent across SAP and CRF sections.",
  },
  {
    id: "sample-size-stats",
    title: "Sample Size & Statistical Analysis",
    required: true,
    contentTemplate:
      "Summarize the statistical hypotheses, assumptions, and planned analyses using outputs from the deterministic sample size and SAP engines.",
  },
  {
    id: "safety-management",
    title: "Safety Reporting & Risk Management",
    required: true,
    contentTemplate:
      "Describe identification, documentation, and reporting pathways for adverse events, serious adverse events, and other safety signals.",
  },
  {
    id: "data-management",
    title: "Data Management, Quality Control & Monitoring",
    required: true,
    contentTemplate:
      "Explain data capture (including eCRF procedures), quality assurance, monitoring, and audit preparedness consistent with ALCOA+ principles.",
  },
  {
    id: "ethics",
    title: "Ethics & Regulatory Considerations",
    required: true,
    contentTemplate:
      "Document IEC/IRB submission plans, CTRI registration requirements, and regulatory pathways without implying approvals or IDs.",
  },
  {
    id: "consent-process",
    title: "Informed Consent Process",
    required: true,
    contentTemplate:
      "Describe how informed consent/assent will be obtained, including documentation, witnesses for vulnerable participants, and access to translations.",
  },
  {
    id: "confidentiality",
    title: "Confidentiality & Data Protection",
    required: true,
    contentTemplate:
      "Explain data privacy safeguards, de-identification approach, access controls, and retention policies aligned with local regulations.",
  },
  {
    id: "compensation",
    title: "Compensation for Study-related Injury",
    required: true,
    contentTemplate:
      "State compensation and medical management plans for study-related injury per Indian regulations, referencing applicable insurance or sponsor commitments.",
  },
  {
    id: "publication",
    title: "Publication & Data Sharing",
    required: true,
    contentTemplate:
      "Outline dissemination intentions, authorship principles, and data sharing governance subject to ethics approval and participant consent.",
  },
];

export function buildProtocolDraft(
  studySpec: StudySpec,
  sampleSizeResult: SampleSizeResult | null,
  sapPlan: SAPPlan | null
): ProtocolDraft {
  const warnings: string[] = [];

  if (!studySpec.title.trim()) {
    warnings.push("Study title is missing; protocol draft cannot be finalized.");
  }

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint is not defined; objectives and outcomes sections require PI input.");
  }

  if (!studySpec.populationDescription) {
    warnings.push("Population description missing; eligibility criteria require clarification.");
  }

  if (studySpec.isAdvancedDesign) {
    warnings.push("Design flagged as advanced; protocol template requires specialist review.");
  }

  if (!AURORA_RULEBOOK.studyDesigns.find((d) => d.id === studySpec.designId)) {
    warnings.push("Study design not found in approved rulebook list; verify design classification.");
  }

  if (!sampleSizeResult || sampleSizeResult.status !== "ok") {
    warnings.push("Sample size and assumptions must be finalized before protocol submission.");
  }

  if (!sapPlan || sapPlan.steps.length === 0) {
    warnings.push("Statistical analysis plan outline incomplete; ensure SAP section is reviewed.");
  }

  const sections: ProtocolSection[] = SECTION_ORDER.map((section) => ({ ...section }));

  return {
    studyId: studySpec.id,
    title: studySpec.title,
    designId: studySpec.designId,
    sections,
    warnings,
  };
}
