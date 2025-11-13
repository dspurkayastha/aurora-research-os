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

  // Enhanced type detection
  if (hintLower.includes("length of stay") || hintLower.includes("los")) {
    type = "continuous";
  } else if (hintLower.includes("time to") || hintLower.includes("survival") || hintLower.includes("duration")) {
    type = "time-to-event";
  } else if (hintLower.includes("mortality") || hintLower.includes("death")) {
    type = "binary";
  } else if (hintLower.includes("readmission")) {
    type = "binary";
  } else if (hintLower.includes("complication")) {
    type = "binary";
  } else if (hintLower.includes("infection")) {
    type = "binary";
  } else if (hintLower.includes("incidence") || hintLower.includes("prevalence") || hintLower.includes("rate")) {
    type = "binary";
  } else if (hintLower.includes("change") || hintLower.includes("improvement") || hintLower.includes("reduction")) {
    type = "continuous";
  }
  // Default to binary if type unclear - better to have an endpoint than none

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
  // Use only structured fields - never use rawIdea
  const parts: string[] = [];
  
  // Add condition if available
  if (preSpec.condition) {
    parts.push(preSpec.condition);
  }
  
  // Add primary outcome if available (more specific than generic "study")
  if (preSpec.primaryOutcomeHint) {
    parts.push(preSpec.primaryOutcomeHint);
  }
  
  // Add population if available
  if (preSpec.populationDescription) {
    parts.push(`in ${preSpec.populationDescription}`);
  }
  
  // Build title from parts
  if (parts.length === 0) {
    return "Clinical Research Study"; // Generic fallback
  }
  
  // Format: "{Condition} {Primary Outcome} Study in {Population}"
  // Or: "{Primary Outcome} Study in {Population}" if no condition
  // Or: "{Condition} Study in {Population}" if no outcome
  let title = parts.join(" ");
  
  // Add "Study" if not already present and we have meaningful content
  if (!title.toLowerCase().includes("study") && parts.length > 0) {
    // Insert "Study" before "in" if population is present, otherwise at the end
    if (preSpec.populationDescription && title.includes("in ")) {
      title = title.replace("in ", "Study in ");
    } else {
      title = `${title} Study`;
    }
  }
  
  return title.replace(/\s+/g, " ").trim();
}

/**
 * Extract value from clarifying questions for a given field.
 * Returns the answer if found, otherwise undefined.
 * Enforces precedence: clarifying answers override AI-parsed PreSpec fields.
 */
function extractFromClarifyingQuestions(
  preSpec: PreSpec,
  fieldName: string
): string | undefined {
  if (!preSpec.clarifyingQuestions) {
    return undefined;
  }
  const question = preSpec.clarifyingQuestions.find(
    (q) => q.field === fieldName && q.answer && !q.skipped
  );
  return question?.answer;
}

