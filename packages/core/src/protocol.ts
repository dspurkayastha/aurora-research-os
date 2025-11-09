import type {
  ProtocolDraft,
  ProtocolSection,
  SAPPlan,
  SampleSizeResult,
  StudySpec,
} from "./types";

function sentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function describeBackground(spec: StudySpec): string {
  const condition = spec.condition ?? "the targeted condition";
  const population = spec.populationDescription ?? "the intended participant group";
  const setting = spec.setting ?? "clinical setting";
  return sentence(
    `The proposed study addresses ongoing gaps in evidence for ${condition} among ${population} in the ${setting}. ` +
      `Existing publications from comparable Indian centres remain limited, and a structured protocol is required to document current outcomes and improvement opportunities.`
  );
}

function describeObjectives(spec: StudySpec): string {
  const primaryObjective =
    spec.objectives?.primary?.join("; ") ||
    (spec.primaryEndpoint
      ? `Evaluate ${spec.primaryEndpoint.name} in the defined population.`
      : "Define a clear primary objective aligned with the primary endpoint.");
  const secondaryObjectives =
    spec.objectives?.secondary?.join("; ") ||
    (spec.secondaryEndpoints.length > 0
      ? `Characterise secondary outcomes including ${spec.secondaryEndpoints
          .map((e) => e.name)
          .join(", ")}.`
      : "Secondary objectives will be added after PI review.");
  return sentence(`Primary objective: ${primaryObjective} Secondary objectives: ${secondaryObjectives}`);
}

function describeDesign(spec: StudySpec): string {
  const label = spec.designLabel ?? "proposed design";
  const setting = spec.setting ?? "recruiting centres";
  const allocation =
    spec.designId === "rct-2arm-parallel"
      ? "Participants will be randomised in a 1:1 ratio with concealed allocation."
      : "Participants will be classified according to exposure or cohort status using predefined criteria.";
  const masking =
    spec.designId === "rct-2arm-parallel"
      ? "Blinding will follow site capabilities with outcome assessors masked wherever feasible."
      : "Analyses will adjust for baseline characteristics and documented confounders.";
  return sentence(`${label} conducted at ${setting}. ${allocation} ${masking}`);
}

function describePopulation(spec: StudySpec): string {
  const population = spec.populationDescription ?? "adults meeting inclusion criteria";
  const inclusion = spec.eligibility?.inclusion?.length
    ? `Key inclusion: ${spec.eligibility.inclusion.join("; ")}.`
    : "Key inclusion criteria will be confirmed during PI review.";
  const exclusion = spec.eligibility?.exclusion?.length
    ? `Key exclusion: ${spec.eligibility.exclusion.join("; ")}.`
    : "Exclusion criteria must address safety concerns and contraindications.";
  return sentence(`Target population comprises ${population}. ${inclusion} ${exclusion}`);
}

function describeProcedures(spec: StudySpec): string {
  const schedule =
    spec.visitScheduleSummary ??
    "Screening, baseline, follow-up visits, and end-of-study assessments will align with the outcome measurement schedule.";
  return sentence(
    `${schedule} Study teams will document procedures in source records and the Aurora eCRF with real-time query resolution.`
  );
}

function describeEndpoints(spec: StudySpec): string {
  const primary = spec.primaryEndpoint
    ? `${spec.primaryEndpoint.name} (${spec.primaryEndpoint.type}${spec.primaryEndpoint.timeframe ? `, assessed over ${spec.primaryEndpoint.timeframe}` : ""})`
    : "Primary endpoint pending confirmation.";
  const secondary = spec.secondaryEndpoints.length
    ? `Key secondary endpoints: ${spec.secondaryEndpoints
        .map((endpoint) => `${endpoint.name} (${endpoint.type})`)
        .join("; ")}.`
    : "Secondary endpoints to be detailed post PI-statistician review.";
  return sentence(`Primary endpoint: ${primary}. ${secondary}`);
}

