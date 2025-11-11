"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const { Router } = require("express");
const { AURORA_RULEBOOK, buildBaselinePackageFromIdea } = require("@aurora/core");
const router = Router();
exports.router = router;
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
            category: design.category,
        })),
        disclaimers: AURORA_RULEBOOK.disclaimers,
    };
    res.json(summary);
});
router.post("/preview/baseline", (req, res) => {
    const { idea, assumptions } = req.body ?? {};
    if (typeof idea !== "string" || idea.trim().length === 0) {
        return res.status(400).json({ error: "idea is required" });
    }
    try {
        const baseline = buildBaselinePackageFromIdea(idea, assumptions);
        res.json(baseline);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate baseline package", details: `${error}` });
    }
});
