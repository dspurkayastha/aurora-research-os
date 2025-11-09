import { AURORA_RULEBOOK } from "./rulebook";
import type {
  EndpointSpec,
  PreSpec,
  StudyDesignId,
  StudySpec,
} from "./types";

const POPULATION_KEYWORDS = [
  "patients",
  "adults",
  "children",
  "pediatric",
  "elderly",
  "icu",
  "intensive care",
  "emergency",
  "opd",
  "outpatient",
  "inpatient",
  "ward",
  "clinic",
  "tertiary",
  "hospital",
];

const SETTING_KEYWORDS = [
  "icu",
  "intensive care",
  "emergency",
  "opd",
  "outpatient",
  "inpatient",
  "tertiary care hospital",
  "tertiary hospital",
  "teaching hospital",
  "district hospital",
  "private hospital",
  "government hospital",
];

const PRIMARY_OUTCOME_KEYWORDS = [
  "mortality",
  "death",
  "complication",
  "complications",
  "length of stay",
  "readmission",
  "infection",
  "functional outcome",
  "functional outcomes",
];

const TIMEFRAME_KEYWORDS = [
  "30-day",
  "90-day",
  "60-day",
  "7-day",
  "14-day",
  "in-hospital",
  "in hospital",
  "1-year",
  "one-year",
  "12-month",
  "6-month",
  "six-month",
  "3-month",
  "three-month",
  "18-month",
];

const RETROSPECTIVE_KEYWORDS = [
  "retrospective",
  "chart review",
  "past",
  "previous",
  "existing records",
  "medical records",
  "record review",
  "database review",
];

const DIAGNOSTIC_KEYWORDS = [
  "sensitivity",
  "specificity",
  "roc",
  "auc",
  "diagnostic accuracy",
  "gold standard",
  "likelihood ratio",
  "predictive value",
];

const INTERVENTION_KEYWORDS = [
  "compare",
  "versus",
  "vs",
  "randomize",
  "randomise",
  "randomized",
  "randomised",
  "treatment arm",
  "intervention arm",
  "control group",
  "placebo",
  "two arms",
  "arm a",
  "arm b",
];

const SENTENCE_SPLIT_REGEX = /[.!?]+/;

function findFirstMatch(original: string, pattern: RegExp): string | undefined {
  const match = original.match(pattern);
  if (!match) {
    return undefined;
  }
  return (match[1] ?? match[0]).trim();
}

function findSentenceWithKeywords(original: string, keywords: string[]): string | undefined {
  const sentences = original
    .split(SENTENCE_SPLIT_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const lowerSentences = sentences.map((segment) => segment.toLowerCase());

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerSentences.findIndex((sentence) => sentence.includes(lowerKeyword));
    if (index !== -1) {
      return sentences[index];
    }
  }

  return undefined;
}

function findKeyword(original: string, keywords: string[]): string | undefined {
  const lower = original.toLowerCase();
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      return original.slice(idx, idx + keyword.length);
    }
  }
  return undefined;
}

export function parseIdeaToPreSpec(rawIdea: string): PreSpec {
  const trimmedIdea = rawIdea.trim();
  const preSpec: PreSpec = { rawIdea: trimmedIdea };

  if (!trimmedIdea) {
    return preSpec;
  }

  const condition = findFirstMatch(
    trimmedIdea,
    /(?:patients|subjects|individuals)\s+with\s+([a-z0-9\-(),\s]+)/i
  );

  if (condition) {
    preSpec.condition = condition.replace(/^(a|an|the)\s+/i, "").replace(/[.,;]+$/, "").trim();
  }

  const populationSentence = findSentenceWithKeywords(trimmedIdea, POPULATION_KEYWORDS);
  if (populationSentence) {
    preSpec.populationDescription = populationSentence.replace(/[.,;]+$/, "").trim();
  }

  const settingMatch = findKeyword(trimmedIdea, SETTING_KEYWORDS);
  if (settingMatch) {
    preSpec.setting = settingMatch.replace(/[.,;]+$/, "").trim();
  }

  const outcomeSentence = findSentenceWithKeywords(trimmedIdea, PRIMARY_OUTCOME_KEYWORDS);
  if (outcomeSentence) {
    preSpec.primaryOutcomeHint = outcomeSentence.replace(/[.,;]+$/, "").trim();
  }

  const timeframeMatch = findKeyword(trimmedIdea, TIMEFRAME_KEYWORDS);
  if (timeframeMatch) {
    preSpec.timeframeHint = timeframeMatch.trim();
  }

  const lowerIdea = trimmedIdea.toLowerCase();

  preSpec.isRetrospectiveHint = RETROSPECTIVE_KEYWORDS.some((keyword) => lowerIdea.includes(keyword));
  preSpec.isDiagnosticHint = DIAGNOSTIC_KEYWORDS.some((keyword) => lowerIdea.includes(keyword));
  preSpec.mentionsInterventionOrComparison = INTERVENTION_KEYWORDS.some((keyword) =>
    lowerIdea.includes(keyword)
  );

  return preSpec;
}

