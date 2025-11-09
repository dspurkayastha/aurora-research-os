import type { StudyDesignId as RulebookStudyDesignId } from "./rulebook";

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

export interface EndpointSpec {
  name: string;
  type: "binary" | "continuous" | "time-to-event" | "ordinal" | "count" | "diagnostic";
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
