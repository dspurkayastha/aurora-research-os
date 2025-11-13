import type { PISICFDraft, PISICFSection, StudySpec } from "./types";

function line(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildSections(spec: StudySpec): PISICFSection[] {
  const condition = spec.condition ?? "the health condition under study";
  const population = spec.populationDescription ?? "eligible participants";
  const setting = spec.setting ?? "the study site";
  const visits = spec.visitScheduleSummary ?? "the planned series of visits";
  const primaryEndpoint = spec.primaryEndpoint?.name ?? "the main outcome";

  return [
    {
      id: "intro",
      title: "Invitation to Participate",
      required: true,
      content: line(
        `You are being invited to consider participation in the research study "${spec.title ?? "Study"}" conducted at ${setting}. ` +
          "This document explains what the study involves so that you can decide whether to participate."
      ),
    },
    {
      id: "purpose",
      title: "Purpose of the Study",
      required: true,
      content: line(
        `The study seeks to understand ${primaryEndpoint} in ${population} affected by ${condition}. ` +
          "The findings may help improve future care, but this is research and not standard treatment."
      ),
    },
    {
      id: "procedures",
      title: "Study Procedures and Duration",
      required: true,
      content: line(
        `If you agree to join, you will attend ${visits} where study staff will perform screening, baseline assessments, ` +
          "any required procedures, and follow-up evaluations. You may be asked to provide clinical information, samples, or answer questionnaires."
      ),
    },
    {
      id: "risks",
      title: "Possible Risks and Discomforts",
      required: true,
      content: line(
        "The study may involve discomfort from procedures, collection of personal health information, or unforeseen side effects. " +
          "Study doctors will monitor you closely and you should contact them immediately if you experience any problems."
      ),
    },
    {
      id: "benefits",
      title: "Potential Benefits",
      required: true,
      content: line(
        "You may or may not receive direct personal benefit. The information gathered may help improve care for future patients with similar health conditions."
      ),
    },
    {
      id: "alternatives",
      title: "Alternatives to Participation",
      required: true,
      content: line(
        "Participation is optional. You may continue with standard care or explore other treatments with your doctor without joining this study."
      ),
    },
    {
      id: "confidentiality",
      title: "Confidentiality and Data Protection",
      required: true,
      content: line(
        "Your records will be coded and stored securely. Only authorised members of the study team, institutional ethics committee, or regulators may review them when required by law. No personal identifiers will appear in study reports."
      ),
    },
    {
      id: "compensation_injury",
      title: "Compensation and Medical Care for Injury",
      required: true,
      content: line(
        "If you are injured because of study procedures, medical care will be provided. Compensation or additional support will follow applicable institutional and national policies, which your study doctor will explain."
      ),
    },
    {
      id: "voluntary_right_to_withdraw",
      title: "Voluntary Participation and Withdrawal",
      required: true,
      content: line(
        "Joining the study is entirely your choice. You may refuse or withdraw at any time without affecting your routine care at the hospital."
      ),
    },
    {
      id: "data_use_future",
      title: "Future Use of Data or Samples",
      required: true,
      content: line(
        "With your permission, de-identified data or samples collected in this study may be stored for future ethically approved research. You may decline future use now or withdraw permission later."
      ),
    },
    {
      id: "contacts",
      title: "Contacts for Questions or Complaints",
      required: true,
      content: line(
        "For study-related questions please contact the Principal Investigator or study coordinator. For concerns about your rights, contact the Institutional Ethics Committee office. Phone numbers and email addresses will be provided by the study team."
      ),
    },
    {
      id: "vulnerable_populations",
      title: "Additional Safeguards",
      required: true,
      content: line(
        "If you belong to a vulnerable group such as a child, pregnant woman, or person unable to consent, extra protections including assent and legally acceptable representative consent will be applied as per national guidelines."
      ),
    },
    {
      id: "misc",
      title: "Consent Documentation",
      required: true,
      content: line(
        "This form includes signature or thumbprint blocks for the participant, the person obtaining consent, and a witness when required. Audio-visual recording will be performed if mandated by regulations."
      ),
    },
  ];
}

export function buildPisIcfDraft(studySpec: StudySpec): PISICFDraft {
  const warnings: string[] = [];

  if (!studySpec.primaryEndpoint) {
    warnings.push("Primary endpoint is pending; confirm purpose statements before IEC submission.");
  }
  if (!studySpec.designId) {
    warnings.push("Design classification is not final. Verify procedures, risks, and alternatives with the PI.");
  }

  // Check for language selection - if non-English languages are selected, add a note
  const selectedLanguages = studySpec.selectedLanguages || [];
  const nonEnglishLanguages = selectedLanguages.filter((lang) => 
    lang.toLowerCase() !== "english" && lang.toLowerCase() !== "en"
  );
  
  if (nonEnglishLanguages.length > 0) {
    warnings.push(
      `PIS/ICF requested in additional languages: ${nonEnglishLanguages.join(", ")}. ` +
      `These must be prepared using IEC-approved translations; not auto-generated. ` +
      `English version provided as base document.`
    );
  }

  return {
    sections: buildSections(studySpec),
    warnings,
  };
}

/**
 * Build PIS/ICF draft for a specific language
 * For non-English languages, returns a stub indicating translation is required
 */
export function buildPisIcfDraftForLanguage(
  studySpec: StudySpec,
  language: string
): PISICFDraft {
  const isEnglish = language.toLowerCase() === "english" || language.toLowerCase() === "en";
  
  if (isEnglish) {
    return buildPisIcfDraft(studySpec);
  }
  
  // For non-English languages, return a stub
  const condition = studySpec.condition ?? "the health condition under study";
  const population = studySpec.populationDescription ?? "eligible participants";
  const primaryEndpoint = studySpec.primaryEndpoint?.name ?? "the main outcome";
  
  return {
    sections: [
      {
        id: "translation-notice",
        title: "Translation Notice",
        required: true,
        content: line(
          `This ${language} version of the Participant Information Sheet (PIS) and Informed Consent Form (ICF) ` +
          `must be prepared using an IEC-approved translation of the English version. ` +
          `This is a placeholder document indicating that translation is required. ` +
          `The English version should be translated by a qualified translator and reviewed by the IEC before use.`
        ),
      },
      {
        id: "study-summary",
        title: "Study Summary",
        required: true,
        content: line(
          `Study: ${studySpec.title || "Clinical Research Study"}. ` +
          `This study seeks to understand ${primaryEndpoint} in ${population} affected by ${condition}. ` +
          `Please refer to the English PIS/ICF for complete details.`
        ),
      },
    ],
    warnings: [
      `${language} PIS/ICF translation required. This document is a placeholder and must be replaced with an IEC-approved translation.`,
    ],
  };
}
