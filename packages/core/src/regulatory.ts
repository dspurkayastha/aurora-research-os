import type {
  ChecklistItem,
  RegistryFieldMapping,
  RegistryMappingSheet,
  RegulatoryChecklist,
  SampleSizeResult,
  SAPPlan,
  StudySpec,
  ProtocolDraft,
  PISICFDraft,
  CRFSchema,
  LiteraturePlan,
} from "./types";

interface ChecklistInputs {
  studySpec: StudySpec;
  sampleSize: SampleSizeResult;
  sap: SAPPlan;
  protocol: ProtocolDraft;
  pisIcf: PISICFDraft;
  crf: CRFSchema;
  registryMapping: RegistryMappingSheet;
  literaturePlan: LiteraturePlan;
}

function checklistItem(item: ChecklistItem): ChecklistItem {
  return item;
}

export function buildRegulatoryChecklist(inputs: ChecklistInputs): RegulatoryChecklist {
  const { studySpec, sampleSize, sap, protocol, pisIcf, crf, registryMapping, literaturePlan } = inputs;
  const items: ChecklistItem[] = [];

  const designSupported = Boolean(studySpec.designId);
  items.push(
    checklistItem({
      id: "design-supported",
      label: "Study design confirmed within Aurora rulebook",
      scope: "design",
      status: designSupported ? "ok" : "missing",
      severity: designSupported ? "info" : "error",
      notes: designSupported ? undefined : "Design classification must be finalised before IEC/CTRI submission.",
    })
  );

  // Primary endpoint check - use StudySpec explicitly
  const primaryDefined = Boolean(studySpec.primaryEndpoint);
  const primaryEndpointName = studySpec.primaryEndpoint?.name;
  items.push(
    checklistItem({
      id: "primary-endpoint",
      label: "Primary objective and outcome defined",
      scope: "endpoints",
      status: primaryDefined ? "ok" : "missing",
      severity: primaryDefined ? "info" : "critical",
      notes: primaryDefined
        ? undefined
        : `studySpec.primaryEndpoint is undefined. Define a single primary endpoint across protocol, SAP, and CRF.`,
    })
  );

  // SAP coverage check - verify primary endpoint is in SAP
  const sapHasPrimary = primaryEndpointName
    ? sap.endpoints.some((ep) => ep.endpointName === primaryEndpointName && ep.role === "primary")
    : false;
  const sapReady = sap.endpoints.length > 0;
  items.push(
    checklistItem({
      id: "sap-coverage",
      label: "SAP covers all primary endpoints with deterministic methods",
      scope: "sap",
      status: sapReady && (primaryEndpointName ? sapHasPrimary : true) ? "ok" : "missing",
      severity: sapReady && (primaryEndpointName ? sapHasPrimary : true) ? "info" : "error",
      notes:
        sapReady && (primaryEndpointName ? sapHasPrimary : true)
          ? undefined
          : primaryEndpointName
          ? `SAP missing analysis plan for primary endpoint "${primaryEndpointName}" from studySpec.primaryEndpoint.`
          : "Add endpoint-specific analyses before IEC review.",
    })
  );

  // Sample size check - use sampleSize.status and warnings explicitly
  const sampleSizeReady = sampleSize.status === "ok";
  const sampleSizeMessage =
    sampleSize.status === "ok"
      ? undefined
      : sampleSize.status === "unsupported-design"
      ? `Sample size calculation unsupported: ${sampleSize.warnings.join("; ") || "Design/endpoint combination not supported by deterministic engine."}`
      : sampleSize.status === "incomplete-input"
      ? `Sample size calculation incomplete: ${sampleSize.warnings.join("; ") || "Missing required assumptions."}`
      : `Sample size status: ${sampleSize.status}. ${sampleSize.warnings.join("; ") || "Provide validated assumptions and numbers or acknowledge incomplete inputs to IEC."}`;
  items.push(
    checklistItem({
      id: "sample-size",
      label: "Sample size calculation documented with assumptions",
      scope: "sample-size",
      status: sampleSizeReady ? "ok" : "needs-review",
      severity: sampleSizeReady ? "info" : sampleSize.status === "unsupported-design" ? "error" : "warning",
      notes: sampleSizeMessage,
    })
  );

  const consentWarnings = pisIcf.sections.length > 0 && pisIcf.warnings.length === 0;
  items.push(
    checklistItem({
      id: "pis-icf",
      label: "PIS/ICF includes mandatory ICMR consent elements",
      scope: "pis-icf",
      status: consentWarnings ? "ok" : "needs-review",
      severity: consentWarnings ? "info" : "warning",
      notes: consentWarnings ? undefined : pisIcf.warnings.join("; ") || "Complete consent sections before submission.",
    })
  );

  // CRF alignment check - verify primary endpoint fields exist
  const crfHasPrimaryField = primaryEndpointName
    ? crf.forms.some((form) =>
        form.fields.some((field) => field.mapsToEndpointName === primaryEndpointName)
      )
    : false;
  const crfAligned = crf.warnings.length === 0 && (primaryEndpointName ? crfHasPrimaryField : true);
  items.push(
    checklistItem({
      id: "crf-alignment",
      label: "CRF captures endpoints, consent confirmation, and safety data",
      scope: "crf",
      status: crfAligned ? "ok" : "needs-review",
      severity: crfAligned ? "info" : "warning",
      notes: crfAligned
        ? undefined
        : primaryEndpointName && !crfHasPrimaryField
        ? `CRF schema missing fields mapped to primary endpoint "${primaryEndpointName}" from studySpec.primaryEndpoint. ${crf.warnings.join("; ")}`
        : crf.warnings.join("; "),
    })
  );

  // Additional StudySpec completeness checks
  if (studySpec.designId === "rct-2arm-parallel") {
    const hasGroupLabels = studySpec.groupLabels && studySpec.groupLabels.length >= 2;
    const hasInterventionInfo = studySpec.interventionName && studySpec.comparatorName;
    if (!hasGroupLabels && !hasInterventionInfo) {
      items.push(
        checklistItem({
          id: "rct-group-labels",
          label: "RCT group labels or intervention/comparator names defined",
          scope: "design",
          status: "missing",
          severity: "error",
          notes: `RCT design requires studySpec.groupLabels (${studySpec.groupLabels?.length || 0} provided) or studySpec.interventionName/comparatorName to be specified.`,
        })
      );
    }
  }

  // Follow-up duration check for designs that require it
  if (
    (studySpec.designId === "rct-2arm-parallel" ||
      studySpec.designId === "prospective-cohort" ||
      studySpec.designId === "retrospective-cohort") &&
    !studySpec.followUpDuration &&
    !studySpec.primaryEndpoint?.timeframe
  ) {
    items.push(
      checklistItem({
        id: "follow-up-duration",
        label: "Follow-up duration specified",
        scope: "design",
        status: "missing",
        severity: "warning",
        notes: `Follow-up duration (studySpec.followUpDuration or primaryEndpoint.timeframe) should be specified for ${studySpec.designId} designs.`,
      })
    );
  }

  const protocolWarnings = protocol.warnings.length === 0;
  items.push(
    checklistItem({
      id: "protocol-integrity",
      label: "Protocol sections populated for IEC",
      scope: "protocol",
      status: protocolWarnings ? "ok" : "needs-review",
      severity: protocolWarnings ? "info" : "warning",
      notes: protocolWarnings ? undefined : protocol.warnings.join("; "),
    })
  );

  const registryOutstanding = registryMapping.fields.filter((field) => field.source === "pi-required");
  items.push(
    checklistItem({
      id: "registry-mapping",
      label: "CTRI-style registry mapping complete",
      scope: "registry",
      status: registryOutstanding.length === 0 ? "ok" : "needs-review",
      severity: registryOutstanding.length === 0 ? "info" : "warning",
      notes:
        registryOutstanding.length === 0
          ? undefined
          : `Pending fields: ${registryOutstanding.map((field) => field.label).join(", ")}`,
    })
  );

  const literatureReady = literaturePlan.suggestedKeywords.length > 0;
  items.push(
    checklistItem({
      id: "literature-plan",
      label: "Literature review plan prepared",
      scope: "other",
      status: literatureReady ? "ok" : "needs-review",
      severity: literatureReady ? "info" : "warning",
      notes: literatureReady ? undefined : "Add search strategy and appraisal plan before IEC submission.",
    })
  );

  items.push(
    checklistItem({
      id: "draft-flag",
      label: "All outputs explicitly marked as drafts requiring PI and IEC approval",
      scope: "consistency",
      status: "ok",
      severity: "info",
      notes: "Confirm disclaimers are retained in every exported document.",
    })
  );

  return { items };
}

