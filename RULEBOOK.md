# Aurora Research OS – RULEBOOK

This document is the **source of truth** for domain rules, architecture constraints, AI behavior, and compliance expectations for Aurora Research OS.

Any implementation, refactor, or AI-generated code MUST conform to this rulebook unless this file is explicitly updated.

---

## 1. Scope & References

**Jurisdiction focus for v1:** India.

Aurora v1 must align with and map to:

- ICMR National Ethical Guidelines for Biomedical and Health Research Involving Human Participants (2017 + relevant updates).
- ICMR Ethical Guidelines for AI in Healthcare & Biomedical Research (2023).
- CTRI Dataset & Description (1 August 2021) for clinical trial registration fields.
- Good Clinical Practice:
  - ICH E6(R3) principles (2025 Step 4) and relevant annex guidance.
  - Indian GCP / NDCT 2019-aligned responsibilities for investigators, sponsors, and ECs.

**Interpretation rule:**

- For India-focused use:
  - Local law + ICMR + CTRI take precedence.
  - ICH E6(R3) is applied as a quality standard for design, conduct, documentation, and computerized systems.

Aurora does **not** self-certify compliance; it structures outputs to be consistent with these frameworks.

---

## 2. Core Product Principles

1. **Purpose**
   - Turn a clinician’s idea into a coherent, standards-aligned **baseline draft package** and a configured **study workspace**.
   - This is a drafting, structuring, and orchestration tool — **not** an ethics/regulatory approval engine.

2. **Clinician-First**
   - Intake and explanations in natural clinical language.
   - No requirement to know stats or regulatory jargon to start.

3. **Baseline, Not Black-Box**
   - System generates draft artifacts.
   - Principal Investigator (PI) and Ethics Committee (EC/IEC) remain fully responsible.

4. **Constrained by Design**
   - Use only approved study design patterns and validated stats methods by default.
   - Advanced/complex behavior is opt-in + guarded.

5. **Transparent & Auditable**
   - Every important decision and change traceable:
     - who, when, what, from what to what.

6. **Ethics & Safety by Design**
   - Mandatory ethical/consent/safety elements must be present in drafts.
   - Unsafe or nonsensical designs must be flagged.

7. **Humans in the Loop**
   - Facilitate handoff to statisticians, ECs, and research offices.
   - Never replace their role.

---

## 3. Supported Study Designs (v1 Whitelist)

By default, Aurora may only propose or auto-generate around these designs:

- Prospective Cohort
- Retrospective Cohort
- Cross-sectional Study
- Case-control Study
- Disease / Quality Registry
- Simple 2-arm Parallel-group Randomized Controlled Trial
- Single-arm Trial
- Diagnostic Accuracy Study

**Advanced designs (restricted / opt-in):**

- Cluster RCT
- Non-inferiority / Equivalence RCT
- Quasi-experimental (pre-post, ITS)
- Adaptive designs

Advanced designs require:

- Explicit user selection.
- Extra parameters (e.g. ICCs, adaptation rules).
- Additional warnings in outputs.

If an idea cannot be mapped safely:

- System MUST return “Not supported in current templates; please consult an expert.”
- No forced, silent mapping.

---

## 4. Required Outputs (Baseline Package)

For any supported design, Aurora aims to produce:

1. **Structured StudySpec (machine-readable)**  
2. **Draft Protocol**
3. **Sample Size Justification**
4. **Draft Statistical Analysis Plan (SAP)**
5. **CRF / eCRF Schema & Sample CRFs**
6. **Draft Participant Information Sheet (PIS)**
7. **Draft Informed Consent Form (ICF)**
8. **IEC Cover Letter / Study Summary**
9. **Ethics & Compliance Checklist**
10. **CTRI Mapping Sheet** (for registrable trials)
11. **Live Study Workspace**:
    - Configured eCRFs
    - Role-based access
    - Audit trail

**Mandatory disclaimer for all generated artifacts:**

> “AI-generated draft based on user inputs. Requires review and approval by the Principal Investigator and Ethics Committee. Not a legal, ethical, or regulatory approval.”

This text (or close equivalent) MUST appear on protocol, SAP, PIS/ICF, CTRI mapping, and any export representing the study.

---

## 5. Architecture & Code Ownership

- Monorepo with npm workspaces:
  - `apps/web` – Next.js frontend.
  - `services/api` – Node.js/TS backend API.
  - `packages/core` – shared domain logic (this is authoritative).

**Rules:**

- Domain logic belongs in `packages/core`.
- `services/api` is a thin layer:
  - HTTP endpoints
  - Persistence
  - Auth
  - LLM gateway
- `apps/web`:
  - UX and flows.
  - No direct calls to external LLMs.
  - Use API + `packages/core` types.

---

## 6. Templates & Structures

### 6.1 Protocol Template (must include, not deletable)

- Title & identifiers
- Background & rationale
- Objectives (primary & secondary)
- Study design (explicit label from whitelist)
- Study setting & population
- Inclusion / exclusion criteria
- Interventions / exposures (if applicable)
- Outcome measures (definitions + timepoints)
- Sample size & justification
- Study procedures & visit schedule
- Data collection & management
- Statistical analysis plan (summary)
- Safety reporting
- Confidentiality & data protection
- Ethical considerations
- Compensation & injury management framework (site/PI to complete specifics)
- Dissemination plan

### 6.2 SAP Template

At minimum:

- Study overview & objectives
- Endpoint list with precise definitions
- Analysis populations (e.g. ITT/PP/safety)
- Primary endpoint analysis:
  - Prespecified test/model
- Secondary endpoints:
  - Marked exploratory by default
- Handling of:
  - Missing data (default: complete case + sensitivity recommendation)
  - Protocol deviations
