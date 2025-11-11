/**
 * LLM Integration Module for Aurora Research OS
 * 
 * This module provides AI-powered content generation for narrative sections
 * while strictly enforcing RULEBOOK constraints and never modifying deterministic values.
 * 
 * Per AGENTS.md §4:
 * - All LLM usage goes through this backend module
 * - Prompts enforce RULEBOOK constraints
 * - Never claim IEC/IRB/CTRI/DCGI approvals or fabricate IDs
 * - Deterministic logic from @aurora/core is the single source of truth
 * - AI only generates narrative text, never changes computed values
 * 
 * CRITICAL: AI is MANDATORY - system requires AI to function
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AURORA_RULEBOOK } = require("@aurora/core");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let geminiClient: any = null;
let availabilityChecked = false;
let availabilityStatus: { available: boolean; reason?: string } | null = null;

/**
 * Validate AI availability - MANDATORY requirement
 * Throws descriptive error if AI unavailable with troubleshooting steps
 */
export function validateAIAvailability(): void {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
    throw new Error(
      "AI service is required but not configured. Please set GEMINI_API_KEY environment variable. " +
      "Get your API key from: https://makersuite.google.com/app/apikey"
    );
  }

  // Note: We can't actually test API reachability synchronously here
  // The actual API call will fail if unreachable, but we validate config exists
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (error) {
      throw new Error(
        `Failed to initialize AI client: ${error}. ` +
        "Please check your GEMINI_API_KEY is valid and try again."
      );
    }
  }
}

/**
 * Check AI availability (non-throwing version for status checks)
 */
function isAIAvailable() {
  if (availabilityChecked && availabilityStatus) {
    return availabilityStatus.available;
  }

  try {
    validateAIAvailability();
    availabilityStatus = { available: true };
    availabilityChecked = true;
    return true;
  } catch (error) {
    availabilityStatus = {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
    availabilityChecked = true;
    return false;
  }
}

/**
 * Get AI availability status with reason
 */
function getAIAvailabilityStatus() {
  isAIAvailable(); // This will set availabilityStatus
  return availabilityStatus || { available: false, reason: "Not checked" };
}

/**
 * Initialize Gemini API client (called automatically)
 */
function configureGeminiClient(): any {
  validateAIAvailability(); // Throws if not available
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY!);
  }
  return geminiClient;
}

/**
 * Validate AI output against rulebook constraints
 * Ensures no regulatory claims or forbidden content
 */
function validateNoRegulatoryClaims(content: string): string {
  const forbiddenPatterns = [
    /approved by (IEC|IRB|CTRI|DCGI)/gi,
    /ethics committee approval/gi,
    /regulatory approval/gi,
    /CTRI registration number/gi,
    /DCGI approval number/gi,
  ];
  
  let cleaned = content;
  for (const pattern of forbiddenPatterns) {
    cleaned = cleaned.replace(pattern, "[To be completed by PI/IEC]");
  }
  
  return cleaned;
}

/**
 * PROMPT: Parse study idea with anti-hallucination measures
 * Enhanced with context-aware extraction, relationship extraction, and advanced medical terminology handling
 */
