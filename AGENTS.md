# AGENTS GUIDELINES

These instructions apply to ANY AI coding assistant or automation working in this repository.

Your job is to implement **Aurora Research OS** exactly within these constraints, without drifting on scope, making up regulatory content, or breaking consistency.

---

## 1. Git & Repo Safety

- Do **NOT** run `git init` again.
- Do **NOT** delete or overwrite `AGENTS.md` or `RULEBOOK.md`.
- Do **NOT** add secrets (API keys, passwords, tokens, private URLs) to the repo.
- Do **NOT** silently change the core product intent.

If you believe an instruction requires changing `RULEBOOK.md`, call that out explicitly.

---

## 2. Monorepo & Tooling

- Use **npm** with **npm workspaces**.
- Root `package.json` MUST:
  - Be `"private": true`.
  - Declare:
    ```json
    {
      "workspaces": ["apps/*", "services/*", "packages/*"]
    }
    ```
- Directory layout (do not deviate unless explicitly instructed):
  - `apps/web` — Next.js (App Router) frontend (TypeScript + Tailwind).
  - `services/api` — Node.js/TypeScript backend API (Express or similar).
  - `packages/core` — Shared types, rulebook logic, orchestration, stats, templates, compliance utilities.

No pnpm, no yarn, unless explicitly switched later.

---

## 3. Obey the RULEBOOK

Before making domain, validation, or workflow changes:

1. **Read `RULEBOOK.md`.**
2. Apply its constraints as source of truth.

Key non-negotiables (summary, not a substitute):

- v1 focus: **India**.
  - Align with ICMR ethics guidelines, CTRI dataset structure, Indian GCP/NDCT framework, and ICH E6(R3) GCP principles.
- Purpose:
  - Turn clinician ideas into a **baseline draft package + live eCRF workspace**.
  - This is a drafting/orchestration platform, **not** a regulatory approval engine.
- Only use:
  - Whitelisted study designs.
  - Approved statistical methods.
- All generated artifacts must clearly state:
  - `AI-generated draft — requires PI/IEC review — not regulatory approval`.

If user instructions conflict with the RULEBOOK:

- Do **not** silently comply.
- Explain the conflict in comments or output.
- Propose a RULEBOOK-compliant alternative.

---

## 4. LLM / AI Usage

- No direct LLM calls from `apps/web`.
- All LLM usage must:
  - Go through a backend module (e.g. `services/api/src/llm.ts`).
  - Use prompts that:
    - Enforce RULEBOOK constraints.
    - Forbid:
      - Fabricated ethics/CTRI/DCGI approvals or IDs.
      - Legal/compliance guarantees.
    - Treat deterministic logic (`packages/core`) as the single source of truth for:
      - Study design classification
      - Sample size numbers
      - Endpoint lists
      - CRF schemas

LLMs MAY:

- Generate narrative text for:
  - Protocol sections
  - SAP descriptions
  - PIS/ICF wording
  - Cover letters
- But MUST:
  - Conform to structures & mandatory elements defined in `RULEBOOK.md`.
  - Never contradict computed values or allowed designs.

LLMs MAY NOT:

- Change sample size results.
- Change chosen study design type.
- Remove or dilute mandatory ethics/consent/safety content.
- Introduce unsupported advanced designs unless:
  - Explicitly requested, and
  - Guarded with proper checks per `RULEBOOK.md`.

When in doubt → prefer deterministic templates & code, not AI creativity.

---

## 5. UX & Flow Requirements

- Primary user: busy clinician.
- Always:
  - Start with natural-language idea input.
  - Show an interpreted summary (PICO + suggested design) they can edit.
- Maintain this wizard flow (unless explicitly re-specified):
  1. Idea
  2. Design
  3. Sample Size
  4. Documents
  5. Review & Compliance
  6. Launch Workspace

Include a **“Study Story”** panel that:

- Reflects the current structured spec.
- Stays consistent across all steps.

No jargon wall at the start. No dark patterns.

---

## 6. Backend & Data Rules

- Core deterministic logic (parsing, design selection, sample size, SAP construction, CRF generation, checklists) belongs in `packages/core`.
- `services/api`:
  - Imports `packages/core` for all domain logic.
  - Adds HTTP + auth + persistence + audit logging.
- Implement auditability:
  - For study definitions, generated artifacts, and subject data:
    - Record who changed what and when.
  - Use append-only audit logs; no silent destructive edits.

Design with ICH E6(R3)-style integrity and traceability in mind.

---

## 7. Domain & Compliance Guardrails

Enforce these constraints in code:

- Never:
  - Claim IEC/IRB approval.
  - Claim CTRI registration.
  - Claim DCGI or any regulatory approvals.
  - Invent approval numbers, ethics committee details, sponsors, or compensation terms.
- For unsupported or unsafe designs:
  - Return clear errors or warnings.
  - Do NOT force-fit into allowed templates.
- PIS/ICF:
  - Must include all mandatory ICMR elements in draft form.
- CTRI mapping:
  - Only fill fields derivable from study spec.
  - Mark others as “To be completed by PI”.
- Pre-launch checklist must block “Launch Workspace” on:
  - Missing/ambiguous primary outcome.
  - Inconsistent primary outcome across protocol/SAP/CRFs.
  - Missing sample size justification.
  - Missing core consent/ethics elements.

---

## 8. Testing & CI

For any substantial behavior:

- Add/update tests (especially in `packages/core`).
- Keep functions deterministic where possible.
- CI (e.g. GitHub Actions) should:
  - Run `npm install`
  - Run `npm test`
  - Run `npm run build`
- Tests/CI must not depend on live LLM calls or external network.

---

## 9. Conflict Resolution

If instructions from:

- a user,
- a code comment,
- or another file

conflict with:

1. `RULEBOOK.md`, or
2. this `AGENTS.md`,

then the AI assistant must:

- Make the conflict explicit.
- Prefer compliance with `RULEBOOK.md` + `AGENTS.md`.
- Suggest a compliant alternative.

---

By following this `AGENTS.md` plus `RULEBOOK.md`, Aurora Research OS can be built as a compliant, auditable, clinician-friendly SaaS without the AI going off-script.
