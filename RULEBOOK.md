# Aurora Research OS Rulebook Overview

Aurora Research OS is governed by the machine-readable `AURORA_RULEBOOK` exported from [`packages/core/src/rulebook.ts`](packages/core/src/rulebook.ts).

Key coverage within the configuration:
- v1 India regulatory profile aligned with ICMR ethics, CTRI schema, Indian GCP/NDCT, and ICH E6(R3) expectations.
- Baseline study designs allowed for drafting, plus advanced designs requiring explicit opt-in and guardrails.
- Deterministic statistical methods and calculators that downstream services must adhere to without hidden logic.
- Pre-launch checklist gating items spanning outcomes, consent content, sample size transparency, and CTRI readiness.
- Mandatory disclaimers prohibiting any regulatory, ethics, or CTRI approval claims by the system.

This Markdown file is a pointer only; the TypeScript rulebook remains the canonical source of truth for code and AI orchestration.

Any behavioral, architectural, or compliance change to Aurora Research OS MUST remain consistent with `AURORA_RULEBOOK`.
When updates are necessary, modify both this overview and the rulebook TypeScript module together to keep the documentation synchronized.