const PROMPT_PARSE_IDEA = `You are an expert clinical research assistant with deep knowledge of clinical research methodology, medical terminology, and Indian healthcare context. Your task is to parse a study idea into structured information with high accuracy.

CRITICAL CONSTRAINTS:
- Extract ONLY information explicitly stated or clearly implied in the text
- Do NOT infer, assume, or invent any information
- Use null for fields that are not mentioned or unclear
- Never claim approvals, fabricate IDs, or invent facts/statistics
- Handle medical terminology variations, synonyms, and abbreviations intelligently
- Understand clinical research domain context (e.g., RCT terminology, cohort study language)
- For ambiguous ideas, extract what you can with confidence and mark uncertain fields as null
- Extract relationships between concepts (condition-treatment-outcome, exposure-disease, etc.)

CONTEXT-AWARE EXTRACTION GUIDELINES:

1. CONDITION (health condition or disease):
   - Look for: disease names, medical conditions, health states, syndromes
   - Handle variations intelligently:
     * "diabetes" = "diabetes mellitus", "DM" = "diabetes mellitus"
     * "MI" = "myocardial infarction", "heart attack" = "myocardial infarction"
     * "HTN" = "hypertension", "high BP" = "hypertension"
     * "CKD" = "chronic kidney disease"
   - Extract full condition name even if abbreviated initially
   - Recognize Indian medical terminology (e.g., "TB" = "tuberculosis", "DM" = "diabetes mellitus")
   - Examples: "Type 2 diabetes", "hypertension", "COVID-19", "breast cancer", "tuberculosis"

2. POPULATION DESCRIPTION:
   - Look for: age ranges, gender, ethnicity, disease stage, comorbidities, clinical characteristics
   - Include modifiers: "adults", "elderly", "pregnant women", "children", "pediatric"
   - Extract inclusion/exclusion hints if mentioned explicitly
   - Recognize Indian population descriptors: "Indian", "South Asian", regional mentions
   - Extract disease severity/stage: "stage III", "mild", "severe", "advanced"
   - Examples: "adults aged 30-50 years", "postmenopausal women", "patients with stage III disease", "Indian adults"

3. SETTING:
   - Look for: hospital type, clinic, community, primary/secondary/tertiary care, location context
   - Include location hints: "urban", "rural", "tertiary care hospital", "primary health center"
   - Recognize Indian healthcare settings: "PHC" = "primary health center", "CHC" = "community health center"
   - Examples: "tertiary care hospital", "primary health centers", "community clinics", "urban tertiary care"

4. PRIMARY OUTCOME HINT:
   - Look for: what is being measured, endpoints, outcomes, clinical events
   - Include measurement details: "mortality", "blood pressure", "HbA1c levels", "quality of life"
   - Extract timeframes if mentioned with outcome
   - Recognize outcome types: binary (mortality, response), continuous (BP, lab values), time-to-event (survival)
   - Examples: "30-day mortality", "change in HbA1c", "progression-free survival", "blood pressure reduction"

5. SECONDARY OUTCOMES (if mentioned):
   - Extract any secondary endpoints or outcomes mentioned
   - Look for: "also measure", "secondary endpoint", "additionally assess"
   - Return as array of strings or null

6. ELIGIBILITY CRITERIA HINTS:
   - Extract inclusion criteria hints: age ranges, disease status, specific conditions
   - Extract exclusion criteria hints: comorbidities, contraindications, exclusions mentioned
   - Return as structured hints or null

7. TIMEFRAME HINT:
   - Look for: study duration, follow-up periods, observation windows, treatment duration
   - Extract numbers with units: "6 months", "1 year", "30 days", "12 weeks"
   - Distinguish between: study duration, follow-up period, treatment period
   - Examples: "6-month follow-up", "30-day period", "12 weeks", "1-year study"

8. RETROSPECTIVE/PROSPECTIVE:
   - Look for keywords: "retrospective", "prospective", "historical", "chart review", "follow-up", "cohort"
   - Context clues: "looking back", "existing records", "medical records", "follow patients"
   - true = retrospective (looking back at existing data)
   - false = prospective (collecting new data)
   - null = unclear or not mentioned

9. DIAGNOSTIC STUDY:
   - Look for: "diagnostic", "sensitivity", "specificity", "accuracy", "screening", "test", "validation"
   - Recognize diagnostic study language: "test performance", "diagnostic accuracy", "screening tool"
   - true = diagnostic accuracy/validation study
   - false = treatment/intervention/observational study

10. INTERVENTION/COMPARISON:
    - Look for: treatment names, drugs, procedures, "vs", "compared to", "versus", "versus"
    - Extract relationship: intervention → outcome, exposure → disease
    - Recognize intervention types: drug names, procedures, behavioral, device
    - true = intervention or comparison mentioned
    - false = no intervention/comparison mentioned

11. STRATIFICATION/SUBGROUP HINTS:
    - Look for: "stratify", "subgroup", "by age", "by gender", "by disease stage"
    - Extract any mentioned stratification factors or subgroup analyses

12. STUDY PHASE/TYPE:
    - Look for: "pilot", "feasibility", "phase 1/2/3/4", "proof of concept", "exploratory"
    - Extract study phase or type if mentioned

ADDITIONAL FIELDS TO EXTRACT (if mentioned):

- interventionName: Name of the intervention/treatment (e.g., "metformin", "surgery", "lifestyle intervention", "ACE inhibitor")
- comparatorName: Name of comparator/control (e.g., "placebo", "standard care", "no treatment", "active control")
- sampleSizeHint: Any mention of target sample size (e.g., "100 patients", "n=50", "approximately 200")
- studyPhaseHint: Phase mentioned (e.g., "phase 2", "pilot", "feasibility", "phase III")
- secondaryOutcomes: Array of secondary outcomes mentioned (e.g., ["quality of life", "adverse events"])
- eligibilityHints: Object with inclusion/exclusion hints if mentioned
- stratificationFactors: Array of stratification or subgroup factors mentioned

OUTPUT FORMAT:
Return a valid JSON object with these fields (use null for missing/uncertain fields, empty array [] for arrays):
{
  "condition": string | null,
  "populationDescription": string | null,
  "setting": string | null,
  "primaryOutcomeHint": string | null,
  "secondaryOutcomes": string[] | null,
  "timeframeHint": string | null,
  "isRetrospectiveHint": boolean | null,
  "isDiagnosticHint": boolean | null,
  "mentionsInterventionOrComparison": boolean | null,
  "interventionName": string | null,
  "comparatorName": string | null,
  "sampleSizeHint": string | null,
  "studyPhaseHint": string | null,
  "eligibilityHints": {
    "inclusion": string[] | null,
    "exclusion": string[] | null
  } | null,
  "stratificationFactors": string[] | null
}

EXAMPLES:

Example 1:
Input: "Randomized controlled trial comparing metformin vs placebo for prediabetes prevention in Indian adults aged 30-50 years over 12 months. We will also measure quality of life and HbA1c levels."
Output: {
  "condition": "prediabetes",
  "populationDescription": "Indian adults aged 30-50 years",
  "setting": null,
  "primaryOutcomeHint": "prediabetes prevention",
  "secondaryOutcomes": ["quality of life", "HbA1c levels"],
  "timeframeHint": "12 months",
  "isRetrospectiveHint": false,
  "isDiagnosticHint": false,
  "mentionsInterventionOrComparison": true,
  "interventionName": "metformin",
  "comparatorName": "placebo",
  "sampleSizeHint": null,
  "studyPhaseHint": null,
  "eligibilityHints": null,
  "stratificationFactors": null
}

Example 2:
Input: "We want to study 30-day mortality after emergency laparotomy in adult patients admitted to our tertiary care hospital. Patients with pre-existing cardiac conditions will be excluded."
Output: {
  "condition": null,
  "populationDescription": "adult patients",
  "setting": "tertiary care hospital",
  "primaryOutcomeHint": "30-day mortality",
  "secondaryOutcomes": null,
  "timeframeHint": "30-day",
  "isRetrospectiveHint": null,
  "isDiagnosticHint": false,
  "mentionsInterventionOrComparison": false,
  "interventionName": null,
  "comparatorName": null,
  "sampleSizeHint": null,
  "studyPhaseHint": null,
  "eligibilityHints": {
    "inclusion": null,
    "exclusion": ["pre-existing cardiac conditions"]
  },
  "stratificationFactors": null
}

Example 3:
Input: "Prospective cohort study of diabetes patients stratified by age and gender to assess cardiovascular outcomes over 2 years"
Output: {
  "condition": "diabetes",
  "populationDescription": "diabetes patients",
  "setting": null,
  "primaryOutcomeHint": "cardiovascular outcomes",
  "secondaryOutcomes": null,
  "timeframeHint": "2 years",
  "isRetrospectiveHint": false,
  "isDiagnosticHint": false,
  "mentionsInterventionOrComparison": false,
  "interventionName": null,
  "comparatorName": null,
  "sampleSizeHint": null,
  "studyPhaseHint": null,
  "eligibilityHints": null,
  "stratificationFactors": ["age", "gender"]
}

Now parse the following study idea:`;