export function buildBaselineSpec(preSpec: PreSpec, designId: StudyDesignId | null): StudySpec {
  const availableDesigns = AURORA_RULEBOOK.studyDesigns;
  const notes: string[] = [];

  // PRECEDENCE RULE 1: Design ID - clarifying answer > AI parsing > chooseDesign()
  let resolvedDesignId: StudyDesignId | null = null;
  
  // Priority 1: Check clarifying questions
  const designFromQuestions = extractFromClarifyingQuestions(preSpec, "designId");
  if (designFromQuestions) {
    // Validate that the answer is a valid design ID
    const validDesign = availableDesigns.find((d) => d.id === designFromQuestions);
    if (validDesign) {
      resolvedDesignId = designFromQuestions as StudyDesignId;
    } else {
      notes.push(`Clarifying answer specified design "${designFromQuestions}" but it's not in rulebook.`);
    }
  }
  
  // Priority 2: Use provided designId parameter (from AI parsing or manual selection)
  if (!resolvedDesignId) {
    resolvedDesignId = designId || chooseDesign(preSpec);
  }

  // Validation: Require designId
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

  // PRECEDENCE RULE 2: Primary Endpoint - clarifying answer > AI parsing
  let primaryEndpoint: EndpointSpec | null = null;
  
  // Priority 1: Check clarifying questions
  const endpointFromQuestions = extractFromClarifyingQuestions(preSpec, "primaryOutcomeHint");
  if (endpointFromQuestions) {
    // Try to infer endpoint type from the answer
    const hintLower = endpointFromQuestions.toLowerCase();
    let type: EndpointSpec["type"] = "binary";
    if (hintLower.includes("length of stay") || hintLower.includes("los")) {
      type = "continuous";
    } else if (hintLower.includes("time to") || hintLower.includes("survival") || hintLower.includes("duration")) {
      type = "time-to-event";
    }
    
    primaryEndpoint = {
      name: endpointFromQuestions,
      type,
      role: "primary",
    };
  }
  
  // Priority 2: Use AI-parsed PreSpec (resolvePrimaryEndpoint)
  if (!primaryEndpoint) {
    primaryEndpoint = resolvePrimaryEndpoint(preSpec);
  }
  
  // Validation: Require primaryEndpoint
  if (!primaryEndpoint) {
    notes.push("Primary endpoint not clearly identified; must be defined by PI.");
  }

  // PRECEDENCE RULE 3: Condition - clarifying answer > AI parsing
  const condition = extractFromClarifyingQuestions(preSpec, "condition") || preSpec.condition;

  // PRECEDENCE RULE 4: Population Description - clarifying answer > AI parsing
  const populationDescription = extractFromClarifyingQuestions(preSpec, "populationDescription") || preSpec.populationDescription;

  // PRECEDENCE RULE 5: Group Labels - clarifying answer > AI parsing > derived
  let groupLabels: string[] | undefined;
  
  // Priority 1: Check clarifying questions
  const groupsFromQuestions = extractFromClarifyingQuestions(preSpec, "groupLabels");
  if (groupsFromQuestions) {
    groupLabels = groupsFromQuestions.split(",").map((s) => s.trim()).filter(Boolean);
  }
  
  // Priority 2: Derive from intervention/comparator for RCTs
  if (!groupLabels && resolvedDesignId === "rct-2arm-parallel") {
    if (preSpec.interventionName && preSpec.comparatorName) {
      groupLabels = [preSpec.interventionName, preSpec.comparatorName];
    }
  }
  
  // Validation: For RCT designs, require group labels or intervention/comparator
  if (resolvedDesignId === "rct-2arm-parallel") {
    const hasGroupInfo = groupLabels && groupLabels.length >= 2;
    const hasInterventionInfo = preSpec.interventionName && preSpec.comparatorName;
    if (!hasGroupInfo && !hasInterventionInfo) {
      notes.push("RCT design requires group labels or intervention/comparator names to be specified.");
    }
  }

  // PRECEDENCE RULE 6: Eligibility - clarifying answer > AI parsing (combine both)
  const eligibilityInclusion: string[] = [];
  const eligibilityExclusion: string[] = [];
  
  // Priority 1: Check clarifying questions
  const inclusionFromQuestions = extractFromClarifyingQuestions(preSpec, "eligibility.inclusion");
  if (inclusionFromQuestions) {
    eligibilityInclusion.push(...inclusionFromQuestions.split(";").map((s) => s.trim()).filter(Boolean));
  }
  const exclusionFromQuestions = extractFromClarifyingQuestions(preSpec, "eligibility.exclusion");
  if (exclusionFromQuestions) {
    eligibilityExclusion.push(...exclusionFromQuestions.split(";").map((s) => s.trim()).filter(Boolean));
  }
  
  // Priority 2: Add AI-parsed PreSpec eligibility hints (if not already present)
  if (preSpec.eligibilityHints?.inclusion) {
    for (const hint of preSpec.eligibilityHints.inclusion) {
      if (!eligibilityInclusion.includes(hint)) {
        eligibilityInclusion.push(hint);
      }
    }
  }
  if (preSpec.eligibilityHints?.exclusion) {
    for (const hint of preSpec.eligibilityHints.exclusion) {
      if (!eligibilityExclusion.includes(hint)) {
        eligibilityExclusion.push(hint);
      }
    }
  }

  // PRECEDENCE RULE 7: Selected Languages - clarifying answer > AI parsing
  let selectedLanguages: string[] | undefined;
  const languagesFromQuestions = extractFromClarifyingQuestions(preSpec, "selectedLanguages");
  if (languagesFromQuestions) {
    selectedLanguages = languagesFromQuestions.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (preSpec.selectedLanguages) {
    selectedLanguages = preSpec.selectedLanguages;
  }

  // PRECEDENCE RULE 8: Follow-up Duration - clarifying answer > primaryEndpoint.timeframe > timeframeHint
  let followUpDuration: string | undefined;
  
  // Priority 1: Check clarifying questions
  const followUpFromQuestions = extractFromClarifyingQuestions(preSpec, "followUpDuration") || 
                                 extractFromClarifyingQuestions(preSpec, "timeframe");
  if (followUpFromQuestions) {
    followUpDuration = followUpFromQuestions;
  }
  
  // Priority 2: Use primaryEndpoint.timeframe if available
  if (!followUpDuration && primaryEndpoint?.timeframe) {
    followUpDuration = primaryEndpoint.timeframe;
  }
  
  // Priority 3: Use timeframeHint from PreSpec
  if (!followUpDuration && preSpec.timeframeHint) {
    followUpDuration = preSpec.timeframeHint;
  }

  // Build secondary endpoints from PreSpec.secondaryOutcomes
  const secondaryEndpoints: EndpointSpec[] = (preSpec.secondaryOutcomes || []).map((outcome) => ({
    name: outcome,
    type: "binary", // Default type
    role: "secondary",
  }));

  const studySpec: StudySpec = {
    title: deriveTitle(preSpec),
    designId: resolvedDesignId ?? undefined,
    designLabel: designConfig?.label,
    regulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
    condition, // Use precedence-resolved value
    populationDescription, // Use precedence-resolved value
    setting: preSpec.setting,
    primaryEndpoint: primaryEndpoint ?? undefined,
    secondaryEndpoints,
    objectives: primaryEndpoint
      ? {
          primary: [`Evaluate ${primaryEndpoint.name} in the defined population.`],
          secondary: secondaryEndpoints.map((e) => `Characterise ${e.name}.`),
        }
      : { primary: [], secondary: [] },
    eligibility: {
      inclusion: eligibilityInclusion.length > 0 ? eligibilityInclusion : undefined,
      exclusion: eligibilityExclusion.length > 0 ? eligibilityExclusion : undefined,
    },
    visitScheduleSummary: followUpDuration
      ? `Planned follow-up around ${followUpDuration}.`
      : preSpec.timeframeHint
      ? `Planned follow-up around ${preSpec.timeframeHint}.`
      : undefined,
    followUpDuration, // Add explicit follow-up duration field
    notes,
    source: {
      fromRulebookVersion: AURORA_RULEBOOK.version,
    },
    // Transfer new fields
    groupLabels,
    interventionName: preSpec.interventionName,
    comparatorName: preSpec.comparatorName,
    selectedLanguages, // Use precedence-resolved value
    rawIdea: preSpec.rawIdea, // Store as metadata only
  };

  return studySpec;
}