function describeSampleSize(sampleSize: SampleSizeResult): string {
  if (sampleSize.status !== "ok") {
    return sentence(
      "Sample size calculation remains pending because essential assumptions are incomplete. Final numbers will be recorded once validated by the responsible statistician."
    );
  }

  const fragments: string[] = [];
  if (typeof sampleSize.totalSampleSize === "number") {
    fragments.push(`Total sample size ${sampleSize.totalSampleSize}`);
  }
  if (typeof sampleSize.perGroupSampleSize === "number") {
    fragments.push(`Per group ${sampleSize.perGroupSampleSize}`);
  }
  if (typeof sampleSize.eventsRequired === "number") {
    fragments.push(`Events required ${sampleSize.eventsRequired}`);
  }
  const assumptions: string[] = [];
  if (typeof sampleSize.assumptions.expectedControlEventRate === "number") {
    assumptions.push(
      `control event rate ${(sampleSize.assumptions.expectedControlEventRate * 100).toFixed(1)}%`
    );
  }
  if (typeof sampleSize.assumptions.expectedTreatmentEventRate === "number") {
    assumptions.push(
      `treatment event rate ${(sampleSize.assumptions.expectedTreatmentEventRate * 100).toFixed(1)}%`
    );
  }
  if (typeof sampleSize.assumptions.expectedProportion === "number") {
    assumptions.push(`expected proportion ${(sampleSize.assumptions.expectedProportion * 100).toFixed(1)}%`);
  }
  if (typeof sampleSize.assumptions.precision === "number") {
    assumptions.push(`precision target ±${sampleSize.assumptions.precision}`);
  }
  if (typeof sampleSize.assumptions.hazardRatio === "number") {
    assumptions.push(`hazard ratio ${sampleSize.assumptions.hazardRatio}`);
  }
  if (typeof sampleSize.assumptions.dropoutRate === "number") {
    assumptions.push(`dropout allowance ${(sampleSize.assumptions.dropoutRate * 100).toFixed(1)}%`);
  }
  return sentence(
    `${fragments.join(", ")} calculated using ${sampleSize.methodId ?? "validated deterministic"} method at alpha ${sampleSize.assumptions.alpha} and power ${sampleSize.assumptions.power}. ` +
      (assumptions.length ? `Assumptions include ${assumptions.join(", ")}.` : "Assumptions documented within the SAP.")
  );
}

function describeStatsOverview(sap: SAPPlan): string {
  if (sap.endpoints.length === 0) {
    return sentence(
      "Statistical methods will be confirmed by the study statistician; endpoint-specific models are pending final inputs."
    );
  }
  const primary = sap.endpoints.find((endpoint) => endpoint.role === "primary");
  const primaryText = primary
    ? `Primary analysis: ${primary.testOrModel} with ${primary.effectMeasure ?? "appropriate effect measure"}.`
    : "Primary analysis plan will be finalised by the statistician.";
  return sentence(
    `${primaryText} Secondary endpoints use methods listed in the SAP with exploratory interpretation unless multiplicity adjustments are specified.`
  );
}

function describeSafety(): string {
  return sentence(
    "All adverse events and serious adverse events will be captured in the eCRF with onset date, severity, relatedness, actions taken, and outcomes. Reporting timelines will follow CDSCO and institutional policies with immediate escalation of life-threatening events to the IEC."
  );
}

function describeDataManagement(): string {
  return sentence(
    "Source data will be transcribed into the Aurora Research OS eCRF with audit trails, edit checks, and periodic data quality reviews. Records will comply with ALCOA+ principles and be archived per institutional retention requirements."
  );
}

function describeEthics(): string {
  return sentence(
    "The sponsor and PI will submit the protocol, SAP, PIS/ICF, CRF, and risk assessments to the Institutional Ethics Committee. CTRI registration will be completed prior to first participant enrolment when applicable. No approvals are implied by this draft."
  );
}

function describeConsent(): string {
  return sentence(
    "Written informed consent will be obtained in languages understood by participants, with audio-visual recording where required by national regulations. For vulnerable participants, legally acceptable representatives and impartial witnesses will be engaged."
  );
}

function describeCompensation(): string {
  return sentence(
    "Compensation and medical care for any study-related injury will follow the institution or sponsor policy consistent with Indian GCP and ICMR guidance. The PI must document insurance or indemnity arrangements before activation."
  );
}

