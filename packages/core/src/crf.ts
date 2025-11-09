import type {
  CrfField,
  CrfForm,
  CrfSchema,
  EndpointSpec,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

const INTERVENTIONAL_DESIGNS = new Set(["rct-2arm-parallel", "single-arm"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "field";
}

function buildBinaryFields(endpoint: EndpointSpec, context: string, core: boolean): CrfField[] {
  const slug = slugify(endpoint.name || "binary-endpoint");
  return [
    {
      id: `${context}-${slug}-status`,
      label: `${endpoint.name} occurrence`,
      type: "radio",
      options: ["Yes", "No", "Unknown"],
      required: true,
      core,
      notes: "Record whether the event occurred during this visit.",
    },
    {
      id: `${context}-${slug}-date`,
      label: `${endpoint.name} event date`,
      type: "date",
      required: false,
      notes: "Capture date of event when applicable.",
    },
  ];
}

function buildContinuousFields(endpoint: EndpointSpec, context: string, core: boolean): CrfField[] {
  const slug = slugify(endpoint.name || "continuous-endpoint");
  return [
    {
      id: `${context}-${slug}-value`,
      label: `${endpoint.name} value`,
      type: "number",
      required: true,
      unit: "specify unit",
      core,
      notes: "Capture measured value using protocol-defined procedures.",
    },
  ];
}

function buildTimeToEventFields(endpoint: EndpointSpec, context: string, core: boolean): CrfField[] {
  const slug = slugify(endpoint.name || "time-event-endpoint");
  return [
    {
      id: `${context}-${slug}-event`,
      label: `${endpoint.name} event occurred`,
      type: "radio",
      options: ["Yes", "No", "Censored"],
      required: true,
      core,
      notes: "Indicate if the event occurred or if follow-up ended without event.",
    },
    {
      id: `${context}-${slug}-event-date`,
      label: `${endpoint.name} event or censoring date`,
      type: "date",
      required: false,
    },
    {
      id: `${context}-${slug}-censor-reason`,
      label: "Reason for censoring",
      type: "select",
      options: ["Completed follow-up", "Lost to follow-up", "Withdrew", "Other"],
      required: false,
    },
  ];
}

function buildDiagnosticFields(endpoint: EndpointSpec, context: string, core: boolean): CrfField[] {
  const slug = slugify(endpoint.name || "diagnostic-endpoint");
  return [
    {
      id: `${context}-${slug}-index-result`,
      label: "Index test result",
      type: "select",
      options: ["Positive", "Negative", "Indeterminate"],
      required: true,
      core,
      notes: "Record the primary diagnostic test output.",
    },
    {
      id: `${context}-${slug}-reference-standard`,
      label: "Reference standard outcome",
      type: "select",
      options: ["Confirmed", "Not confirmed", "Pending"],
      required: true,
      core,
      notes: "Record confirmation status against the chosen reference standard.",
    },
  ];
}

function buildEndpointFields(endpoint: EndpointSpec, context: string, core: boolean): CrfField[] {
  switch (endpoint.type) {
    case "binary":
      return buildBinaryFields(endpoint, context, core);
    case "continuous":
      return buildContinuousFields(endpoint, context, core);
    case "time-to-event":
      return buildTimeToEventFields(endpoint, context, core);
    case "diagnostic":
      return buildDiagnosticFields(endpoint, context, core);
    case "ordinal":
      return [
        {
          id: `${context}-${slugify(endpoint.name)}-score`,
          label: `${endpoint.name} ordinal score`,
          type: "number",
          required: true,
          core,
          notes: "Document the ordinal scale value.",
        },
      ];
    case "count":
      return [
        {
          id: `${context}-${slugify(endpoint.name)}-count`,
          label: `${endpoint.name} count`,
          type: "number",
          required: true,
          core,
          notes: "Record total number observed during interval.",
        },
      ];
    default:
      return [];
  }
}

export function buildCrfSchema(
  studySpec: StudySpec,
  sampleSizeResult: SampleSizeResult | null,
  sapPlan: SAPPlan | null
): CrfSchema {
  const forms: CrfForm[] = [];
  const warnings: string[] = [];

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint missing; CRF only includes generic screening fields.");
  }

  if (studySpec.isAdvancedDesign) {
    warnings.push("Advanced design detected; CRF skeleton requires specialist tailoring.");
  }

  if (!sampleSizeResult || sampleSizeResult.status !== "ok") {
    warnings.push("Sample size unresolved; form visit schedules may change after statistician confirmation.");
  }

  if (!sapPlan || sapPlan.steps.length === 0) {
    warnings.push("Statistical analysis steps pending; ensure CRF fields align with final SAP.");
  }

  const screeningFields: CrfField[] = [
    {
      id: "subject-id",
      label: "Subject ID",
      type: "text",
      required: true,
      core: true,
      notes: "Site-assigned identifier; avoid PHI.",
    },
    {
      id: "consent-date",
      label: "Informed consent date",
      type: "date",
      required: true,
      core: true,
    },
    {
      id: "consent-witness",
      label: "Witness present (if required)",
      type: "select",
      options: ["Yes", "No", "Not applicable"],
      required: false,
    },
    {
      id: "eligibility-inclusion",
      label: "All inclusion criteria met",
      type: "select",
      options: ["Yes", "No", "Pending review"],
      required: true,
      core: true,
    },
    {
      id: "eligibility-exclusion",
      label: "Any exclusion criteria triggered",
      type: "select",
      options: ["Yes", "No", "Pending review"],
      required: true,
      core: true,
    },
    {
      id: "age-years",
      label: "Age (years)",
      type: "number",
      required: true,
      core: true,
      unit: "years",
    },
    {
      id: "sex-at-birth",
      label: "Sex at birth",
      type: "select",
      options: ["Female", "Male", "Intersex", "Not disclosed"],
      required: true,
      core: true,
    },
    {
      id: "population-notes",
      label: "Population notes",
      type: "textarea",
      required: false,
      notes: "Summarize key characteristics relevant to eligibility.",
    },
  ];

  if (studySpec.primaryEndpoint) {
    screeningFields.push(
      ...buildEndpointFields(studySpec.primaryEndpoint, "baseline", true)
    );
  }

  forms.push({
    id: "screening-baseline",
    title: "Screening & Baseline",
    visitLabel: "Screening/Baseline",
    fields: screeningFields,
  });

  if (INTERVENTIONAL_DESIGNS.has(studySpec.designId)) {
    forms.push({
      id: "allocation",
      title: "Treatment Allocation & Dosing",
      visitLabel: "Day 0",
      fields: [
        {
          id: "randomization-code",
          label: "Randomization code",
          type: "text",
          required: true,
          core: true,
          notes: "Record system-generated randomization identifier only.",
        },
        {
          id: "assigned-arm",
          label: "Assigned arm",
          type: "select",
          options: ["Arm A", "Arm B", "Other"],
          required: true,
          core: true,
        },
        {
          id: "first-dose-datetime",
          label: "First dose/Intervention start datetime",
          type: "datetime",
          required: false,
        },
      ],
    });
  }

  if (studySpec.primaryEndpoint) {
    forms.push({
      id: "follow-up",
      title: "Follow-up Outcome Assessment",
      visitLabel: studySpec.primaryEndpoint.timeframe ?? "Follow-up",
      fields: [
        {
          id: "visit-date",
          label: "Visit date",
          type: "date",
          required: true,
        },
        ...buildEndpointFields(studySpec.primaryEndpoint, "followup", true),
      ],
    });
  }

  if (!INTERVENTIONAL_DESIGNS.has(studySpec.designId) && studySpec.designId !== "diagnostic-accuracy") {
    forms.push({
      id: "exposure-data",
      title: "Exposure / Comparator Data Capture",
      visitLabel: "Data abstraction",
      fields: [
        {
          id: "exposure-source",
          label: "Source record for exposure information",
          type: "text",
          required: false,
          notes: "Indicate medical record, registry, or interview source used.",
        },
        {
          id: "exposure-status",
          label: "Exposure or comparator status",
          type: "select",
          options: ["Exposed", "Comparator", "Not recorded"],
          required: false,
        },
        {
          id: "exposure-datetime",
          label: "Exposure assessment date/time",
          type: "datetime",
          required: false,
        },
      ],
    });
  }

  if (INTERVENTIONAL_DESIGNS.has(studySpec.designId)) {
    forms.push({
      id: "safety",
      title: "Adverse Event Monitoring",
      visitLabel: "Throughout",
      fields: [
        {
          id: "ae-occurred",
          label: "Adverse event occurred",
          type: "radio",
          options: ["Yes", "No"],
          required: true,
          core: true,
        },
        {
          id: "ae-description",
          label: "Adverse event description",
          type: "textarea",
          required: false,
        },
        {
          id: "ae-relatedness",
          label: "Investigator assessment of relatedness",
          type: "select",
          options: ["Not related", "Possibly", "Probably", "Definitely"],
          required: false,
        },
        {
          id: "sae-flag",
          label: "Serious adverse event",
          type: "radio",
          options: ["Yes", "No"],
          required: false,
        },
      ],
    });
  }

  if (studySpec.designId === "diagnostic-accuracy") {
    forms.push({
      id: "diagnostic-truth",
      title: "Diagnostic Reference Standard",
      visitLabel: "Diagnostic confirmation",
      fields: [
        {
          id: "reference-method",
          label: "Reference standard method",
          type: "text",
          required: true,
          core: true,
        },
        {
          id: "reference-result",
          label: "Reference standard result",
          type: "select",
          options: ["Positive", "Negative", "Indeterminate"],
          required: true,
          core: true,
        },
        {
          id: "time-to-reference",
          label: "Days between index and reference test",
          type: "number",
          required: false,
          unit: "days",
        },
      ],
    });
  }

  forms.push({
    id: "study-exit",
    title: "End of Study / Early Termination",
    visitLabel: "Exit",
    fields: [
      {
        id: "exit-date",
        label: "Exit date",
        type: "date",
        required: true,
      },
      {
        id: "exit-status",
        label: "Exit status",
        type: "select",
        options: ["Completed", "Withdrew consent", "Lost to follow-up", "Death", "Other"],
        required: true,
      },
      {
        id: "exit-notes",
        label: "Exit notes",
        type: "textarea",
        required: false,
      },
    ],
  });

  return {
    studyId: studySpec.id,
    forms,
    warnings,
  };
}
