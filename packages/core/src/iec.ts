import type {
  CRFSchema,
  IECCoverNote,
  PISICFDraft,
  ProtocolDraft,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

export function buildIecCoverNote(params: {
  studySpec: StudySpec;
  protocol: ProtocolDraft;
  sap: SAPPlan;
  pisIcf: PISICFDraft;
  crf: CRFSchema;
  sampleSize: SampleSizeResult;
}): IECCoverNote {
  const { studySpec, protocol, sap, pisIcf, crf, sampleSize } = params;

  const warnings: string[] = [];
  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint pending; IEC cover note requires update once confirmed.");
  }
  if (!studySpec.designId) {
    warnings.push("Design classification is provisional; confirm before submission.");
  }
  if (sampleSize.status !== "ok") {
    warnings.push("Sample size not final; provide validated calculations to IEC.");
  }

  const designLabel = studySpec.designLabel ?? studySpec.designId ?? "design to confirm";
  const setting = studySpec.setting ?? "the participating institution";
  const population = studySpec.populationDescription ?? "eligible participants";
  const primaryEndpoint = studySpec.primaryEndpoint?.name ?? "primary outcome to be defined";

  const sampleSizeSummary =
    sampleSize.status === "ok"
      ? `Deterministic calculation indicates ${sampleSize.totalSampleSize ?? "N"} participants (per group ${
          sampleSize.perGroupSampleSize ?? "n/a"
        }) at alpha ${sampleSize.assumptions.alpha} and power ${sampleSize.assumptions.power}.`
      : "Sample size assumptions are being refined with the statistician; draft values not provided.";

  return {
    title: studySpec.title ?? "IEC submission draft",
    summary: `Draft protocol for ${studySpec.title ?? "the study"} using a ${designLabel} conducted at ${setting}. The study focuses on ${primaryEndpoint} among ${population}.`,
    designAndMethods: `Participants: ${population}. Design overview: ${designLabel}. Key procedures follow protocol sections on screening, study visits, data capture in the Aurora eCRF, and oversight of protocol deviations. ${sampleSizeSummary}`,
    riskBenefit: `Risks include procedure-related discomforts and data privacy considerations; mitigation is described in safety monitoring plans and the adverse event reporting CRF. Potential benefit is advancement of knowledge for ${
      studySpec.condition ?? "the condition of interest"
    }, with no guaranteed therapeutic benefit to participants.`,
    keyEthicsHighlights: `Informed consent draft covers all ICMR-required clauses, compensation language, and future data use options. SAP provides deterministic analyses linked to the CRF and protocol outcomes. Registry mapping identifies PI-completed fields prior to CTRI entry.`,
    attachmentsList: [
      "Protocol draft",
      "Sample size and SAP outputs",
      "PIS/ICF draft",
      "CRF schema",
      "Regulatory checklist",
      "CTRI-style registry mapping",
      "Literature plan summary",
    ],
    warnings: [
      ...warnings,
      ...protocol.warnings.map((w) => `Protocol: ${w}`),
      ...sap.warnings.map((w) => `SAP: ${w}`),
      ...pisIcf.warnings.map((w) => `PIS/ICF: ${w}`),
      ...crf.warnings.map((w) => `CRF: ${w}`),
    ],
  };
}