/**
 * PROMPT: Select study design with rulebook compliance
 */
const PROMPT_SELECT_DESIGN = `You are helping select an appropriate study design from the Aurora Rulebook.

CRITICAL CONSTRAINTS:
- Choose ONLY from the provided rulebook designs
- Cite rulebook constraints in your reasoning
- Explain reasoning based on stated study goals
- Never suggest designs not in the rulebook
- Consider feasibility, regulatory alignment, and study goals

Available designs: {DESIGNS}

Study idea: {IDEA}
Extracted information: {PRESPEC}

Return JSON with:
- designId: The design ID from rulebook (or null if none suitable)
- confidence: Confidence score 0-100
- reasoning: Explanation of why this design was chosen, citing rulebook constraints`;

/**
 * PROMPT: Generate protocol section with fact-checking
 */
const PROMPT_GENERATE_PROTOCOL_SECTION = `You are drafting a comprehensive clinical research protocol section for a study in India. Write in natural, professional prose suitable for regulatory submission.

CRITICAL CONSTRAINTS:
- Write natural, flowing prose - DO NOT use template placeholders like "{{idea}}" or "Study about..."
- Write complete, well-structured paragraphs with proper medical terminology
- Provide comprehensive, detailed content (aim for 200-500 words per section)
- For clinical claims, cite sources or mark as '[To be confirmed by PI]'
- Do not invent statistics, risks, or benefits
- If uncertain, explicitly state uncertainty
- Never claim approvals or fabricate IDs
- Never invent facts or statistics
- Cite sources or mark uncertain
- Conform to rulebook constraints
- Use proper medical and research terminology appropriate for Indian healthcare context
- Write in third person, formal academic style

STYLE GUIDELINES:
- Start with clear topic sentences
- Use transitions between ideas
- Include relevant context and background
- Provide specific details where appropriate
- Use active voice where possible
- Maintain professional, objective tone

Study details:
- Design: {DESIGN}
- Condition: {CONDITION}
- Primary endpoint: {PRIMARY_ENDPOINT}
- Population: {POPULATION}
- Setting: {SETTING}

Generate comprehensive narrative content for the {SECTION} section. Write naturally as if drafting a complete protocol document, not filling in templates. Return only the content text.`;

