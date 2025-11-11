const { Router } = require("express");
const { AURORA_RULEBOOK, buildBaselinePackageFromIdea, buildBaselineSpec } = require("@aurora/core");
// @ts-ignore - LLM module uses CommonJS exports
const {
  generateProtocolSection,
  generatePISICFContent,
  generateIECCoverNote,
  translatePISICF,
  enhanceCRFLayout,
  isAIAvailable,
  validateAIAvailability,
  getAIAvailabilityStatus,
  parseStudyIdea,
  selectStudyDesign,
  generateRecentReferences,
  generateClarifyingQuestions,
} = require("./llm");

const router = Router();

router.get("/", (_req: any, res: any) => {
  res.json({ 
    service: "Aurora Research OS API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      llm: {
        status: "/llm/status",
        parseIdea: "POST /llm/parse-idea",
        selectDesign: "POST /llm/select-design",
        generateQuestions: "POST /llm/generate-questions",
        generateContent: "POST /llm/generate-content"
      }
    }
  });
});

router.get("/health", (_req: any, res: any) => {
  res.json({ status: "ok" });
});

router.get("/design-templates", (_req: any, res: any) => {
  res.json(AURORA_RULEBOOK.studyDesigns);
});

router.get("/rulebook/summary", (_req: any, res: any) => {
  const summary = {
    version: AURORA_RULEBOOK.version,
    defaultRegulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
    studyDesigns: AURORA_RULEBOOK.studyDesigns.map((design: any) => ({
      id: design.id,
      label: design.label,
      category: design.category,
    })),
    disclaimers: AURORA_RULEBOOK.disclaimers,
  };

  res.json(summary);
});

router.post("/preview/baseline", async (req: any, res: any) => {
  const { idea, assumptions, useAIEnhancement } = req.body ?? {};

  if (typeof idea !== "string" || idea.trim().length === 0) {
    return res.status(400).json({ error: "idea is required" });
  }

  try {
    const baseline = buildBaselinePackageFromIdea(idea, assumptions);
    
    // Optionally enhance with AI if requested and available
    if (useAIEnhancement && isAIAvailable()) {
      try {
        // Enhance protocol sections
        for (const section of baseline.protocol.sections) {
          if (["background-rationale", "objectives", "study-design", "study-procedures", "safety-monitoring"].includes(section.id)) {
            const enhanced = await generateProtocolSection(
              section.id as any,
              baseline.studySpec,
              section.content
            );
            section.content = enhanced;
          }
        }
        
        // Enhance PIS/ICF
        const enhancedPISICF = await generatePISICFContent(
          baseline.studySpec,
          baseline.pisIcf.sections.map(s => s.content).join("\n\n")
        );
        // Split enhanced content back into sections (simplified - in production would parse better)
        baseline.pisIcf.sections.forEach((section, idx) => {
          if (enhancedPISICF.includes(section.title)) {
            // Try to extract section content from enhanced text
            const sectionMatch = enhancedPISICF.match(new RegExp(`${section.title}[\\s\\S]*?(?=${idx < baseline.pisIcf.sections.length - 1 ? baseline.pisIcf.sections[idx + 1].title : '$'})`, 'i'));
            if (sectionMatch) {
              section.content = sectionMatch[0].replace(section.title, '').trim();
            }
          }
        });
        
        // Enhance IEC cover note
        baseline.iecCoverNote.summary = await generateIECCoverNote(baseline, baseline.iecCoverNote.summary);
      } catch (aiError) {
        // Log but don't fail - fallback to deterministic templates
        console.warn("AI enhancement failed, using deterministic templates:", aiError);
      }
    }
    
    res.json(baseline);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate baseline package", details: `${error}` });
  }
});

router.get("/llm/status", (_req: any, res: any) => {
  const status = getAIAvailabilityStatus();
  res.json(status);
});

router.post("/llm/parse-idea", async (req: any, res: any) => {
  const { idea } = req.body ?? {};
  
  if (typeof idea !== "string" || idea.trim().length === 0) {
    return res.status(400).json({ error: "idea is required" });
  }

  try {
    validateAIAvailability();
    const preSpec = await parseStudyIdea(idea);
    res.json(preSpec);
  } catch (error) {
    res.status(503).json({ 
      error: "AI service unavailable", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post("/llm/select-design", async (req: any, res: any) => {
  const { preSpec, idea } = req.body ?? {};
  
  if (!preSpec || typeof idea !== "string") {
    return res.status(400).json({ error: "preSpec and idea are required" });
  }

  try {
    validateAIAvailability();
    const result = await selectStudyDesign(preSpec, idea);
    res.json(result);
  } catch (error) {
    res.status(503).json({ 
      error: "AI service unavailable", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post("/llm/generate-questions", async (req: any, res: any) => {
  const { preSpec, idea } = req.body ?? {};
  
  if (!preSpec || typeof idea !== "string") {
    return res.status(400).json({ error: "preSpec and idea are required" });
  }

  try {
    validateAIAvailability();
    const questions = await generateClarifyingQuestions(preSpec, idea);
    res.json({ questions });
  } catch (error) {
    res.status(503).json({ 
      error: "AI service unavailable", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.post("/llm/generate-content", async (req: any, res: any) => {
  const { type, studySpec, baseline, section, existingContent } = req.body ?? {};

  if (!type || !studySpec) {
    return res.status(400).json({ error: "type and studySpec are required" });
  }

  if (!isAIAvailable()) {
    return res.status(503).json({ error: "AI service unavailable - GEMINI_API_KEY not configured" });
  }

  try {
    let content: string;

    switch (type) {
      case "protocol-section":
        if (!section) {
          return res.status(400).json({ error: "section is required for protocol-section type" });
        }
        content = await generateProtocolSection(section, studySpec, existingContent);
        break;

      case "pis-icf":
        content = await generatePISICFContent(studySpec, existingContent);
        break;

      case "iec-cover-note":
        if (!baseline) {
          return res.status(400).json({ error: "baseline is required for iec-cover-note type" });
        }
        content = await generateIECCoverNote(baseline, existingContent);
        break;

      case "translate-pis-icf":
        if (!existingContent || !req.body.targetLanguage) {
          return res.status(400).json({ error: "existingContent and targetLanguage are required for translate-pis-icf type" });
        }
        content = await translatePISICF(existingContent, req.body.targetLanguage);
        break;

      case "enhance-crf-layout":
        if (!req.body.currentCRFStructure) {
          return res.status(400).json({ error: "currentCRFStructure is required for enhance-crf-layout type" });
        }
        const crfResult = await enhanceCRFLayout(studySpec, req.body.currentCRFStructure);
        return res.json(crfResult);

      case "generate-references":
        if (!req.body.keywords || !Array.isArray(req.body.keywords)) {
          return res.status(400).json({ error: "keywords array is required for generate-references type" });
        }
        const refResult = await generateRecentReferences(studySpec, req.body.keywords);
        return res.json(refResult);

      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate content", details: `${error}` });
  }
});

export { router };