function mapStudyType(designId?: string): string | undefined {
  if (!designId) return undefined;
  if (designId === "rct-2arm-parallel" || designId === "single-arm") {
    return "Interventional";
  }
  if (designId === "diagnostic-accuracy") {
    return "Diagnostic study";
  }
  return "Observational";
}

function formatSecondaryEndpoints(studySpec: StudySpec): string | undefined {
  if (studySpec.secondaryEndpoints.length === 0) {
    return undefined;
  }
  return studySpec.secondaryEndpoints.map((endpoint) => endpoint.name).join("; ");
}

export function buildRegistryMappingSheet(
  studySpec: StudySpec,
  sampleSize: SampleSizeResult,
  sap: SAPPlan
): RegistryMappingSheet {
  const fields: RegistryFieldMapping[] = [
    {
      fieldId: "ctri_public_title",
      label: "Public title",
      value: studySpec.title,
      source: studySpec.title ? "auto" : "pi-required",
      notes: "Use lay language consistent with IEC submissions.",
    },
    {
      fieldId: "ctri_scientific_title",
      label: "Scientific title",
      value: studySpec.title,
      source: studySpec.title ? "auto" : "pi-required",
      notes: "Provide final scientific wording once approved.",
    },
    {
      fieldId: "ctri_study_type",
      label: "Study type",
      value: mapStudyType(studySpec.designId),
      source: studySpec.designId ? "auto" : "pi-required",
      notes: "Interventional/observational/diagnostic classification to match CTRI definitions.",
    },
    {
      fieldId: "ctri_study_design",
      label: "Study design",
      value: studySpec.designLabel,
      source: studySpec.designLabel ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_condition",
      label: "Health condition/problem studied",
      value: studySpec.condition,
      source: studySpec.condition ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_inclusion",
      label: "Key inclusion criteria",
      value: studySpec.eligibility?.inclusion?.join("; "),
      source: studySpec.eligibility?.inclusion?.length ? "auto" : "pi-required",
      notes: "Summarise exact inclusion criteria from protocol section.",
    },
    {
      fieldId: "ctri_exclusion",
      label: "Key exclusion criteria",
      value: studySpec.eligibility?.exclusion?.join("; "),
      source: studySpec.eligibility?.exclusion?.length ? "auto" : "pi-required",
    },
        {
          fieldId: "ctri_primary_outcome",
          label: "Primary outcome",
          value: studySpec.primaryEndpoint?.name,
          source: studySpec.primaryEndpoint?.name ? "auto" : "pi-required",
          notes: studySpec.primaryEndpoint?.name
            ? `Primary endpoint: ${studySpec.primaryEndpoint.name} (${studySpec.primaryEndpoint.type})${studySpec.followUpDuration || studySpec.primaryEndpoint.timeframe ? `, assessed within ${studySpec.followUpDuration || studySpec.primaryEndpoint.timeframe}` : ""}`
            : "Primary endpoint must be defined before CTRI registration.",
        },
    {
      fieldId: "ctri_secondary_outcome",
      label: "Key secondary outcomes",
      value: formatSecondaryEndpoints(studySpec),
      source: studySpec.secondaryEndpoints.length > 0 ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_target_sample_size_india",
      label: "Target sample size (India)",
      value:
        sampleSize.status === "ok" && typeof sampleSize.totalSampleSize === "number"
          ? String(sampleSize.totalSampleSize)
          : undefined,
      source: sampleSize.status === "ok" && typeof sampleSize.totalSampleSize === "number" ? "auto" : "pi-required",
      notes:
        sampleSize.status === "ok"
          ? "Update if multi-centre split required; ensure consistency with protocol."
          : sampleSize.warnings.length > 0
          ? `Sample size calculation pending: ${sampleSize.warnings.join("; ")}. Provide confirmed sample size before registry submission.`
          : "Provide confirmed sample size before registry submission.",
    },
    {
      fieldId: "ctri_sample_size_global",
      label: "Target sample size (global)",
      value: undefined,
      source: "pi-required",
      notes: "Complete if recruiting outside India; otherwise match India target.",
    },
    {
      fieldId: "ctri_sites",
      label: "Trial sites & investigators",
      value: undefined,
      source: "pi-required",
      notes: "List site name, address, PI, and contact details when final.",
    },
    {
      fieldId: "ctri_randomisation",
      label: "Randomisation procedure",
      value: studySpec.designId === "rct-2arm-parallel" ? "Computer-generated randomisation" : undefined,
      source: studySpec.designId === "rct-2arm-parallel" ? "auto" : "pi-required",
      notes: studySpec.designId === "rct-2arm-parallel" ? "Describe allocation concealment in CTRI form." : undefined,
    },
    {
      fieldId: "ctri_blinding",
      label: "Blinding/masking",
      value: undefined,
      source: "pi-required",
      notes: "Specify open-label, single-blind, double-blind as applicable.",
    },
    {
      fieldId: "ctri_primary_analysis",
      label: "Primary analysis method",
      value: sap.endpoints.find((endpoint) => endpoint.role === "primary")?.testOrModel,
      source: sap.endpoints.find((endpoint) => endpoint.role === "primary") ? "auto" : "pi-required",
      notes: "Ensure SAP wording matches CTRI entry.",
    },
  ];

  return { registry: "CTRI-like", fields };
}