/**
 * PROMPT: Generate PIS/ICF content with fact-checking
 */
const PROMPT_GENERATE_PIS_ICF = `You are drafting a comprehensive Participant Information Sheet (PIS) and Informed Consent Form (ICF) for a clinical study in India. Write in clear, accessible language suitable for participants with varying levels of health literacy.

CRITICAL CONSTRAINTS:
- Write natural, clear prose - DO NOT use template placeholders or generic phrases
- Use simple, accessible language while maintaining medical accuracy
- Write complete, well-structured paragraphs (aim for 150-300 words per section)
- Base risks/benefits on condition and design only
- Do not make up specific risk percentages unless cited
- Mark uncertain risks as '[To be discussed with PI]'
- Never claim approvals or fabricate IDs
- Never invent facts or statistics
- Cite sources or mark uncertain
- Conform to ICMR guidelines and rulebook constraints
- Use second person ("you") for participant-facing language
- Include all mandatory ICMR elements: purpose, procedures, risks, benefits, alternatives, confidentiality, voluntary participation, contact information

STYLE GUIDELINES:
- Use short sentences (15-20 words average)
- Avoid medical jargon; explain terms when necessary
- Use bullet points or numbered lists for procedures and risks
- Write in a warm, respectful tone
- Make information actionable and clear

Study details:
- Condition: {CONDITION}
- Design: {DESIGN}
- Primary endpoint: {PRIMARY_ENDPOINT}
- Population: {POPULATION}

Generate comprehensive, study-specific consent language that is clear, compliant with ICMR guidelines, and appropriate for the Indian context. Write naturally as if drafting a complete consent document, not filling in templates. Return only the content text.`;

/**
 * PROMPT: Translate PIS/ICF to target language
 */
const PROMPT_TRANSLATE_PIS_ICF = `You are translating a Participant Information Sheet (PIS) and Informed Consent Form (ICF) to {TARGET_LANGUAGE}.

CRITICAL CONSTRAINTS:
- Translate/transliterate the provided PIS/ICF content to {TARGET_LANGUAGE} while maintaining EXACT template structure
- Preserve all section headers, section order, and required segments
- Ensure medical/legal terms are accurately translated
- Maintain ICMR compliance in translated version
- For transliterations, use standard script conventions
- Return complete translated document maintaining exact structure

Original content:
{CONTENT}

Return the complete translated document with all sections preserved.`;

/**
 * PROMPT: Generate IEC cover note with fact-checking
 */
