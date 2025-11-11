/**
 * AI Service Client
 * Handles all AI-related API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface AIStatus {
  available: boolean;
  reason?: string;
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

export interface DesignSelectionResult {
  designId: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Check AI availability
 */
export async function checkAIAvailability(): Promise<AIStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/llm/status`);
    if (!response.ok) {
      return { available: false, reason: `API returned ${response.status}` };
    }
    const data = await response.json();
    return data as AIStatus;
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Parse study idea with AI (MANDATORY)
 */
export async function parseIdeaWithAI(idea: string): Promise<PreSpec> {
  const response = await fetch(`${API_BASE_URL}/llm/parse-idea`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || "AI parsing failed");
  }

  return response.json();
}

/**
 * Select study design with AI (MANDATORY)
 */
export async function selectDesignWithAI(
  preSpec: PreSpec,
  idea: string
): Promise<DesignSelectionResult> {
  const response = await fetch(`${API_BASE_URL}/llm/select-design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preSpec, idea }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || "AI design selection failed");
  }

  return response.json();
}

/**
 * Generate AI-enhanced content
 */
export async function generateContent(
  type: "protocol-section" | "pis-icf" | "iec-cover-note" | "translate-pis-icf" | "enhance-crf-layout",
  studySpec: any,
  options?: {
    baseline?: any;
    section?: string;
    existingContent?: string;
    targetLanguage?: string;
    currentCRFStructure?: string;
  }
): Promise<string | { layoutSuggestions: string; fieldRecommendations: Array<{ field: string; rationale: string }> }> {
  const response = await fetch(`${API_BASE_URL}/llm/generate-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      studySpec,
      baseline: options?.baseline,
      section: options?.section,
      existingContent: options?.existingContent,
      targetLanguage: options?.targetLanguage,
      currentCRFStructure: options?.currentCRFStructure,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || "AI generation failed");
  }

  const data = await response.json();
  return data.content || data;
}

