import { Router } from "express";
import { AURORA_RULEBOOK } from "@aurora/core";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/design-templates", (_req, res) => {
  res.json(AURORA_RULEBOOK.studyDesigns);
});

router.get("/rulebook/summary", (_req, res) => {
  const summary = {
    version: AURORA_RULEBOOK.version,
    defaultRegulatoryProfileId: AURORA_RULEBOOK.defaultRegulatoryProfileId,
    studyDesigns: AURORA_RULEBOOK.studyDesigns.map((design) => ({
      id: design.id,
      label: design.label,
      category: design.category
    })),
    disclaimers: AURORA_RULEBOOK.disclaimers
  };

  res.json(summary);
});

export { router };
