const { Router } = require("express");
const { AURORA_RULEBOOK, buildBaselinePackageFromIdea, canLockAndLaunch } = require("@aurora/core");
const { buildBaselineZip } = require("./export");

const router = Router();

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

router.post("/preview/baseline", (req: any, res: any) => {
  const { idea, assumptions } = req.body ?? {};

  if (typeof idea !== "string" || idea.trim().length === 0) {
    return res.status(400).json({ error: "idea is required" });
  }

  try {
    const baseline = buildBaselinePackageFromIdea(idea, assumptions);
    res.json(baseline);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate baseline package", details: `${error}` });
  }
});

router.post("/baseline-pack", async (req: any, res: any) => {
  const { idea, assumptions } = req.body ?? {};

  if (typeof idea !== "string" || idea.trim().length === 0) {
    return res.status(400).json({ error: "idea is required" });
  }

  try {
    const baseline = buildBaselinePackageFromIdea(idea, assumptions);
    const gate = canLockAndLaunch(baseline);
    if (!gate.allowed) {
      return res.status(422).json({ error: "Baseline has blocking issues", issues: gate.blockingIssues });
    }

    const zipBuffer = buildBaselineZip(baseline);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=aurora-baseline-pack.zip");
    res.send(zipBuffer);
  } catch (error) {
    res.status(500).json({ error: "Failed to build baseline pack", details: `${error}` });
  }
});

export { router };
