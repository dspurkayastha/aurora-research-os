import type {
  StatsMethodId,
  StudyDesignId as RulebookStudyDesignId,
} from "./rulebook";

export type ValidationSeverity = "info" | "warning" | "error" | "critical";

export type ValidationScope =
  | "design"
  | "endpoints"
  | "sample-size"
  | "sap"
  | "crf"
  | "pis-icf"
  | "protocol"
  | "regulatory"
  | "registry"
  | "ethics"
  | "safety"
  | "consistency"
  | "other";

export interface ValidationIssue {
  code: string;
  scope: ValidationScope;
  severity: ValidationSeverity;
  message: string;
  acknowledged?: boolean;
}

export interface PreSpec {
  rawIdea: string;
  condition?: string;
  populationDescription?: string;
  setting?: string;
  primaryOutcomeHint?: string;
  timeframeHint?: string;
  isRetrospectiveHint?: boolean;
  isDiagnosticHint?: boolean;
  mentionsInterventionOrComparison?: boolean;
}

export type StudyDesignId = RulebookStudyDesignId;

export type HypothesisType =
  | "superiority"
  | "noninferiority"
  | "equivalence"
  | "estimation";

export type EndpointType =
  | "binary"
  | "continuous"
  | "time-to-event"
  | "ordinal"
  | "count"
  | "diagnostic";

export interface EndpointSpec {
  name: string;
  type: EndpointType;
  role: "primary" | "secondary" | "exploratory";
  timeframe?: string;
  notes?: string;
}

export interface StudySpec {
  id?: string;
  title: string;
  designId?: StudyDesignId;
  designLabel?: string;
  condition?: string;
  setting?: string;
  populationDescription?: string;
  primaryEndpoint?: EndpointSpec | null;
  secondaryEndpoints: EndpointSpec[];
  objectives?: {
    primary?: string[];
    secondary?: string[];
  };
  eligibility?: {
    inclusion?: string[];
    exclusion?: string[];
  };
  visitScheduleSummary?: string;
  regulatoryProfileId: string;
  notes: string[];
  source: { fromRulebookVersion: string };
}

export interface SampleSizeAssumptionsBase {
  alpha: number;
  power: number;
  twoSided: boolean;
  hypothesisType: HypothesisType;
  designId: StudyDesignId;
  primaryEndpointType: EndpointType;
  expectedControlEventRate?: number;
  expectedTreatmentEventRate?: number;
  expectedMeanControl?: number;
  expectedMeanTreatment?: number;
  assumedSD?: number;
  expectedProportion?: number;
  hazardRatio?: number;
  eventProportionDuringFollowUp?: number;
  precision?: number;
  dropoutRate?: number;
  clusterDesignEffect?: number;
  caseControlRatio?: number;
  exposurePrevInControls?: number;
  targetMetric?: "sensitivity" | "specificity" | "both";
  expectedSensitivity?: number;
  expectedSpecificity?: number;
  notes?: string[];
}

export interface TwoProportionsAssumptions extends SampleSizeAssumptionsBase {
  expectedControlEventRate: number;
  expectedTreatmentEventRate: number;
}

export interface TwoMeansAssumptions extends SampleSizeAssumptionsBase {
  expectedMeanControl: number;
  expectedMeanTreatment: number;
  assumedSD: number;
}

export interface SingleProportionAssumptions extends SampleSizeAssumptionsBase {
  expectedProportion: number;
  precision: number;
}

export interface TimeToEventAssumptions extends SampleSizeAssumptionsBase {
  hazardRatio: number;
  eventProportionDuringFollowUp?: number;
}

export interface DiagnosticAccuracyAssumptions extends SampleSizeAssumptionsBase {
  targetMetric: "sensitivity" | "specificity" | "both";
  expectedSensitivity?: number;
  expectedSpecificity?: number;
  precision: number;
}

export interface CaseControlAssumptions extends SampleSizeAssumptionsBase {
  caseControlRatio?: number;
  exposurePrevInControls?: number;
  expectedTreatmentEventRate?: number;
}

export type SampleSizeStatus =
  | "ok"
  | "incomplete-input"
  | "unsupported-design"
  | "invalid-input";

