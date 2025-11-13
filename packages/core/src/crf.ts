import type {
  CRFField,
  CRFForm,
  CRFFormPurpose,
  CRFSchema,
  EndpointSpec,
  SAPPlan,
  StudySpec,
} from "./types";

const INTERVENTIONAL_DESIGNS = new Set(["rct-2arm-parallel", "single-arm"]);
const OBSERVATIONAL_EXPOSURE_DESIGNS = new Set([
  "prospective-cohort",
  "retrospective-cohort",
  "case-control",
]);

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 64) || "field"
  );
}

function buildEndpointFields(endpoint: EndpointSpec): CRFField[] {
  const baseId = slugify(endpoint.name || "endpoint");
  const shared: Pick<CRFField, "required" | "mapsToEndpointName" | "isCore"> = {
    required: true,
    mapsToEndpointName: endpoint.name,
    isCore: endpoint.role === "primary",
  };

  switch (endpoint.type) {
    case "binary":
      return [
        {
          id: `${baseId}-status`,
          label: `${endpoint.name} occurrence`,
          type: "radio",
          options: ["Yes", "No", "Unknown"],
          notes: "Mark whether the outcome occurred during this assessment.",
          ...shared,
        },
        {
          id: `${baseId}-timestamp`,
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
          notes: "Capture value using validated measurement techniques.",
          ...shared,
        },
        {
          id: `${baseId}-method`,
          label: "Measurement method / instrument",
          type: "text",
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
      ];
    case "time-to-event":
      return [
        {
          id: `${baseId}-status`,
          label: `${endpoint.name} event status`,
          type: "radio",
          options: ["Event", "Censored"],
          notes: "Indicate whether the event occurred or follow-up ended without event.",
          ...shared,
        },
        {
          id: `${baseId}-date`,
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
          options: ["Completed follow-up", "Lost to follow-up", "Withdrew consent", "Died", "Other"],
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
      ];
    case "diagnostic":
      return [
        {
          id: `${baseId}-index`,
          label: "Index test result",
          type: "select",
          options: ["Positive", "Negative", "Indeterminate"],
          notes: "Record the categorical result of the investigational diagnostic test.",
          ...shared,
        },
        {
          id: `${baseId}-reference`,
          label: "Reference standard result",
          type: "select",
          options: ["Confirmed", "Not confirmed", "Pending"],
          notes: "Document verification against the agreed reference standard.",
          ...shared,
        },
        {
          id: `${baseId}-test-date`,
          label: "Index test date",
          type: "date",
          required: false,
          mapsToEndpointName: endpoint.name,
          isCore: false,
        },
      ];
    case "ordinal":
      return [
        {
          id: `${baseId}-score`,
          label: `${endpoint.name} score`,
          type: "number",
          notes: "Enter score according to validated ordinal scale (specify range).",
          ...shared,
        },
      ];
    case "count":
      return [
        {
          id: `${baseId}-count`,
          label: `${endpoint.name} count`,
          type: "number",
          notes: "Record cumulative count during the defined assessment window.",
          ...shared,
        },
      ];
    default:
      return [
        {
          id: `${baseId}-detail`,
          label: `${endpoint.name} details`,
          type: "textarea",
          notes: "Endpoint type not recognised in deterministic catalogue; PI/statistician to specify capture approach.",
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
  return { id, name, purpose, fields, visitLabel };
}

function buildScreeningForm(): CRFForm {
  const fields: CRFField[] = [
    {
      id: "subject-id",
      label: "Participant identifier",
      type: "text",
      required: true,
      isCore: true,
      notes: "Assign site-specific study ID without personal identifiers.",
    },
    {
      id: "consent-confirmation",
      label: "Written informed consent obtained",
      type: "radio",
      options: ["Yes", "No", "Pending"],
      required: true,
      isCore: true,
      notes: "Consent must be completed before any study-specific procedures.",
    },
    {
      id: "consent-date",
      label: "Consent date",
      type: "date",
      required: false,
      isCore: false,
    },
    {
      id: "screening-inclusion",
      label: "All inclusion criteria satisfied",
      type: "radio",
      options: ["Yes", "No", "Pending"],
      required: true,
      isCore: true,
    },
    {
      id: "screening-exclusion",
      label: "Any exclusion criteria present",
      type: "radio",
      options: ["Yes", "No", "Unknown"],
      required: true,
      isCore: true,
    },
  ];
  return createForm("screening", "Screening & Eligibility", "screening", fields);
}

function buildBaselineForm(spec: StudySpec): CRFForm {
  const fields: CRFField[] = [
    { id: "age", label: "Age", type: "number", unit: "years", required: true, isCore: true },
    {
      id: "sex",
      label: "Sex",
      type: "select",
      options: ["Female", "Male", "Other", "Prefer not to disclose"],
      required: true,
      isCore: true,
    },
    { id: "weight", label: "Weight", type: "number", unit: "kg", required: false, isCore: false },
    { id: "height", label: "Height", type: "number", unit: "cm", required: false, isCore: false },
    {
      id: "baseline-condition",
      label: `Baseline status for ${spec.condition ?? "condition"}`,
      type: "textarea",
      required: false,
      isCore: false,
      notes: "Summarise diagnosis confirmation, severity, and key comorbidities.",
    },
  ];

  return createForm("baseline", "Baseline & Demographics", "baseline", fields);
}

function buildTreatmentOrExposureForm(spec: StudySpec): CRFForm | null {
  if (INTERVENTIONAL_DESIGNS.has(spec.designId ?? "")) {
    // For RCTs, use groupLabels if available, otherwise use intervention/comparator names
    let armOptions: string[] = [];
    if (spec.groupLabels && spec.groupLabels.length > 0) {
      armOptions = spec.groupLabels;
    } else if (spec.interventionName && spec.comparatorName) {
      armOptions = [spec.interventionName, spec.comparatorName];
    } else {
      armOptions = ["Intervention", "Control"]; // Generic fallback
    }
    
    const fields: CRFField[] = [
      {
        id: "allocation-date",
        label: "Randomisation / allocation date",
        type: "datetime",
        required: true,
        isCore: true,
      },
      {
        id: "assigned-arm",
        label: "Assigned intervention arm",
        type: spec.groupLabels && spec.groupLabels.length > 0 ? "select" : "text",
        options: armOptions.length > 0 ? armOptions : undefined,
        required: true,
        isCore: true,
        notes: "Record arm label; do not capture randomisation sequence numbers.",
      },
      {
        id: "dose-or-procedure",
        label: "Initial dose / procedure summary",
        type: "textarea",
        required: false,
        isCore: false,
      },
    ];
    return createForm("treatment", "Intervention Administration", "treatment", fields);
  }

  if (OBSERVATIONAL_EXPOSURE_DESIGNS.has(spec.designId ?? "")) {
    // For observational designs, use groupLabels if available
    let exposureOptions: string[] = ["Exposed", "Unexposed"];
    if (spec.groupLabels && spec.groupLabels.length > 0) {
      exposureOptions = spec.groupLabels;
    } else {
      exposureOptions = ["Exposed", "Unexposed", "Multiple levels"];
    }
    
    const fields: CRFField[] = [
      {
        id: "exposure-status",
        label: "Exposure classification",
        type: "select",
        options: exposureOptions,
        required: true,
        isCore: true,
      },
      {
        id: "exposure-details",
        label: "Exposure details",
        type: "textarea",
        required: false,
        isCore: false,
        notes: "Describe exposure definition, timing, and measurement source.",
      },
    ];
    return createForm("exposure", "Exposure Assessment", "treatment", fields);
  }

  return null;
}

function buildVisitForms(spec: StudySpec): CRFForm[] {
  const outcomeFields: CRFField[] = [];
  if (spec.primaryEndpoint) {
    outcomeFields.push(...buildEndpointFields({ ...spec.primaryEndpoint, role: "primary" }));
  }
  for (const secondary of spec.secondaryEndpoints) {
    outcomeFields.push(...buildEndpointFields({ ...secondary, role: "secondary" }));
  }

  if (outcomeFields.length === 0) {
    return [];
  }

  // Use followUpDuration if available, otherwise fall back to primaryEndpoint.timeframe
  const timeframe = spec.followUpDuration || spec.primaryEndpoint?.timeframe;
  const timeframeSuffix = timeframe ? ` (within ${timeframe})` : "";

  const visitForms: CRFForm[] = [];
  const visitCount = INTERVENTIONAL_DESIGNS.has(spec.designId ?? "") ? 2 : 1;
  for (let visitIndex = 0; visitIndex < visitCount; visitIndex += 1) {
    visitForms.push(
      createForm(
        `follow-up-${visitIndex + 1}`,
        `Follow-up Visit ${visitIndex + 1}${timeframeSuffix}`,
        "followup",
        outcomeFields.map((field) => ({ ...field, id: `${field.id}-v${visitIndex + 1}` })),
        `Visit ${visitIndex + 1}${timeframeSuffix}`
      )
    );
  }

  visitForms.push(
    createForm(
      "primary-outcome",
      `Primary Outcome Confirmation${timeframeSuffix}`,
      "outcome",
      outcomeFields.map((field) => ({ ...field, id: `${field.id}-final` })),
      timeframe ? `End of follow-up (${timeframe})` : "End of follow-up"
    )
  );

  return visitForms;
}

function buildSafetyForm(): CRFForm {
  const fields: CRFField[] = [
    { id: "ae-report-date", label: "AE report date", type: "date", required: true, isCore: true },
    { id: "ae-onset", label: "Onset date", type: "date", required: true, isCore: true },
    { id: "ae-description", label: "Event description", type: "textarea", required: true, isCore: true },
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
      label: "Relationship to study procedures",
      type: "select",
      options: ["Related", "Possibly related", "Not related", "Not assessable"],
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
    {
      id: "ae-outcome",
      label: "Outcome",
      type: "select",
      options: ["Recovered", "Recovering", "Not recovered", "Fatal", "Unknown"],
      required: true,
      isCore: true,
    },
    {
      id: "ae-action",
      label: "Action taken",
      type: "textarea",
      required: false,
      isCore: false,
    },
  ];
  return createForm("safety", "Adverse Event & SAE Reporting", "ae-safety", fields);
}

function buildDeviationForm(): CRFForm {
  const fields: CRFField[] = [
    { id: "deviation-date", label: "Deviation date", type: "date", required: true, isCore: false },
    {
      id: "deviation-description",
      label: "Description of deviation",
      type: "textarea",
      required: true,
      isCore: false,
    },
    {
      id: "deviation-impact",
      label: "Impact on participant safety or data integrity",
      type: "textarea",
      required: false,
      isCore: false,
    },
    {
      id: "deviation-action",
      label: "Corrective action",
      type: "textarea",
      required: false,
      isCore: false,
    },
  ];
  return createForm("deviations", "Protocol Deviations", "other", fields);
}

function buildExitForm(): CRFForm {
  const fields: CRFField[] = [
    {
      id: "study-completion-status",
      label: "Study completion status",
      type: "select",
      options: ["Completed", "Withdrawn", "Lost to follow-up", "Death", "Ongoing"],
      required: true,
      isCore: true,
    },
    {
      id: "completion-date",
      label: "Completion/withdrawal date",
      type: "date",
      required: false,
      isCore: false,
    },
    {
      id: "withdrawal-reason",
      label: "Reason for withdrawal",
      type: "textarea",
      required: false,
      isCore: false,
    },
  ];
  return createForm("exit", "Study Exit Summary", "other", fields);
}

/**
 * Check if design/endpoint combination is supported for CRF generation
 */
function isSupportedDesignEndpointCombo(designId: string | undefined, endpointType: string | undefined): boolean {
  if (!designId || !endpointType) {
    return false;
  }
  
  // Supported combinations
  const supportedDesigns = [
    "rct-2arm-parallel",
    "prospective-cohort",
    "retrospective-cohort",
    "case-control",
    "cross-sectional",
    "single-arm",
    "diagnostic-accuracy"
  ];
  
  if (!supportedDesigns.includes(designId)) {
    return false;
  }
  
  // All endpoint types are supported for the above designs
  const supportedEndpointTypes = ["binary", "continuous", "time-to-event", "diagnostic", "ordinal", "count"];
  return supportedEndpointTypes.includes(endpointType);
}

export function buildCrfSchema(studySpec: StudySpec, sap: SAPPlan): CRFSchema {
  const forms: CRFForm[] = [];
  const warnings: string[] = [];

  // Check for unsupported design/endpoint combinations
  const isSupported = isSupportedDesignEndpointCombo(
    studySpec.designId,
    studySpec.primaryEndpoint?.type
  );
  
  if (studySpec.designId && studySpec.primaryEndpoint && !isSupported) {
    warnings.push(
      `Design/endpoint combination (${studySpec.designId} with ${studySpec.primaryEndpoint.type}) ` +
      `may not be fully supported. CRF forms generated are minimal safe forms. ` +
      `Consult PI/statistician for design-specific CRF requirements.`
    );
  }

  forms.push(buildScreeningForm());
  forms.push(buildBaselineForm(studySpec));

  const treatmentForm = buildTreatmentOrExposureForm(studySpec);
  if (treatmentForm) {
    forms.push(treatmentForm);
  }

  const visitForms = buildVisitForms(studySpec);
  if (visitForms.length === 0) {
    warnings.push("Endpoints are not defined; follow-up CRFs contain placeholders only.");
  } else {
    forms.push(...visitForms);
  }

  forms.push(buildSafetyForm());
  forms.push(buildDeviationForm());
  forms.push(buildExitForm());

  // Explicitly verify all primary endpoints have CRF fields
  if (studySpec.primaryEndpoint) {
    const primaryEndpointName = studySpec.primaryEndpoint.name;
    const hasPrimaryField = forms.some((form) =>
      form.fields.some((field) => field.mapsToEndpointName === primaryEndpointName)
    );
    
    if (!hasPrimaryField) {
      warnings.push(
        `CRF schema missing explicit fields for primary endpoint "${primaryEndpointName}". ` +
        `Creating fallback field.`
      );
      
      // Create a fallback field for the primary endpoint
      const fallbackFields = buildEndpointFields(studySpec.primaryEndpoint);
      if (fallbackFields.length > 0) {
        // Add to the primary outcome form if it exists, otherwise create a new form
        const primaryOutcomeForm = forms.find((f) => f.id === "primary-outcome");
        if (primaryOutcomeForm) {
          primaryOutcomeForm.fields.push(...fallbackFields);
        } else {
          // Create a dedicated form for the primary endpoint
          forms.push(
            createForm(
              "primary-endpoint-fallback",
              `Primary Endpoint: ${primaryEndpointName}`,
              "outcome",
              fallbackFields
            )
          );
        }
      }
    }
  } else {
    warnings.push("Primary endpoint is missing; align CRF outcome fields once defined.");
  }

  // Verify all secondary endpoints have fields
  for (const secondaryEndpoint of studySpec.secondaryEndpoints) {
    const hasField = forms.some((form) =>
      form.fields.some((field) => field.mapsToEndpointName === secondaryEndpoint.name)
    );
    if (!hasField) {
      warnings.push(`CRF schema does not yet map secondary endpoint "${secondaryEndpoint.name}".`);
    }
  }

  // Also check SAP endpoints for consistency
  if (sap.endpoints.length > 0) {
    for (const sapEndpoint of sap.endpoints) {
      const hasField = forms.some((form) =>
        form.fields.some((field) => field.mapsToEndpointName === sapEndpoint.endpointName)
      );
      if (!hasField) {
        warnings.push(`CRF schema does not yet map endpoint "${sapEndpoint.endpointName}" from SAP.`);
      }
    }
  }

  return { forms, warnings };
}
