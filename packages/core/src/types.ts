import type {
  StatsMethodId,
  StudyDesignId as RulebookStudyDesignId
} from "./rulebook";

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

export type HypothesisType = "superiority" | "noninferiority" | "equivalence" | "estimation";

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
  role: "primary" | "secondary";
  timeframe?: string;
  notes?: string;
}

export interface StudySpec {
  id?: string;
  title: string;
  designId: StudyDesignId;
  designLabel: string;
  regulatoryProfileId: string;
  condition?: string;
  populationDescription?: string;
  setting?: string;
  primaryEndpoint: EndpointSpec | null;
  secondaryEndpoints: EndpointSpec[];
  isAdvancedDesign: boolean;
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

export interface SAPAnalysisStep {
  label: string;
  population: "full" | "per-protocol" | "safety" | "not-applicable";
  endpointRole: "primary" | "secondary";
  endpointName: string;
  testOrModel: string;
  effectMeasure?: string;
  adjusted?: boolean;
  notes?: string;
}

export interface SAPPlan {
  primaryMethodId?: StatsMethodId;
  steps: SAPAnalysisStep[];
  multiplicityHandling?: string;
  missingDataHandling?: string;
  software?: string;
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
  dependsOn?: string[];
  contentTemplate: string;
}

export interface ProtocolDraft {
  studyId?: string;
  title: string;
  designId: StudyDesignId;
  sections: ProtocolSection[];
  warnings: string[];
}

export type CrfFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea";

export interface CrfField {
  id: string;
  label: string;
  type: CrfFieldType;
  required: boolean;
  options?: string[];
  unit?: string;
  notes?: string;
  core?: boolean;
}

export interface CrfForm {
  id: string;
  title: string;
  visitLabel?: string;
  fields: CrfField[];
}

export interface CrfSchema {
  studyId?: string;
  forms: CrfForm[];
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

export interface PisIcfClause {
  id: string;
  category: PisIcfClauseCategory;
  required: boolean;
  contentTemplate: string;
}

export interface PisIcfDraft {
  studyId?: string;
  language: "en";
  clauses: PisIcfClause[];
  warnings: string[];
}

export type RegulatoryTarget = "CTRI" | "IEC" | "ICMR" | "LOCAL";

export interface RegulatoryFieldMapping {
  target: RegulatoryTarget;
  fieldId: string;
  label: string;
  required: boolean;
  sourceHint?: string;
}

export interface RegulatoryChecklist {
  studyId?: string;
  mappings: RegulatoryFieldMapping[];
  missing: string[];
  warnings: string[];
}

export interface LiteratureQuestion {
  id: string;
  label: string;
  description: string;
}

export interface LiteraturePlan {
  studyId?: string;
  questions: LiteratureQuestion[];
  suggestedKeywords: string[];
  tableTemplate: string[];
  warnings: string[];
}
