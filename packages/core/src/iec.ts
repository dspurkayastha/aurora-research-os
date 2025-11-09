import type { CRFSchema, IECCoverNote, PISICFDraft, ProtocolDraft, SAPPlan, StudySpec } from "./types";

export function buildIecCoverNote(params: {
  studySpec: StudySpec;
  protocol: ProtocolDraft;
  sap: SAPPlan;
  pisIcf: PISICFDraft;
  crf: CRFSchema;
}): IECCoverNote {
  const { studySpec, protocol, sap, pisIcf, crf } = params;

  const warnings: string[] = [];
  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint not finalised; IEC summary is provisional.");
  }
  if (!studySpec.designId) {
    warnings.push("Design classification pending; confirm before IEC submission.");
  }

  const summary = `Draft protocol for ${studySpec.title} using ${
    studySpec.designLabel ?? studySpec.designId ?? "design to confirm"
  } in ${studySpec.setting ?? "the stated setting"}. Primary focus: ${
    studySpec.primaryEndpoint?.name ?? "primary endpoint pending"
  }.`;

  const designAndMethods = `Design: ${
    studySpec.designLabel ?? "to confirm"
  }. Participants: ${studySpec.populationDescription ?? "population to be detailed"}. Procedures follow protocol sections covering eligibility, visits, and data capture.`;

  const riskBenefit = `Risks will be detailed in the PIS/ICF; monitor via AE/SAE form. Benefits are ${
    studySpec.primaryEndpoint ? "potential improvements in knowledge" : "to be articulated"
  }. Compensation statements provided in consent draft.`;

  const keyEthicsHighlights = `Consent draft includes mandatory ICMR clauses, CRF captures consent confirmation, SAP uses deterministic methods, and registry mapping flags PI-required items.`;

  const attachmentsList = [
    "Protocol draft (Aurora deterministic sections)",
    "Statistical analysis plan",
    "Sample size outputs",
    "PIS/ICF clause skeleton",
    "CRF schema",
    "Regulatory checklist",
    "Registry mapping sheet",
  ];

  if (protocol.warnings.length > 0) {
    warnings.push(`Protocol warnings: ${protocol.warnings.join("; ")}`);
  }
  if (sap.warnings.length > 0) {
    warnings.push(`SAP warnings: ${sap.warnings.join("; ")}`);
  }
  if (pisIcf.warnings.length > 0) {
    warnings.push(`PIS/ICF warnings: ${pisIcf.warnings.join("; ")}`);
  }
  if (crf.warnings.length > 0) {
    warnings.push(`CRF warnings: ${crf.warnings.join("; ")}`);
  }

  return {
    title: studySpec.title,
    summary,
    designAndMethods,
    riskBenefit,
    keyEthicsHighlights,
    attachmentsList,
    warnings,
  };
}

