import type {
  CRFField,
  CRFForm,
  CRFSchema,
  CRFFormPurpose,
  EndpointSpec,
  StudySpec,
} from "./types";

const INTERVENTIONAL_DESIGNS = new Set(["rct-2arm-parallel", "single-arm"]);
const FOLLOWUP_LABELS = ["Visit 1", "Visit 2", "Visit 3"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "field";
}

function buildEndpointField(endpoint: EndpointSpec): CRFField[] {
  const baseId = slugify(endpoint.name || "endpoint");
  const shared = {
    required: true,
    mapsToEndpointName: endpoint.name,
    isCore: endpoint.role === "primary",
  } as const;

  switch (endpoint.type) {
    case "binary":
      return [
        {
          id: `${baseId}-status`,
          label: `${endpoint.name} occurrence`,
          type: "radio",
          options: ["Yes", "No", "Unknown"],
          notes: "Record whether the endpoint occurred during this visit.",
          ...shared,
        },
        {
          id: `${baseId}-date`,
          label: `${endpoint.name} date/time`,
          type: "datetime",
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
      ];
    case "continuous":
      return [
        {
          id: `${baseId}-value`,
          label: `${endpoint.name} value`,
          type: "number",
          unit: "Specify unit",
          notes: "Capture value using protocol-defined procedures.",
          ...shared,
        },
      ];
    case "time-to-event":
      return [
        {
          id: `${baseId}-event-status`,
          label: `${endpoint.name} event occurred`,
          type: "radio",
          options: ["Yes", "No", "Censored"],
          notes: "State if event occurred or follow-up ended without event.",
          ...shared,
        },
        {
          id: `${baseId}-event-date`,
          label: `${endpoint.name} event/censor date`,
          type: "datetime",
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
        {
          id: `${baseId}-censor-reason`,
          label: "Reason for censoring",
          type: "select",
          options: ["Completed follow-up", "Lost to follow-up", "Withdrew", "Other"],
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
      ];
    case "diagnostic":
      return [
        {
          id: `${baseId}-index-test`,
          label: "Index test result",
          type: "select",
          options: ["Positive", "Negative", "Indeterminate"],
          notes: "Record the primary diagnostic test outcome.",
          ...shared,
        },
        {
          id: `${baseId}-reference-standard`,
          label: "Reference standard outcome",
          type: "select",
          options: ["Confirmed", "Not confirmed", "Pending"],
          notes: "Document verification using the specified reference standard.",
          ...shared,
        },
      ];
    case "ordinal":
      return [
        {
          id: `${baseId}-score`,
          label: `${endpoint.name} score`,
          type: "number",
          notes: "Capture ordinal scale score using validated instrument.",
          ...shared,
        },
      ];
    case "count":
      return [
        {
          id: `${baseId}-count`,
          label: `${endpoint.name} count`,
          type: "number",
          notes: "Record total count within assessment window.",
          ...shared,
        },
      ];
    default:
      return [
        {
          id: `${baseId}-entry`,
          label: `${endpoint.name} (specify capture method)`,
          type: "textarea",
          notes: "Endpoint type not recognised; PI/statistician to define data capture.",
          ...shared,
        },
      ];
  }
}

function createForm(
  id: string,
  name: string,
  purpose: CRFFormPurpose,
  fields: CRFField[],
  visitLabel?: string
): CRFForm {
  return {
    id,
    name,
    purpose,
    fields,
    visitLabel,
  };
}

function buildScreeningForm(): CRFForm {
  const fields: CRFField[] = [
    {
      id: "subject-id",
      label: "Subject ID",
      type: "text",
      required: true,
      isCore: true,
      notes: "Site-assigned identifier without personally identifiable information.",
    },
    {
      id: "consent-confirmation",
      label: "Informed consent obtained",
      type: "radio",
      options: ["Yes", "No", "Pending"],
      required: true,
      isCore: true,
      notes: "Ensure PIS/ICF completed before further procedures.",
    },
    {
      id: "consent-date",
      label: "Consent date",
      type: "date",
      required: false,
      isCore: false,
    },
    {
      id: "inclusion-confirmed",
      label: "All inclusion criteria satisfied",
      type: "radio",
      options: ["Yes", "No", "Pending"],
      required: true,
      isCore: true,
    },
    {
      id: "exclusion-confirmed",
      label: "Any exclusion criteria present",
      type: "radio",
      options: ["Yes", "No", "Unknown"],
      required: true,
      isCore: true,
    },
  ];
  return createForm("screening", "Screening & Eligibility", "screening", fields);
}

function buildBaselineForm(studySpec: StudySpec): CRFForm {
  const fields: CRFField[] = [
    {
      id: "demographics-age",
      label: "Age",
      type: "number",
      required: true,
      isCore: true,
      unit: "years",
    },
    {
      id: "demographics-sex",
      label: "Sex",
      type: "select",
      options: ["Female", "Male", "Other", "Prefer not to disclose"],
      required: true,
      isCore: true,
    },
    {
      id: "demographics-weight",
      label: "Weight",
      type: "number",
      required: false,
      isCore: false,
      unit: "kg",
    },
    {
      id: "demographics-height",
      label: "Height",
      type: "number",
      required: false,
      isCore: false,
      unit: "cm",
    },
    {
      id: "baseline-condition-notes",
      label: `Baseline details for ${studySpec.condition ?? "condition"}`,
      type: "textarea",
      required: false,
      isCore: false,
      notes: "Summarise history, diagnostic confirmation, and relevant comorbidities.",
    },
  ];

  if (INTERVENTIONAL_DESIGNS.has(studySpec.designId ?? "")) {
    fields.push(
      {
        id: "randomisation-date",
        label: "Randomisation / allocation date",
        type: "datetime",
        required: false,
        isCore: false,
      },
      {
        id: "treatment-assigned",
        label: "Assigned intervention",
        type: "text",
        required: true,
        isCore: true,
        notes: "Do not store randomisation list; record assigned arm label only.",
      }
    );
  }

  return createForm("baseline", "Baseline & Demographics", "baseline", fields);
}

function buildFollowUpForms(studySpec: StudySpec): CRFForm[] {
  if (!studySpec.primaryEndpoint && studySpec.secondaryEndpoints.length === 0) {
    return [];
  }

  const outcomeFields: CRFField[] = [];
  if (studySpec.primaryEndpoint) {
    outcomeFields.push(...buildEndpointField({ ...studySpec.primaryEndpoint, role: "primary" }));
  }
  for (const secondary of studySpec.secondaryEndpoints) {
    outcomeFields.push(...buildEndpointField({ ...secondary, role: "secondary" }));
  }

  const followUpForms: CRFForm[] = [];
  const followupCount = INTERVENTIONAL_DESIGNS.has(studySpec.designId ?? "") ? 2 : 1;
  for (let index = 0; index < followupCount; index += 1) {
    followUpForms.push(
      createForm(
        `followup-${index + 1}`,
        `Follow-up Assessment ${index + 1}`,
        "followup",
        outcomeFields.map((field) => ({ ...field, id: `${field.id}-v${index + 1}` })),
        FOLLOWUP_LABELS[index]
      )
    );
  }

  followUpForms.push(
    createForm(
      "outcome",
      "Primary Outcome Confirmation",
      "outcome",
      outcomeFields.map((field) => ({ ...field, id: `${field.id}-final` })),
      "Final assessment"
    )
  );

  return followUpForms;
}

function buildSafetyForm(): CRFForm {
  const fields: CRFField[] = [
    {
      id: "ae-report-date",
      label: "AE report date",
      type: "date",
      required: true,
      isCore: true,
    },
    {
      id: "ae-description",
      label: "Event description",
      type: "textarea",
      required: true,
      isCore: true,
    },
    {
      id: "ae-onset",
      label: "Onset date",
      type: "date",
      required: true,
      isCore: true,
    },
    {
      id: "ae-severity",
      label: "Severity",
      type: "select",
      options: ["Mild", "Moderate", "Severe"],
      required: true,
      isCore: true,
    },
    {
      id: "ae-relatedness",
      label: "Relationship to study intervention/procedures",
      type: "select",
      options: ["Related", "Possibly related", "Not related", "Not assessable"],
      required: true,
      isCore: true,
    },
    {
      id: "ae-outcome",
      label: "Outcome",
      type: "select",
      options: ["Recovered", "Recovering", "Not recovered", "Fatal", "Unknown"],
      required: true,
      isCore: true,
    },
    {
      id: "ae-serious",
      label: "Serious adverse event",
      type: "radio",
      options: ["Yes", "No"],
      required: true,
      isCore: true,
    },
  ];
  return createForm("ae", "Adverse Events & Safety", "ae-safety", fields);
}

function buildDeviationForm(): CRFForm {
  const fields: CRFField[] = [
    {
      id: "deviation-date",
      label: "Deviation date",
      type: "date",
      required: true,
      isCore: false,
    },
    {
      id: "deviation-description",
      label: "Description of deviation",
      type: "textarea",
      required: true,
      isCore: false,
    },
    {
      id: "deviation-impact",
      label: "Impact on safety/efficacy",
      type: "textarea",
      required: false,
      isCore: false,
    },
  ];
  return createForm("deviations", "Protocol Deviations", "other", fields);
}

export function buildCrfSchema(studySpec: StudySpec): CRFSchema {
  const warnings: string[] = [];

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint missing; outcome forms are generic placeholders.");
  }
  if (!studySpec.designId) {
    warnings.push("Design not confirmed; visit schedule requires PI review.");
  }

  const forms: CRFForm[] = [
    buildScreeningForm(),
    buildBaselineForm(studySpec),
    ...buildFollowUpForms(studySpec),
    buildSafetyForm(),
    buildDeviationForm(),
  ];

  return {
    forms,
    warnings,
  };
}
