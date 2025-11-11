export type RegulatoryProfile = {
  id: string;
  description: string;
  flags: {
    requiresPIS_ICF: boolean;
    supportsCTRIRegistration: boolean;
    disallowRegulatoryClaims: boolean;
  };
};

export type StudyDesignId =
  | "prospective-cohort"
  | "retrospective-cohort"
  | "cross-sectional"
  | "case-control"
  | "registry"
  | "rct-2arm-parallel"
  | "single-arm"
  | "diagnostic-accuracy"
  | "cluster-rct"
  | "noninferiority-rct"
  | "quasi-experimental"
  | "adaptive";

export type StudyDesignCategory =
  | "interventional"
  | "observational"
  | "registry"
  | "diagnostic";

export type StudyDesignConfig = {
  id: StudyDesignId;
  label: string;
  category: StudyDesignCategory;
  isAdvanced: boolean;
  description: string;
};

export type StatsMethodId =
  | "two-proportions"
  | "noninferiority-proportions"
  | "equivalence-proportions"
  | "two-means"
  | "noninferiority-means"
  | "equivalence-means"
  | "single-proportion-precision"
  | "time-to-event-logrank"
  | "noninferiority-time-to-event"
  | "equivalence-time-to-event"
  | "diagnostic-accuracy"
  | "group-sequential"
  | "mixed-model-lmm"
  | "bayesian"
  | "dropout-adjustment"
  | "cluster-design-effect";

export type StatsMethodConfig = {
  id: StatsMethodId;
  label: string;
  description: string;
  appliesTo: string[];
  notes: string;
};

export type ChecklistSeverity = "pass" | "warn" | "critical";

export type ChecklistItem = {
  id: string;
  label: string;
  severity: ChecklistSeverity;
  rationale: string;
};

export type AuroraRulebook = {
  version: string;
  defaultRegulatoryProfileId: string;
  regulatoryProfiles: RegulatoryProfile[];
  studyDesigns: StudyDesignConfig[];
  advancedStudyDesigns: StudyDesignConfig[];
  statsMethods: StatsMethodConfig[];
  preLaunchChecklist: ChecklistItem[];
  disclaimers: {
    draftNotice: string;
    noRegulatoryClaims: string;
  };
};

export const INDIA_PROFILE: RegulatoryProfile = {
  id: "india-v1",
  description:
    "India v1 – aligns with ICMR ethics guidelines, CTRI dataset, Indian GCP/NDCT principles, ICH E6(R3) GCP expectations.",
  flags: {
    requiresPIS_ICF: true,
    supportsCTRIRegistration: true,
    disallowRegulatoryClaims: true,
  },
};

export const STUDY_DESIGNS: StudyDesignConfig[] = [
  {
    id: "prospective-cohort",
    label: "Prospective Cohort",
    category: "observational",
    isAdvanced: false,
    description: "Enrolls a defined cohort and follows forward to observe outcomes.",
  },
  {
    id: "retrospective-cohort",
    label: "Retrospective Cohort",
    category: "observational",
    isAdvanced: false,
    description: "Uses existing records to reconstruct exposure groups and observe outcomes.",
  },
  {
    id: "cross-sectional",
    label: "Cross-sectional",
    category: "observational",
    isAdvanced: false,
    description: "Captures exposure and outcome status at a single time point.",
  },
  {
    id: "case-control",
    label: "Case-control",
    category: "observational",
    isAdvanced: false,
    description: "Selects cases and matched controls to assess exposure relationships.",
  },
  {
    id: "registry",
    label: "Registry",
    category: "registry",
    isAdvanced: false,
    description: "Maintains longitudinal data for a defined patient registry.",
  },
  {
    id: "rct-2arm-parallel",
    label: "RCT – 2 Arm Parallel",
    category: "interventional",
    isAdvanced: false,
    description: "Randomizes participants into two parallel intervention arms.",
  },
  {
    id: "single-arm",
    label: "Single Arm",
    category: "interventional",
    isAdvanced: false,
    description: "Evaluates one intervention arm without a concurrent control.",
  },
  {
    id: "diagnostic-accuracy",
    label: "Diagnostic Accuracy",
    category: "diagnostic",
    isAdvanced: false,
    description: "Assesses sensitivity, specificity, and agreement for diagnostics.",
  },
];

