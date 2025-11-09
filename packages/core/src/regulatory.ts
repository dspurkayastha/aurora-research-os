import { AURORA_RULEBOOK } from "./rulebook";
import type {
  RegulatoryChecklist,
  RegulatoryFieldMapping,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

interface FieldRequirement {
  mapping: RegulatoryFieldMapping;
  isPresent: (studySpec: StudySpec) => boolean;
  missingMessage: string;
}

const FIELD_REQUIREMENTS: FieldRequirement[] = [
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_public_title",
      label: "CTRI public title",
      required: true,
      sourceHint: "StudySpec.title",
    },
    isPresent: (studySpec) => Boolean(studySpec.title?.trim()),
    missingMessage: "Public title missing for CTRI dataset.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_scientific_title",
      label: "CTRI scientific title",
      required: true,
      sourceHint: "Align with StudySpec.title or SAP objectives",
    },
    isPresent: (studySpec) => Boolean(studySpec.title?.trim()),
    missingMessage: "Scientific title requires completion in CTRI dataset.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_health_condition",
      label: "Health condition/problem studied",
      required: true,
      sourceHint: "StudySpec.condition",
    },
    isPresent: (studySpec) => Boolean(studySpec.condition?.trim()),
    missingMessage: "Health condition/indication not specified.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_study_type",
      label: "Study type",
      required: true,
      sourceHint: "Derive from StudySpec.designLabel and rulebook category",
    },
    isPresent: (studySpec) =>
      Boolean(AURORA_RULEBOOK.studyDesigns.find((d) => d.id === studySpec.designId)),
    missingMessage: "Study design not mapped to CTRI study type.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_study_design",
      label: "Study design details",
      required: true,
      sourceHint: "StudySpec.designLabel + protocol procedures",
    },
    isPresent: (studySpec) => Boolean(studySpec.designLabel?.trim()),
    missingMessage: "Detailed study design description required for CTRI.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_primary_outcome",
      label: "Primary outcome",
      required: true,
      sourceHint: "StudySpec.primaryEndpoint",
    },
    isPresent: (studySpec) => Boolean(studySpec.primaryEndpoint?.name?.trim()),
    missingMessage: "Primary outcome missing; CTRI cannot be completed.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_secondary_outcomes",
      label: "Secondary outcomes",
      required: false,
      sourceHint: "StudySpec.secondaryEndpoints",
    },
    isPresent: (studySpec) => studySpec.secondaryEndpoints.length > 0,
    missingMessage: "Secondary outcomes not listed; mark as not applicable if none.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_target_sample_size_india",
      label: "Target sample size (India)",
      required: true,
      sourceHint: "SampleSizeResult.totalSampleSize",
    },
    isPresent: () => false,
    missingMessage: "Target sample size for India must be entered after sample size approval.",
  },
  {
    mapping: {
      target: "CTRI",
      fieldId: "ctri_trial_sites",
      label: "Trial sites",
      required: true,
      sourceHint: "Protocol site list",
    },
    isPresent: () => false,
    missingMessage: "Site information pending; add site names, addresses, and investigators.",
  },
  {
    mapping: {
      target: "IEC",
      fieldId: "iec_primary_objective",
      label: "IEC submission – primary objective",
      required: true,
      sourceHint: "Protocol objectives section",
    },
    isPresent: (studySpec) => Boolean(studySpec.primaryEndpoint?.name?.trim()),
    missingMessage: "Primary objective wording to align with primary endpoint.",
  },
  {
    mapping: {
      target: "IEC",
      fieldId: "iec_risk_category",
      label: "IEC risk categorisation",
      required: true,
      sourceHint: "Safety section and intervention risk profile",
    },
    isPresent: () => false,
    missingMessage: "Risk category not determined; classify (e.g., minimal, more than minimal).",
  },
  {
    mapping: {
      target: "IEC",
      fieldId: "iec_compensation_plan",
      label: "Compensation for injury",
      required: true,
      sourceHint: "Protocol compensation section",
    },
    isPresent: () => false,
    missingMessage: "Compensation wording required per IEC template.",
  },
  {
    mapping: {
      target: "ICMR",
      fieldId: "icmr_informed_consent",
      label: "ICMR consent elements",
      required: true,
      sourceHint: "PIS/ICF clauses",
    },
    isPresent: (studySpec) => Boolean(studySpec.populationDescription),
    missingMessage: "Ensure consent clauses address participant profile and mandatory elements.",
  },
  {
    mapping: {
      target: "ICMR",
      fieldId: "icmr_data_sharing",
      label: "Data sharing statement",
      required: false,
      sourceHint: "Protocol publication/data sharing section",
    },
    isPresent: () => false,
    missingMessage: "Data sharing plans to be documented before submission.",
  },
  {
    mapping: {
      target: "LOCAL",
      fieldId: "institutional_agreements",
      label: "Institutional approvals/agreements",
      required: true,
      sourceHint: "Site feasibility and MOUs",
    },
    isPresent: () => false,
    missingMessage: "Document local hospital or college permissions before initiation.",
  },
];

export function buildRegulatoryChecklist(
  studySpec: StudySpec,
  sampleSizeResult: SampleSizeResult | null,
  sapPlan: SAPPlan | null
): RegulatoryChecklist {
  const mappings: RegulatoryFieldMapping[] = FIELD_REQUIREMENTS.map((item) => item.mapping);
  const missing: string[] = [];

  for (const requirement of FIELD_REQUIREMENTS) {
    if (!requirement.isPresent(studySpec)) {
      missing.push(requirement.missingMessage);
    }
  }

  const warnings = [
    "Checklist reflects India v1 expectations; verify against latest CTRI/IEC/ICMR templates before submission.",
    "Do not submit until missing items are resolved and supporting documents are attached.",
  ];

  if (!sampleSizeResult || sampleSizeResult.status !== "ok") {
    missing.push("Final sample size numbers must be provided before regulatory submission.");
  }

  if (!sapPlan || sapPlan.steps.length === 0) {
    missing.push("Attach detailed statistical analysis plan as part of IEC/CTRI package.");
  }

  return {
    studyId: studySpec.id,
    mappings,
    missing,
    warnings,
  };
}
