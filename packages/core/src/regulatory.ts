import type {
  BaselinePackage,
  ChecklistItem,
  RegistryFieldMapping,
  RegistryMappingSheet,
  RegulatoryChecklist,
  StudySpec,
} from "./types";

function addMissing(items: ChecklistItem[], condition: boolean, partial: ChecklistItem) {
  if (!condition) {
    items.push(partial);
  }
}

export function buildRegulatoryChecklist(baseline: BaselinePackage): RegulatoryChecklist {
  const items: ChecklistItem[] = [];
  const { studySpec, protocol, sap, crf, pisIcf, registryMapping } = baseline;

  addMissing(items, Boolean(studySpec.designId), {
    id: "design-confirmed",
    label: "Study design confirmed in rulebook",
    scope: "design",
    status: "missing",
    severity: "error",
    notes: "Design classification must match Aurora rulebook before IEC/CTRI submission.",
  });

  addMissing(items, Boolean(studySpec.primaryEndpoint), {
    id: "primary-endpoint",
    label: "Primary endpoint defined",
    scope: "endpoints",
    status: "missing",
    severity: "critical",
    notes: "Primary outcome required across protocol, SAP, and CRF.",
  });

  if (sap.endpoints.length > 0) {
    items.push({
      id: "sap-primary-method",
      label: "SAP outlines primary analysis",
      scope: "sap",
      status: "ok",
      severity: "info",
    });
  } else {
    items.push({
      id: "sap-primary-method",
      label: "SAP outlines primary analysis",
      scope: "sap",
      status: "missing",
      severity: "error",
      notes: "Add deterministic endpoint plans before IEC review.",
    });
  }

  if (protocol.warnings.length > 0) {
    items.push({
      id: "protocol-warnings",
      label: "Protocol warnings present",
      scope: "protocol",
      status: "needs-review",
      severity: "warning",
      notes: protocol.warnings.join("; "),
    });
  } else {
    items.push({
      id: "protocol-warnings",
      label: "Protocol warnings present",
      scope: "protocol",
      status: "ok",
      severity: "info",
    });
  }

  if (crf.warnings.length > 0) {
    items.push({
      id: "crf-warnings",
      label: "CRF alignment",
      scope: "crf",
      status: "needs-review",
      severity: "warning",
      notes: crf.warnings.join("; "),
    });
  } else {
    items.push({
      id: "crf-warnings",
      label: "CRF alignment",
      scope: "crf",
      status: "ok",
      severity: "info",
    });
  }

  if (pisIcf.warnings.length > 0) {
    items.push({
      id: "pis-icf-warnings",
      label: "PIS/ICF completeness",
      scope: "pis-icf",
      status: "needs-review",
      severity: "warning",
      notes: pisIcf.warnings.join("; "),
    });
  } else {
    items.push({
      id: "pis-icf-warnings",
      label: "PIS/ICF completeness",
      scope: "pis-icf",
      status: "ok",
      severity: "info",
    });
  }

  const outstandingRegistry = registryMapping.fields.filter((field) => field.source === "pi-required");
  if (outstandingRegistry.length > 0) {
    items.push({
      id: "registry-pending",
      label: "Registry mapping pending PI inputs",
      scope: "registry",
      status: "needs-review",
      severity: "warning",
      notes: outstandingRegistry.map((field) => field.label).join(", "),
    });
  } else {
    items.push({
      id: "registry-pending",
      label: "Registry mapping pending PI inputs",
      scope: "registry",
      status: "ok",
      severity: "info",
    });
  }

  items.push({
    id: "draft-status",
    label: "All outputs marked as drafts",
    scope: "consistency",
    status: "ok",
    severity: "info",
    notes: "Each artifact states it requires PI and IEC review; confirm before submission.",
  });

  return { items };
}

export function buildRegistryMappingSheet(studySpec: StudySpec): RegistryMappingSheet {
  const fields: RegistryFieldMapping[] = [
    {
      fieldId: "ctri_public_title",
      label: "Public title",
      value: studySpec.title,
      source: studySpec.title ? "auto" : "pi-required",
      notes: "Use lay language; ensure matches IEC submission.",
    },
    {
      fieldId: "ctri_scientific_title",
      label: "Scientific title",
      value: studySpec.title,
      source: studySpec.title ? "auto" : "pi-required",
      notes: "Provide final scientific title once approved.",
    },
    {
      fieldId: "ctri_study_type",
      label: "Study type",
      value: studySpec.designId ? "Interventional/Observational" : undefined,
      source: studySpec.designId ? "auto" : "pi-required",
      notes: "Specify exact classification in CTRI form.",
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
      fieldId: "ctri_participant_inclusion",
      label: "Key inclusion criteria",
      source: studySpec.eligibility?.inclusion?.length ? "auto" : "pi-required",
      notes: "Summarise inclusion criteria drawn from protocol.",
    },
    {
      fieldId: "ctri_participant_exclusion",
      label: "Key exclusion criteria",
      source: studySpec.eligibility?.exclusion?.length ? "auto" : "pi-required",
      notes: "Summarise exclusion criteria drawn from protocol.",
    },
    {
      fieldId: "ctri_primary_outcome",
      label: "Primary outcome",
      value: studySpec.primaryEndpoint?.name,
      source: studySpec.primaryEndpoint ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_secondary_outcome",
      label: "Key secondary outcomes",
      value: studySpec.secondaryEndpoints.map((endpoint) => endpoint.name).join("; ") || undefined,
      source: studySpec.secondaryEndpoints.length > 0 ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_target_sample_size_india",
      label: "Target sample size (India)",
      source: "pi-required",
      notes: "Populate once sample size finalised and site list confirmed.",
    },
    {
      fieldId: "ctri_target_sample_size_global",
      label: "Target sample size (total)",
      source: "pi-required",
      notes: "Complete if multi-country; else match India target.",
    },
    {
      fieldId: "ctri_sites",
      label: "Trial sites & investigators",
      source: "pi-required",
      notes: "Provide site names, addresses, and PI details when final.",
    },
    {
      fieldId: "ctri_randomisation",
      label: "Randomisation procedure",
      value: studySpec.designId === "rct-2arm-parallel" ? "Randomised" : undefined,
      source: studySpec.designId === "rct-2arm-parallel" ? "auto" : "pi-required",
    },
    {
      fieldId: "ctri_blinding",
      label: "Blinding/masking",
      source: "pi-required",
      notes: "Indicate open-label, single-blind, etc., if applicable.",
    },
  ];

  return {
    registry: "CTRI-like",
    fields,
  };
}