- Interim/futility (default: none unless specified)
- Statistical software statement

### 6.3 CRF / eCRF Templates

Must support:

- Screening & eligibility (incl. consent version/status)
- Baseline demographics & clinical characteristics
- Exposure/intervention records
- Visit / follow-up forms generated from schedule
- Outcome capture aligned with endpoints
- AE/SAE forms (fields consistent with GCP expectations)
- Protocol deviations
- Study completion / withdrawal

Every CRF field maps to structured definitions in `StudySpec`.  
Edits to CRF records log full audit trail.

### 6.4 PIS / ICF Templates

Must include elements consistent with ICMR guidance, including:

- Statement that this is research
- Purpose and procedures in lay language
- Duration and number of contacts
- Foreseeable risks/discomforts
- Expected benefits or explicit statement if none
- Alternatives (where relevant)
- Confidentiality & data handling
- Voluntariness & right to withdraw
- Compensation & free medical care for study-related injury (configurable text)
- Contacts (PI & EC)
- Future use of data/samples (separate consent options)
- Signatures/Thumb impression + date
- Provisions for LAR/assent/witness where applicable

### 6.5 CTRI Mapping

For relevant trials, system should auto-build a CTRI-style dataset:

- Study titles
- Study type & design & phase (if applicable)
- Conditions
- Interventions/comparators (generic names)
- Inclusion / exclusion criteria
- Primary & secondary outcomes with timepoints
- Sample size (per arm & total)
- Randomization, allocation concealment, blinding details
- Sites & investigators (to be completed)
- Ethics committee details & approval status (to be completed)
- Regulatory approval status (to be completed)

System MUST:

- Only fill what is derivable.
- Mark non-derivable fields as “to be provided by PI”.
- Never fabricate approvals or IDs.

---

## 7. Statistics & Sample Size (Deterministic)

All sample size and core stat logic:

- Implemented as pure, auditable functions in `packages/core`.
- LLMs may generate narrative explanations but cannot change numbers.

Supported v1 methods include:

- Two independent proportions
- Two independent means
- Single proportion (precision-based)
- Time-to-event (log-rank style)
- Diagnostic accuracy (sensitivity/specificity)
- Dropout adjustment
- Cluster design effect (if cluster design enabled)

Rules:

- Always show:
  - Formula
  - Parameters (α, power, effect size, assumptions)
- Link:
  - Primary outcome ↔ hypothesis ↔ chosen method ↔ sample size.
- Secondary endpoints:
  - Typically exploratory; no hidden multiplicity adjustments unless explicitly configured.

---

## 8. AI Autonomy & Guardrails

### 8.1 Allowed

AI systems integrated into Aurora may:

- Parse natural-language ideas into structured `PreSpec` and `StudySpec`.
- Recommend study design from whitelist.
- Generate:
  - Draft protocol text under fixed headings.
  - Draft SAP narrative from deterministic spec.
  - Draft PIS/ICF language including all mandatory elements.
  - Draft cover letters and summaries.
- Check consistency across:
  - Protocol, SAP, CRFs, CTRI mapping.
- Suggest improvements or flag missing pieces.

### 8.2 Forbidden

AI may NOT:

- Claim or imply:
  - IEC/IRB approval,
  - CTRI registration,
  - DCGI or other regulatory approvals.
- Fabricate:
  - Approval numbers,
  - EC names,
  - Sponsors, insurance, or compensation terms.
- Introduce:
  - Study designs outside whitelist by default.
  - Statistical methods not in approved catalog.
- Remove:
  - Mandatory ethics, consent, or safety content.

When uncertain or conflicting:

- Prefer to STOP and flag:
  - “Requires human/ expert review”
  - rather than hallucinate.

---

## 9. Compliance & Review Checklists

### 9.1 Pre-Launch Checklist (Blocking)

A study cannot be “locked” and workspace launched if any **critical** failures:

Critical items include:

- Design not from whitelist (unless flagged advanced).
- No clear primary outcome.
- Primary outcome not consistently defined across protocol/SAP/CRFs.
- No sample size justification for primary endpoint.
- PIS/ICF missing mandatory elements.
- Serious ethical/safety red flags (e.g. no consent for > minimal risk).
- CTRI mapping missing core structural details without being flagged.

Checklist outputs:
- `pass` / `warn` / `critical` for each item.

Critical items:
- Must be resolved or explicitly acknowledged in a way captured by the system.
- By default, block “Launch Workspace”.

### 9.2 Workspace Checklist

Before first data entry:

- Correct StudyVersion locked.
- CRF schemas bound to that version.
- Roles assigned.
- Audit logging enabled.

---

## 10. Data Integrity, Audit & Security

- Maintain append-only `AuditEvent` log for:
  - Study spec changes.
  - Document (re)generation.
  - Subject data create/update.
- Each audit entry:
  - Actor
  - Timestamp
  - Entity (study/subject/doc)
  - Before/after snapshot or diff.

Security expectations:

- Use modern password/auth and transport security.
- Protect PHI where applicable.
- Do not use production PHI to train external models.

---

## 11. Versioning & Extensibility

- All:
  - Templates,
  - Rule mappings,
  - Regulatory profiles,

must be **versioned** (e.g. `ICMR_2017_v1`, `CTRI_2021_v1`, `E6R3_2025_v1`).

Each `StudyVersion` records:

- Which rule versions were applied.

Adding new geographies:

- Implement as new `RegulatoryProfile` sets.
- Do not mix rules; choose profile per study/org.

---

By adhering to this RULEBOOK, Aurora Research OS remains:

- Clinician-friendly,
- Statistically and ethically structured,
- Transparent to IECs and regulators,
- And safe for AI-assisted automation without overstepping.