function describePublication(): string {
  return sentence(
    "Results will be disseminated through peer-reviewed publications and scientific meetings with authorship determined per ICMJE guidance. De-identified datasets may be shared after IEC approval and data sharing agreements."
  );
}

function draftNotice(): string {
  return sentence(
    "Draft generated by Aurora Research OS based on supplied inputs. Requires review and approval by the Principal Investigator and Ethics Committee. Not a legal or regulatory approval."
  );
}

function describeDataCollection(): string {
  return sentence(
    "Data collection instruments include structured eCRFs covering screening, baseline, follow-up, outcome, safety, and protocol deviation forms with role-based access controls."
  );
}

export function buildProtocolDraft(
  studySpec: StudySpec,
  sap: SAPPlan,
  sampleSize: SampleSizeResult
): ProtocolDraft {
  const warnings: string[] = [];

  if (!studySpec.title?.trim()) {
    warnings.push("Study title is missing; protocol draft requires PI input.");
  }
  if (!studySpec.designId) {
    warnings.push("Design classification pending; confirm before IEC submission.");
  }
  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint is undefined; objectives and analyses cannot be finalised.");
  }
  if (sampleSize.status !== "ok") {
    warnings.push("Sample size calculation is incomplete; record validated numbers before approval.");
  }
  if (sap.endpoints.length === 0) {
    warnings.push("SAP contains no endpoints; statistician review required.");
  }

  const sections: ProtocolSection[] = [
    {
      id: "general-info",
      title: "General Information",
      required: true,
      content: sentence(
        `Protocol title: ${studySpec.title ?? "to be confirmed"}. Short title: ${
          (studySpec.title ?? "").slice(0, 80) || "to be confirmed"
        }. Regulatory profile: ${studySpec.regulatoryProfileId}.`
      ),
    },
    {
      id: "background-rationale",
      title: "Background & Rationale",
      required: true,
      content: describeBackground(studySpec),
    },
    {
      id: "objectives",
      title: "Objectives",
      required: true,
      content: describeObjectives(studySpec),
    },
    {
      id: "study-design",
      title: "Study Design",
      required: true,
      content: describeDesign(studySpec),
    },
    {
      id: "population-eligibility",
      title: "Study Population & Eligibility",
      required: true,
      content: describePopulation(studySpec),
    },
    {
      id: "study-procedures",
      title: "Study Procedures & Visit Schedule",
      required: true,
      content: describeProcedures(studySpec),
    },
    {
      id: "data-collection",
      title: "Data Collection Methods & CRFs",
      required: true,
      content: describeDataCollection(),
    },
    {
      id: "endpoints",
      title: "Endpoints & Outcome Measures",
      required: true,
      content: describeEndpoints(studySpec),
    },
    {
      id: "sample-size",
      title: "Sample Size & Justification",
      required: true,
      content: describeSampleSize(sampleSize),
    },
    {
      id: "statistical-analysis",
      title: "Statistical Analysis Overview",
      required: true,
      content: describeStatsOverview(sap),
    },
    {
      id: "safety-monitoring",
      title: "Safety Monitoring & AE/SAE Reporting",
      required: true,
      content: describeSafety(),
    },
    {
      id: "data-management",
      title: "Data Management, Quality Control & Confidentiality",
      required: true,
      content: describeDataManagement(),
    },
    {
      id: "ethics-regulatory",
      title: "Ethics & Regulatory Considerations",
      required: true,
      content: describeEthics(),
    },
    {
      id: "consent-process",
      title: "Informed Consent Process",
      required: true,
      content: describeConsent(),
    },
    {
      id: "compensation",
      title: "Compensation & Medical Care for Injury",
      required: true,
      content: describeCompensation(),
    },
    {
      id: "publication",
      title: "Publication, Data Sharing & Archiving",
      required: true,
      content: describePublication(),
    },
    {
      id: "draft-status",
      title: "Draft Status Notice",
      required: true,
      content: draftNotice(),
    },
  ];

  return {
    title: studySpec.title ?? "Study protocol draft",
    shortTitle: studySpec.title?.slice(0, 80),
    versionTag: "Draft v1.0",
    sections,
    warnings,
  };
}