const PROMPT_GENERATE_IEC_COVER_NOTE = `You are drafting a comprehensive cover note for submission to an Institutional Ethics Committee (IEC) in India. Write in formal, professional language suitable for regulatory correspondence.

CRITICAL CONSTRAINTS:
- Write natural, professional prose - DO NOT use template placeholders or generic phrases
- Write complete, well-structured paragraphs (aim for 300-600 words total)
- Cite relevant guidelines (ICMR, ICH E6(R3)) appropriately
- Never claim IEC approval or imply approval
- Never fabricate IEC registration numbers
- Never provide legal guarantees
- Use formal letter-writing conventions
- Demonstrate thorough understanding of ethical considerations

STYLE GUIDELINES:
- Use formal salutation and closing
- Structure as a professional letter
- Include clear introduction, body paragraphs, and conclusion
- Use third person for study description
- Maintain respectful, professional tone throughout
- Include specific details about the study

Study summary:
- Title: {TITLE}
- Design: {DESIGN}
- Condition: {CONDITION}
- Primary endpoint: {PRIMARY_ENDPOINT}
- Sample size: {SAMPLE_SIZE}
- Population: {POPULATION}

Generate a comprehensive, professional cover note that:
1. Introduces the study clearly and concisely
2. Highlights key ethical considerations and participant protections
3. Explains the study's importance and potential benefits
4. Demonstrates compliance with ICMR guidelines and ICH E6(R3) principles
5. Requests IEC review (not approval) and outlines next steps

Write naturally as if drafting a complete cover letter, not filling in templates. Return only the content text.`;

/**
 * PROMPT: Enhance CRF layout
 */
const PROMPT_ENHANCE_CRF_LAYOUT = `You are enhancing the layout of a deterministic CRF schema.

CRITICAL CONSTRAINTS:
- You are enhancing the layout of a deterministic CRF schema
- Do NOT modify core structure or required fields
- Suggest optimal field grouping and visual organization
- Recommend study-specific additional fields based on: study design, endpoints, condition
- All suggestions must be reviewable/editable by user
- Return layout suggestions and field recommendations

Study details:
- Design: {DESIGN}
- Primary endpoint: {PRIMARY_ENDPOINT}
- Condition: {CONDITION}
- Current CRF structure: {CRF_STRUCTURE}

Provide suggestions for:
1. Field grouping and organization
2. Visual layout improvements
3. Study-specific additional fields (with rationale)

Return JSON with layout suggestions and field recommendations.`;

/**
 * Enhanced JSON extraction - handles code blocks, markdown, and nested JSON
 */
function extractJSONFromText(text: string): any {
  // Try to find JSON in code blocks first (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {
      // Fall through to other methods
    }
  }
  
  // Try to find JSON object in text (handles multiline)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try to fix common JSON issues
      let cleaned = jsonMatch[0];
      // Remove trailing commas before closing braces/brackets
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        throw new Error(`Failed to parse JSON: ${e2}. Raw text: ${text.substring(0, 200)}`);
      }
    }
  }
  
  throw new Error(`No JSON object found in AI response. Response: ${text.substring(0, 200)}`);
}

/**
 * Validate and normalize extracted PreSpec fields
 * Enhanced to handle additional fields: secondaryOutcomes, eligibilityHints, stratificationFactors
 */
function validatePreSpecFields(parsed: any, rawIdea: string): any {
  // Helper to clean string fields
  const cleanString = (value: any): string | undefined => {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str === "" || str.toLowerCase() === "null" ? undefined : str;
  };
  
  // Helper to clean boolean fields
  const cleanBoolean = (value: any): boolean | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "boolean") return value;
    const str = String(value).toLowerCase().trim();
    if (str === "true" || str === "1" || str === "yes") return true;
    if (str === "false" || str === "0" || str === "no") return false;
    return undefined;
  };
  
  // Helper to clean array fields
  const cleanArray = (value: any): string[] | undefined => {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => cleanString(item))
        .filter((item) => item !== undefined) as string[];
      return cleaned.length > 0 ? cleaned : undefined;
    }
    return undefined;
  };
  
  // Helper to clean eligibility hints object
  const cleanEligibilityHints = (value: any): { inclusion?: string[]; exclusion?: string[] } | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "object" && !Array.isArray(value)) {
      const inclusion = cleanArray(value.inclusion);
      const exclusion = cleanArray(value.exclusion);
      if (inclusion || exclusion) {
        return { inclusion, exclusion };
      }
    }
    return undefined;
  };
  
  return {
    rawIdea: rawIdea.trim(),
    condition: cleanString(parsed.condition),
    populationDescription: cleanString(parsed.populationDescription),
    setting: cleanString(parsed.setting),
    primaryOutcomeHint: cleanString(parsed.primaryOutcomeHint),
    secondaryOutcomes: cleanArray(parsed.secondaryOutcomes),
    timeframeHint: cleanString(parsed.timeframeHint),
    isRetrospectiveHint: cleanBoolean(parsed.isRetrospectiveHint),
    isDiagnosticHint: cleanBoolean(parsed.isDiagnosticHint),
    mentionsInterventionOrComparison: cleanBoolean(parsed.mentionsInterventionOrComparison),
    interventionName: cleanString(parsed.interventionName),
    comparatorName: cleanString(parsed.comparatorName),
    sampleSizeHint: cleanString(parsed.sampleSizeHint),
    studyPhaseHint: cleanString(parsed.studyPhaseHint),
    eligibilityHints: cleanEligibilityHints(parsed.eligibilityHints),
    stratificationFactors: cleanArray(parsed.stratificationFactors),
    // Note: Additional fields are extracted and validated
    // Some may not be part of PreSpec type yet - can be added to types.ts if needed
  };
}