export function chooseDesign(preSpec: PreSpec): StudyDesignId | null {
  const availableDesigns = AURORA_RULEBOOK.studyDesigns;
  const hasDesign = (id: StudyDesignId) => availableDesigns.some((design) => design.id === id);

  if (preSpec.isDiagnosticHint && hasDesign("diagnostic-accuracy")) {
    return "diagnostic-accuracy";
  }

  if (preSpec.mentionsInterventionOrComparison) {
    if (!preSpec.isRetrospectiveHint && hasDesign("rct-2arm-parallel")) {
      return "rct-2arm-parallel";
    }
    if (preSpec.isRetrospectiveHint && hasDesign("retrospective-cohort")) {
      return "retrospective-cohort";
    }
  }

  if (preSpec.isRetrospectiveHint && hasDesign("retrospective-cohort")) {
    return "retrospective-cohort";
  }

  const ideaLower = preSpec.rawIdea.toLowerCase();

  if (
    (ideaLower.includes("prevalence") ||
      ideaLower.includes("cross-sectional") ||
      ideaLower.includes("single visit") ||
      ideaLower.includes("survey")) &&
    hasDesign("cross-sectional")
  ) {
    return "cross-sectional";
  }

  if (hasDesign("prospective-cohort")) {
    return "prospective-cohort";
  }

  return null;
}

function resolvePrimaryEndpoint(preSpec: PreSpec): EndpointSpec | null {
  if (!preSpec.primaryOutcomeHint) {
    return null;
  }

  const hintLower = preSpec.primaryOutcomeHint.toLowerCase();
  let type: EndpointSpec["type"] = "binary";

  if (hintLower.includes("length of stay")) {
    type = "continuous";
  } else if (hintLower.includes("time to")) {
    type = "time-to-event";
  } else if (hintLower.includes("mortality") || hintLower.includes("death")) {
    type = "binary";
  } else if (hintLower.includes("readmission")) {
    type = "binary";
  } else if (hintLower.includes("complication")) {
    type = "binary";
  } else if (hintLower.includes("infection")) {
    type = "binary";
  }

  const endpoint: EndpointSpec = {
    name: preSpec.primaryOutcomeHint,
    type,
    role: "primary",
  };

  if (preSpec.timeframeHint) {
    endpoint.timeframe = preSpec.timeframeHint;
  }

  return endpoint;
}

function deriveTitle(preSpec: PreSpec): string {
  const condition = preSpec.condition || "clinical outcomes";
  const population = preSpec.populationDescription || "the target population";
  return `Study on ${condition} in ${population}`.replace(/\s+/g, " ").trim();
}

export function buildBaselineSpec(preSpec: PreSpec, designId: StudyDesignId | null): StudySpec {
  const availableDesigns = AURORA_RULEBOOK.studyDesigns;
  let resolvedDesignId = designId || chooseDesign(preSpec);
  const notes: string[] = [];

  if (!resolvedDesignId) {
    notes.push("Design selection uncertain; requires human review.");
  }

  const designConfig = resolvedDesignId
    ? availableDesigns.find((design) => design.id === resolvedDesignId)
    : undefined;

  if (resolvedDesignId && !designConfig) {
    notes.push("Selected design not in rulebook; requires reclassification by PI.");
    resolvedDesignId = null;
  }

  if (resolvedDesignId === "rct-2arm-parallel" && !preSpec.mentionsInterventionOrComparison) {
    notes.push("RCT selected; confirm there is a true intervention/comparator and feasibility of randomization.");
  }

  if (resolvedDesignId === "diagnostic-accuracy") {
    notes.push("Diagnostic accuracy design; ensure index test and reference standard are clearly specified.");
  }

  const primaryEndpoint = resolvePrimaryEndpoint(preSpec);
  if (!primaryEndpoint) {
    notes.push("Primary endpoint not clearly identified; must be defined by PI.");
  }

  const studySpec: StudySpec = {
    title: deriveTitle(preSpec),
    designId: resolvedDesignId ?? undefined,
    designLabel: designConfig?.label,
    regulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
    condition: preSpec.condition,
    populationDescription: preSpec.populationDescription,
    setting: preSpec.setting,
    primaryEndpoint: primaryEndpoint ?? undefined,
    secondaryEndpoints: [],
    objectives: primaryEndpoint
      ? {
          primary: [`Evaluate ${primaryEndpoint.name} in the defined population.`],
          secondary: [],
        }
      : { primary: [], secondary: [] },
    eligibility: {
      inclusion: [],
      exclusion: [],
    },
    visitScheduleSummary: preSpec.timeframeHint
      ? `Planned follow-up around ${preSpec.timeframeHint}.`
      : undefined,
    notes,
    source: {
      fromRulebookVersion: AURORA_RULEBOOK.version,
    },
  };

  return studySpec;
}

