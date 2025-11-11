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
 * Helper function to safely parse JSON response
 */
async function safeJsonParse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type");
  
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error(
        `API server returned an HTML page instead of JSON. This usually means:\n` +
        `1. The API server is not running (check http://localhost:3001)\n` +
        `2. The endpoint doesn't exist (404 error)\n` +
        `3. There's a server error (500 error)\n\n` +
        `Please ensure the API server is running and accessible.`
      );
    }
    throw new Error(`Expected JSON but received ${contentType}. Response: ${text.substring(0, 200)}`);
  }
  
  return response.json();
}

/**
 * Check AI availability
 */
export async function checkAIAvailability(): Promise<AIStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/llm/status`);
    if (!response.ok) {
      try {
        const errorData = await safeJsonParse(response);
        return { 
          available: false, 
          reason: errorData.details || errorData.error || `API returned ${response.status}` 
        };
      } catch (parseError) {
        return { 
          available: false, 
          reason: `API server error (${response.status}). Please check if the API server is running at ${API_BASE_URL}` 
        };
      }
    }
    const data = await safeJsonParse(response);
    return data as AIStatus;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        available: false,
        reason: `Cannot connect to API server at ${API_BASE_URL}. Please ensure the API server is running.`,
      };
    }
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
  try {
    const response = await fetch(`${API_BASE_URL}/llm/parse-idea`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });

    if (!response.ok) {
      try {
        const error = await safeJsonParse(response);
        throw new Error(error.details || error.error || `AI parsing failed (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes("HTML page")) {
          throw parseError;
        }
        throw new Error(
          `Failed to parse study idea. API server returned ${response.status}. ` +
          `Please ensure the API server is running at ${API_BASE_URL}`
        );
      }
    }

    return await safeJsonParse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to API server at ${API_BASE_URL}. ` +
        `Please ensure the API server is running and accessible.`
      );
    }
    throw error;
  }
}

/**
 * Select study design with AI (MANDATORY)
 */
export async function selectDesignWithAI(
  preSpec: PreSpec,
  idea: string
): Promise<DesignSelectionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/llm/select-design`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preSpec, idea }),
    });

    if (!response.ok) {
      try {
        const error = await safeJsonParse(response);
        throw new Error(error.details || error.error || `AI design selection failed (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes("HTML page")) {
          throw parseError;
        }
        throw new Error(
          `Failed to select study design. API server returned ${response.status}. ` +
          `Please ensure the API server is running at ${API_BASE_URL}`
        );
      }
    }

    return await safeJsonParse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to API server at ${API_BASE_URL}. ` +
        `Please ensure the API server is running and accessible.`
      );
    }
    throw error;
  }
}

/**
 * Get clarifying questions based on parsed PreSpec
 */
export async function getClarifyingQuestions(preSpec: PreSpec, idea: string): Promise<Array<{
  id: string;
  question: string;
  priority: "critical" | "important" | "optional";
  field?: string;
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/llm/generate-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preSpec, idea }),
    });

    if (!response.ok) {
      try {
        const error = await safeJsonParse(response);
        throw new Error(error.details || error.error || `Failed to generate clarifying questions (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes("HTML page")) {
          throw parseError;
        }
        throw new Error(
          `Failed to generate clarifying questions. API server returned ${response.status}. ` +
          `Please ensure the API server is running at ${API_BASE_URL}`
        );
      }
    }

    const data = await safeJsonParse(response);
    return data.questions || [];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to API server at ${API_BASE_URL}. ` +
        `Please ensure the API server is running and accessible.`
      );
    }
    throw error;
  }
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
  try {
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
      try {
        const error = await safeJsonParse(response);
        throw new Error(error.details || error.error || `AI generation failed (${response.status})`);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message.includes("HTML page")) {
          throw parseError;
        }
        throw new Error(
          `Failed to generate content. API server returned ${response.status}. ` +
          `Please ensure the API server is running at ${API_BASE_URL}`
        );
      }
    }

    const data = await safeJsonParse(response);
    return data.content || data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Cannot connect to API server at ${API_BASE_URL}. ` +
        `Please ensure the API server is running and accessible.`
      );
    }
    throw error;
  }
}