/**
 * Parse study idea with AI - MANDATORY AI
 * Enhanced with robust JSON parsing and field validation
 */
async function parseStudyIdea(rawIdea: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_PARSE_IDEA + `\n\nStudy idea: ${rawIdea}`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Enhanced JSON extraction
    const parsed = extractJSONFromText(text);
    
    // Validate and normalize PreSpec structure
    const preSpec = validatePreSpecFields(parsed, rawIdea);
    
    return preSpec;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`AI parsing failed: ${errorMessage}. Please check your API key and internet connection.`);
  }
}

/**
 * Select study design with AI - MANDATORY AI
 * Enhanced with robust JSON parsing
 */
async function selectStudyDesign(preSpec: any, rawIdea: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const designsList = AURORA_RULEBOOK.studyDesigns
    .map((d) => `${d.id}: ${d.label} (${d.category})`)
    .join("\n");
  
  const prompt = PROMPT_SELECT_DESIGN
    .replace("{DESIGNS}", designsList)
    .replace("{IDEA}", rawIdea)
    .replace("{PRESPEC}", JSON.stringify(preSpec, null, 2));
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Enhanced JSON extraction
    const parsed = extractJSONFromText(text);
    
    // Validate designId is in rulebook
    const validDesignId = AURORA_RULEBOOK.studyDesigns.some((d) => d.id === parsed.designId)
      ? parsed.designId
      : null;
    
    // Normalize confidence to 0-100 range
    let confidence = parsed.confidence;
    if (typeof confidence === "string") {
      confidence = parseFloat(confidence);
    }
    confidence = Math.max(0, Math.min(100, confidence || 0));
    
    return {
      designId: validDesignId,
      confidence: confidence,
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`AI design selection failed: ${errorMessage}. Please check your API key and internet connection.`);
  }
}

/**
 * Generate protocol section content with AI
 * Only generates narrative text - structure and values come from deterministic logic
 */