export const ADVANCED_STUDY_DESIGNS: StudyDesignConfig[] = [
  {
    id: "cluster-rct",
    label: "Cluster RCT",
    category: "interventional",
    isAdvanced: true,
    description: "Randomizes clusters such as sites or wards rather than individuals.",
  },
  {
    id: "noninferiority-rct",
    label: "Non-inferiority RCT",
    category: "interventional",
    isAdvanced: true,
    description: "Tests whether a new intervention is not unacceptably worse than control.",
  },
  {
    id: "quasi-experimental",
    label: "Quasi-experimental",
    category: "interventional",
    isAdvanced: true,
    description: "Uses non-randomized assignment with structured controls.",
  },
  {
    id: "adaptive",
    label: "Adaptive",
    category: "interventional",
    isAdvanced: true,
    description: "Allows planned modifications to design parameters during the study.",
  },
];

export const STATS_METHODS: StatsMethodConfig[] = [
  {
    id: "two-proportions",
    label: "Two Proportions",
    description: "Power for difference in proportions between two groups (superiority).",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort", "retrospective-cohort", "case-control"],
    notes: "Expose alpha, power, allocation ratio, effect size; no hidden adjustments.",
  },
  {
    id: "noninferiority-proportions",
    label: "Non-inferiority Proportions",
    description: "Sample size for non-inferiority test of proportions (treatment not worse than control by margin).",
    appliesTo: ["rct-2arm-parallel", "noninferiority-rct"],
    notes: "Requires non-inferiority margin (delta). Uses Farrington-Manning method. Margin must be clinically justified.",
  },
  {
    id: "equivalence-proportions",
    label: "Equivalence Proportions (TOST)",
    description: "Sample size for equivalence test of proportions using two one-sided tests.",
    appliesTo: ["rct-2arm-parallel"],
    notes: "Requires equivalence margin. Each one-sided test uses alpha/2. Larger sample size than non-inferiority.",
  },
  {
    id: "two-means",
    label: "Two Means",
    description: "Power for difference in means across two arms (superiority).",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort", "retrospective-cohort"],
    notes: "Require SD or variance inputs and effect size definition.",
  },
  {
    id: "noninferiority-means",
    label: "Non-inferiority Means",
    description: "Sample size for non-inferiority test of means (treatment not worse than control by margin).",
    appliesTo: ["rct-2arm-parallel", "noninferiority-rct"],
    notes: "Requires non-inferiority margin (delta) on the same scale as the outcome. Margin must be clinically justified.",
  },
  {
    id: "equivalence-means",
    label: "Equivalence Means (TOST)",
    description: "Sample size for equivalence test of means using two one-sided tests.",
    appliesTo: ["rct-2arm-parallel"],
    notes: "Requires equivalence margin. Each one-sided test uses alpha/2. Larger sample size than non-inferiority.",
  },
  {
    id: "single-proportion-precision",
    label: "Single Proportion Precision",
    description: "Precision-based sample size for estimating a single proportion.",
    appliesTo: ["single-arm", "registry"],
    notes: "Expose confidence level and desired margin of error.",
  },
  {
    id: "time-to-event-logrank",
    label: "Time-to-event Log-rank",
    description: "Power for survival endpoints using log-rank test assumptions (superiority).",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort", "retrospective-cohort"],
    notes: "Require accrual, follow-up, event rates, and loss to follow-up.",
  },
  {
    id: "noninferiority-time-to-event",
    label: "Non-inferiority Time-to-event",
    description: "Sample size for non-inferiority test of hazard ratios (treatment not worse than control by margin).",
    appliesTo: ["rct-2arm-parallel", "noninferiority-rct"],
    notes: "Requires non-inferiority margin on log hazard ratio scale. Margin must be clinically justified.",
  },
  {
    id: "equivalence-time-to-event",
    label: "Equivalence Time-to-event (TOST)",
    description: "Sample size for equivalence test of hazard ratios using two one-sided tests.",
    appliesTo: ["rct-2arm-parallel"],
    notes: "Requires equivalence margin on log hazard ratio scale. Each one-sided test uses alpha/2.",
  },
  {
    id: "diagnostic-accuracy",
    label: "Diagnostic Accuracy",
    description: "Sample size for sensitivity, specificity, and agreement metrics.",
    appliesTo: ["diagnostic-accuracy"],
    notes: "Require prevalence assumptions and target accuracy thresholds.",
  },
  {
    id: "group-sequential",
    label: "Group Sequential Design",
    description: "Sample size adjustment for group sequential designs with interim analyses.",
    appliesTo: ["rct-2arm-parallel", "adaptive"],
    notes: "Requires number of interim analyses and alpha spending function (O'Brien-Fleming, Pocock, Lan-DeMets). Inflation factor applied.",
  },
  {
    id: "mixed-model-lmm",
    label: "Linear Mixed Model (LMM)",
    description: "Sample size for linear mixed models with repeated measures, accounting for within-subject correlation.",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort"],
    notes: "Requires number of repeated measures and intraclass correlation (ICC). Accounts for within-subject correlation.",
  },
  {
    id: "bayesian",
    label: "Bayesian Sample Size",
    description: "Sample size for Bayesian analysis incorporating prior information.",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort", "retrospective-cohort"],
    notes: "Incorporates prior information. Informative priors may reduce sample size compared to frequentist approach.",
  },
  {
    id: "dropout-adjustment",
    label: "Dropout Adjustment",
    description: "Adjusts base sample size for anticipated dropout.",
    appliesTo: ["rct-2arm-parallel", "prospective-cohort", "retrospective-cohort", "single-arm"],
    notes: "Apply transparent inflation using stated retention assumptions.",
  },
  {
    id: "cluster-design-effect",
    label: "Cluster Design Effect",
    description: "Calculates design effect for cluster studies to scale sample size.",
    appliesTo: ["cluster-rct"],
    notes: "Surface ICC, cluster size, and coefficient of variation.",
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "primary-outcome-defined",
    label: "Primary outcome clearly defined",
    severity: "critical",
    rationale: "Launch blocked until a single, measurable primary outcome is captured.",
  },
  {
    id: "primary-outcome-consistent-across-docs",
    label: "Primary outcome consistent across protocol, SAP, and CRFs",
    severity: "critical",
    rationale: "Conflicting primary outcomes undermine regulatory and ethics submissions.",
  },
  {
    id: "sample-size-justification-present",
    label: "Sample size justification documented",
    severity: "critical",
    rationale: "Review requires transparent basis for participant numbers.",
  },
  {
    id: "pis-icf-mandatory-elements-present",
    label: "PIS/ICF mandatory elements drafted",
    severity: "critical",
    rationale: "Core consent elements must be present before workspace launch.",
  },
  {
    id: "design-supported-or-explicit-advanced",
    label: "Design supported or advanced flow explicitly approved",
    severity: "critical",
    rationale: "Only whitelisted or opted-in advanced designs may proceed.",
  },
  {
    id: "ctri-mapping-core-fields-populated-or-flagged",
    label: "CTRI core fields populated or flagged for PI",
    severity: "warn",
    rationale: "Ensure CTRI alignment or flag gaps before submission work begins.",
  },
];

export const AURORA_RULEBOOK: AuroraRulebook = {
  version: "1.0.0",
  defaultRegulatoryProfileId: "india-v1",
  regulatoryProfiles: [INDIA_PROFILE],
  studyDesigns: [...STUDY_DESIGNS],
  advancedStudyDesigns: [...ADVANCED_STUDY_DESIGNS],
  statsMethods: [...STATS_METHODS],
  preLaunchChecklist: [...CHECKLIST_ITEMS],
  disclaimers: {
    draftNotice:
      "AI-generated draft based on user inputs. Requires PI/IEC review. Not a legal, ethical, or regulatory approval.",
    noRegulatoryClaims:
      "The system must not claim or imply DCGI/IEC/CTRI approvals or fabricate IDs.",
  },
};