export interface SampleSizeResult {
  status: SampleSizeStatus;
  methodId?: StatsMethodId;
  description?: string;
  totalSampleSize?: number;
  perGroupSampleSize?: number;
  eventsRequired?: number;
  casesRequired?: number;
  controlsRequired?: number;
  assumptions: SampleSizeAssumptionsBase;
  warnings: string[];
  notes: string[];
}

export interface StatsExplanation {
  sampleSizeSummary: string;
  analysisSummary: string;
  assumptionSummary: string;
  caveats: string[];
}

export interface ProtocolSection {
  id: string;
  title: string;
  required: boolean;
  content: string;
}

export interface ProtocolDraft {
  title: string;
  shortTitle?: string;
  versionTag: string;
  sections: ProtocolSection[];
  warnings: string[];
}

export interface SAPEndpointPlan {
  endpointName: string;
  role: "primary" | "key-secondary" | "secondary";
  type: EndpointType;
  estimand?: string;
  hypothesis?: string;
  alphaAllocation?: number;
  testOrModel: string;
  effectMeasure?: string;
  covariates?: string[];
  missingDataApproach?: string;
  notes?: string;
}

export interface SAPPlan {
  analysisSets: {
    fullAnalysisSet: string;
    perProtocolSet?: string;
    safetySet?: string;
  };
  endpoints: SAPEndpointPlan[];
  multiplicity: string;
  interimAnalysis: string;
  subgroupAnalyses: string;
  sensitivityAnalyses: string;
  missingDataGeneral: string;
  software: string;
  warnings: string[];
}

export type CRFFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea";

export interface CRFField {
  id: string;
  label: string;
  type: CRFFieldType;
  required: boolean;
  mapsToEndpointName?: string;
  isCore: boolean;
  options?: string[];
  unit?: string;
  notes?: string;
}

export type CRFFormPurpose =
  | "screening"
  | "baseline"
  | "treatment"
  | "followup"
  | "outcome"
  | "ae-safety"
  | "other";

export interface CRFForm {
  id: string;
  name: string;
  visitLabel?: string;
  purpose: CRFFormPurpose;
  fields: CRFField[];
}

export interface CRFSchema {
  forms: CRFForm[];
  warnings: string[];
}

export type PisIcfClauseCategory =
  | "intro"
  | "purpose"
  | "procedures"
  | "risks"
  | "benefits"
  | "alternatives"
  | "confidentiality"
  | "compensation_injury"
  | "voluntary_right_to_withdraw"
  | "data_use_future"
  | "contacts"
  | "vulnerable_populations"
  | "misc";

export interface PISICFSection {
  id: string;
  title: string;
  required: boolean;
  content: string;
}

export interface PISICFDraft {
  sections: PISICFSection[];
  warnings: string[];
}

export interface IECCoverNote {
  title: string;
  summary: string;
  designAndMethods: string;
  riskBenefit: string;
  keyEthicsHighlights: string;
  attachmentsList: string[];
  warnings: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  scope: ValidationScope;
  status: "ok" | "missing" | "needs-review";
  severity: ValidationSeverity;
  notes?: string;
}

export interface RegulatoryChecklist {
  items: ChecklistItem[];
}

export interface RegistryFieldMapping {
  fieldId: string;
  label: string;
  value?: string;
  source: "auto" | "pi-required";
  notes?: string;
}

export interface RegistryMappingSheet {
  registry: "CTRI-like";
  fields: RegistryFieldMapping[];
}

export interface LiteraturePlan {
  picoSummary: string;
  suggestedKeywords: string[];
  notes: string[];
}

export interface BaselineVersionInfo {
  rulebookProfile: string;
  rulebookVersion: string;
  generatedAt: string;
}

export interface BaselinePackage {
  studySpec: StudySpec;
  sampleSize: SampleSizeResult;
  sap: SAPPlan;
  protocol: ProtocolDraft;
  crf: CRFSchema;
  pisIcf: PISICFDraft;
  iecCoverNote: IECCoverNote;
  regulatoryChecklist: RegulatoryChecklist;
  registryMapping: RegistryMappingSheet;
  literaturePlan: LiteraturePlan;
  sapExplanation: StatsExplanation;
  issues: ValidationIssue[];
  disclaimer: string;
  versionInfo: BaselineVersionInfo;
}

export type BaselineBuildResult = BaselinePackage;