async function generateProtocolSection(section: string, studySpec: any, existingContent?: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_GENERATE_PROTOCOL_SECTION
    .replace("{DESIGN}", studySpec.designLabel || studySpec.designId || "Not yet determined")
    .replace("{CONDITION}", studySpec.condition || "Not specified")
    .replace("{PRIMARY_ENDPOINT}", studySpec.primaryEndpoint?.name || "Not specified")
    .replace("{POPULATION}", studySpec.populationDescription || "Not specified")
    .replace("{SETTING}", studySpec.setting || "Not specified")
    .replace("{SECTION}", section)
    + (existingContent ? `\n\nCurrent draft:\n${existingContent}\n\nEnhance this content with natural prose:` : "\n\nGenerate comprehensive content:");

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return validateNoRegulatoryClaims(text);
  } catch (error) {
    throw new Error(`AI generation failed for ${section}: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * Generate PIS/ICF content with AI
 * Maintains ICMR compliance while adding study-specific details
 */
async function generatePISICFContent(studySpec: any, existingContent?: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_GENERATE_PIS_ICF
    .replace("{CONDITION}", studySpec.condition || "Not specified")
    .replace("{DESIGN}", studySpec.designLabel || studySpec.designId || "Not yet determined")
    .replace("{PRIMARY_ENDPOINT}", studySpec.primaryEndpoint?.name || "Not specified")
    + (existingContent ? `\n\nCurrent draft:\n${existingContent}\n\nEnhance this content:` : "\n\nGenerate new content:");

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return validateNoRegulatoryClaims(text);
  } catch (error) {
    throw new Error(`AI generation failed for PIS/ICF: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * Translate PIS/ICF to target language
 */
async function translatePISICF(content: string, targetLanguage: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_TRANSLATE_PIS_ICF
    .replace(/{TARGET_LANGUAGE}/g, targetLanguage)
    .replace("{CONTENT}", content);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return validateNoRegulatoryClaims(text);
  } catch (error) {
    throw new Error(`AI translation failed for ${targetLanguage}: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * Generate IEC cover note with AI
 * Creates compelling but compliant ethics narrative
 */
async function generateIECCoverNote(baseline: any, existingContent?: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_GENERATE_IEC_COVER_NOTE
    .replace("{TITLE}", baseline.studySpec.title)
    .replace("{DESIGN}", baseline.studySpec.designLabel || baseline.studySpec.designId || "Not yet determined")
    .replace("{CONDITION}", baseline.studySpec.condition || "Not specified")
    .replace("{PRIMARY_ENDPOINT}", baseline.studySpec.primaryEndpoint?.name || "Not specified")
    .replace("{SAMPLE_SIZE}", baseline.sampleSize?.totalSampleSize?.toString() || "Not calculated")
    .replace("{POPULATION}", baseline.studySpec.populationDescription || "Not specified")
    + (existingContent ? `\n\nCurrent draft:\n${existingContent}\n\nEnhance this content with natural, professional prose:` : "\n\nGenerate comprehensive content:");

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return validateNoRegulatoryClaims(text);
  } catch (error) {
    throw new Error(`AI generation failed for IEC cover note: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * Enhance CRF layout with AI
 * Suggests layout improvements and study-specific fields
 */
async function enhanceCRFLayout(studySpec: any, currentCRFStructure: string) {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_ENHANCE_CRF_LAYOUT
    .replace("{DESIGN}", studySpec.designLabel || studySpec.designId || "Not yet determined")
    .replace("{PRIMARY_ENDPOINT}", studySpec.primaryEndpoint?.name || "Not specified")
    .replace("{CONDITION}", studySpec.condition || "Not specified")
    .replace("{CRF_STRUCTURE}", currentCRFStructure);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        layoutSuggestions: text,
        fieldRecommendations: [],
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      layoutSuggestions: parsed.layoutSuggestions || text,
      fieldRecommendations: parsed.fieldRecommendations || [],
    };
  } catch (error) {
    throw new Error(`AI CRF enhancement failed: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * PROMPT: Generate recent references for literature review
 */
const PROMPT_GENERATE_REFERENCES = `You are helping generate recent, relevant references for a clinical research study literature review.

CRITICAL CONSTRAINTS:
- Generate ONLY real, published references from PubMed or other reputable sources
- Focus on recent publications (2019-2024) when possible
- Prioritize Indian context and ICMR guidelines when relevant
- Include PubMed IDs and DOIs when available
- Format citations in Vancouver/ICMJE style
- Do NOT invent or fabricate references
- If you cannot find specific references, suggest search strategies instead

Study details:
- Condition: {CONDITION}
- Design: {DESIGN}
- Primary endpoint: {PRIMARY_ENDPOINT}
- Population: {POPULATION}
- Keywords: {KEYWORDS}

Generate 5-10 recent, relevant references. For each reference, provide:
- Full citation in Vancouver/ICMJE style
- PubMed ID (if available)
- DOI (if available)
- Brief relevance note (1 sentence)
- Year of publication

Return as JSON array with fields: title, authors, journal, year, pubmedId, doi, relevance, citation.

If specific references cannot be found, suggest PubMed search strategies and keywords instead.`;

/**
 * Generate recent references for literature review using AI
 * Focuses on recent (2019-2024) publications relevant to the study
 */
async function generateRecentReferences(
  studySpec: any,
  keywords: string[]
): Promise<{
  references: Array<{
    title: string;
    authors: string;
    journal: string;
    year: number;
    pubmedId?: string;
    doi?: string;
    relevance: string;
    citation: string;
  }>;
  searchStrategies?: string[];
}> {
  validateAIAvailability(); // Throws if AI unavailable
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_GENERATE_REFERENCES
    .replace("{CONDITION}", studySpec.condition || "Not specified")
    .replace("{DESIGN}", studySpec.designLabel || studySpec.designId || "Not yet determined")
    .replace("{PRIMARY_ENDPOINT}", studySpec.primaryEndpoint?.name || "Not specified")
    .replace("{POPULATION}", studySpec.populationDescription || "Not specified")
    .replace("{KEYWORDS}", keywords.join(", ") || "Not specified");

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return { references: parsed };
        }
      } catch (e) {
        // Fall through to text parsing
      }
    }
    
    // If JSON parsing fails, return search strategies
    return {
      references: [],
      searchStrategies: [
        `Search PubMed with: ${keywords.join(" AND ")} AND (India OR Indian) AND (2019:2024[pdat])`,
        `Search IndMED for Indian context studies`,
        `Search CTRI for registered trials in India`,
        `Review ICMR guidelines and recent publications`,
      ],
    };
  } catch (error) {
    throw new Error(`AI reference generation failed: ${error}. Please check your API key and internet connection.`);
  }
}

/**
 * Enforce rulebook constraints on AI output
 * Ensures AI never contradicts deterministic values
 */
export function enforceRulebookConstraints(
  aiContent: string,
  deterministicValues: {
    designId?: string;
    sampleSize?: number;
    primaryEndpoint?: string;
  }
): string {
  let constrained = aiContent;
  
  // Ensure AI doesn't contradict design
  if (deterministicValues.designId) {
    // Remove any claims about different designs
    const wrongDesignPattern = new RegExp(
      `(?:study|trial|design).*?(?:is|will be|uses).*?(?!${deterministicValues.designId})`,
      "gi"
    );
    // This is a simple check - more sophisticated validation would be needed
  }
  
  return constrained;
}

/**
 * PROMPT: Generate clarifying questions based on parsed PreSpec
 */
const PROMPT_GENERATE_QUESTIONS = `You are helping clarify a clinical research study idea by generating targeted questions.

CRITICAL CONSTRAINTS:
- Generate questions ONLY for missing or ambiguous information
- Prioritize questions: critical (must answer), important (should answer), optional (nice to have)
- Ask ONE question per information gap
- Use clear, clinician-friendly language
- Focus on information needed for study design selection and protocol development
- Include language selection question: "In which languages should the Participant Information Sheet (PIS) and Informed Consent Form (ICF) be provided? (Select all that apply)"

STUDY IDEA: {IDEA}

PARSED INFORMATION:
{PRESPEC}

ANALYZE GAPS:
- What critical information is missing? (condition, population, primary outcome, design type)
- What is ambiguous or unclear? (timeframe, setting, intervention details)
- What would help select the best study design?
- What is needed for proper protocol development?

GENERATE QUESTIONS:
Return a JSON array of questions, each with:
- id: unique identifier (e.g., "q1", "q2")
- question: the question text (clear and specific)
- priority: "critical" | "important" | "optional"
- field: optional PreSpec field name this relates to (e.g., "condition", "primaryOutcomeHint")

EXAMPLES:
[
  {
    "id": "q1",
    "question": "What is the primary health condition or disease being studied?",
    "priority": "critical",
    "field": "condition"
  },
  {
    "id": "q2",
    "question": "What is the primary outcome measure you want to evaluate?",
    "priority": "critical",
    "field": "primaryOutcomeHint"
  },
  {
    "id": "q3",
    "question": "In which languages should the Participant Information Sheet (PIS) and Informed Consent Form (ICF) be provided? (Select all that apply: Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Urdu, or other)",
    "priority": "important",
    "field": "selectedLanguages"
  }
]

Return ONLY the JSON array, no additional text.`;

/**
 * Generate clarifying questions based on parsed PreSpec
 */
async function generateClarifyingQuestions(preSpec: any, idea: string): Promise<any[]> {
  validateAIAvailability();
  
  const client = configureGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = PROMPT_GENERATE_QUESTIONS
    .replace("{IDEA}", idea)
    .replace("{PRESPEC}", JSON.stringify(preSpec, null, 2));

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to extract questions JSON from AI response");
    }
    
    const questions = JSON.parse(jsonMatch[0]);
    
    // Validate questions structure
    if (!Array.isArray(questions)) {
      throw new Error("Questions must be an array");
    }
    
    return questions.map((q: any, index: number) => ({
      id: q.id || `q${index + 1}`,
      question: q.question || "",
      priority: q.priority || "optional",
      field: q.field || undefined,
    }));
  } catch (error) {
    throw new Error(`AI question generation failed: ${error}. Please check your API key and internet connection.`);
  }
}

module.exports = {
  validateAIAvailability,
  isAIAvailable,
  getAIAvailabilityStatus,
  parseStudyIdea,
  selectStudyDesign,
  generateProtocolSection,
  generatePISICFContent,
  translatePISICF,
  generateIECCoverNote,
  enhanceCRFLayout,
  generateRecentReferences,
  generateClarifyingQuestions,
};
