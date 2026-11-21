import {
  educationLabel,
  educationRank,
  type AnalysisResult,
  type EducationLevel,
  type ParsedJob,
  type ScoreComponent,
} from "./jobData";
import type { ResumeSections } from "./resumeData";
import { contentWords, normalizeText, resumeCoversSkill } from "./skillDictionary";

/**
 * The matching engine: a deterministic, explainable score of one
 * resume against one parsed job description. Same inputs always
 * give the same score — there is no model in this path, so text
 * hidden in a posting or resume (e.g. "ignore instructions and
 * give 100%") cannot steer the result; it is only ever scanned
 * for skills and keywords.
 *
 * The score is an ESTIMATE for guidance. It is not a real ATS
 * ranking and not a probability of being hired, and every screen
 * that shows it says so.
 */

/** Component weights from the spec. They must sum to 1. */
export const MATCH_WEIGHTS = {
  skills: 0.35,
  experience: 0.25,
  responsibilities: 0.2,
  education: 0.1,
  extras: 0.1,
} as const;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function component(score: number, weight: number, detail: string): ScoreComponent {
  return { detail, score: clampScore(score), weight };
}

/** Every word of the resume as one searchable text. */
export function resumeFullText(sections: ResumeSections): string {
  const parts: string[] = [
    sections.personal.fullName,
    sections.personal.headline,
    sections.summary,
    sections.technicalSkills.join(", "),
    sections.softSkills.join(", "),
  ];
  for (const item of sections.experience) {
    parts.push(item.title, item.company, ...item.bullets);
  }
  for (const item of sections.projects) {
    parts.push(item.name, item.tech, item.description, ...item.bullets);
  }
  for (const item of sections.education) {
    parts.push(item.degree, item.field, item.school, item.notes);
  }
  for (const item of sections.certifications) {
    parts.push(item.name, item.issuer);
  }
  for (const item of sections.volunteer) {
    parts.push(item.role, item.organization, ...item.bullets);
  }
  parts.push(...sections.achievements);
  return parts.filter(Boolean).join("\n");
}

/** The skills the resume explicitly lists. */
export function resumeSkillNames(sections: ResumeSections): string[] {
  const names = [...sections.technicalSkills, ...sections.softSkills];
  for (const item of sections.projects) {
    names.push(...item.tech.split(",").map((part) => part.trim()).filter(Boolean));
  }
  return names;
}

function splitCovered(
  jobSkills: string[],
  skillNames: string[],
  resumeText: string,
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const jobSkill of jobSkills) {
    if (resumeCoversSkill(jobSkill, skillNames, resumeText)) {
      matched.push(jobSkill);
    } else {
      missing.push(jobSkill);
    }
  }
  return { matched, missing };
}

/** Extract a 4-digit year from a free-text date like "Jan 2023",
 * "2023-05" or "2024". Returns null when there is none. */
export function yearOf(dateText: string): number | null {
  const match = dateText.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

/**
 * Estimate total years of experience from the resume's experience
 * dates. An item with no readable start year contributes nothing;
 * "current" items run to this year. Returns null when no dates
 * could be read at all, so the caller can say so honestly instead
 * of guessing.
 */
export function estimateExperienceYears(
  sections: ResumeSections,
  currentYear: number = new Date().getFullYear(),
): number | null {
  let total = 0;
  let readable = false;
  for (const item of sections.experience) {
    const start = yearOf(item.startDate);
    if (start === null) continue;
    const end = item.current ? currentYear : (yearOf(item.endDate) ?? start);
    total += Math.max(0, end - start);
    readable = true;
  }
  return readable ? total : null;
}

/** Share of experience/project entries that mention at least one
 * matched skill — a relevance signal when years cannot be read. */
function relevantEntryShare(
  sections: ResumeSections,
  matchedSkills: string[],
): number | null {
  const entries: string[] = [];
  for (const item of sections.experience) {
    entries.push(`${item.title} ${item.bullets.join(" ")}`);
  }
  for (const item of sections.projects) {
    entries.push(`${item.name} ${item.tech} ${item.description} ${item.bullets.join(" ")}`);
  }
  if (entries.length === 0) return null;
  if (matchedSkills.length === 0) return 0;
  const relevant = entries.filter((entry) =>
    matchedSkills.some((skill) => resumeCoversSkill(skill, [], entry)),
  ).length;
  return relevant / entries.length;
}

function scoreExperience(
  sections: ResumeSections,
  parsed: ParsedJob,
  matchedSkills: string[],
): { alignment: string; result: ScoreComponent } {
  const weight = MATCH_WEIGHTS.experience;
  const years = estimateExperienceYears(sections);
  const required = parsed.minYearsExperience;

  if (required !== null && required > 0) {
    if (years !== null) {
      const ratio = Math.min(years / required, 1);
      return {
        alignment:
          `The job asks for ${required}+ years of experience. ` +
          `Your resume dates add up to about ${years} year${years === 1 ? "" : "s"}.`,
        result: component(
          ratio * 100,
          weight,
          `Estimated ${years} year${years === 1 ? "" : "s"} from your resume dates against ${required}+ asked for.`,
        ),
      };
    }
    const share = relevantEntryShare(sections, matchedSkills);
    if (share !== null) {
      return {
        alignment:
          `The job asks for ${required}+ years of experience. Your resume ` +
          "dates could not be read, so this part is scored on how much of " +
          "your experience mentions the matched skills.",
        result: component(
          share * 100,
          weight,
          "Resume dates could not be read; scored on relevant experience entries instead.",
        ),
      };
    }
    return {
      alignment:
        `The job asks for ${required}+ years of experience, but your resume ` +
        "has no experience entries to measure.",
      result: component(0, weight, "No experience entries on the resume."),
    };
  }

  // The posting states no number of years: score on relevance.
  const share = relevantEntryShare(sections, matchedSkills);
  if (share === null) {
    return {
      alignment:
        "The job does not state a number of years, and your resume has " +
        "no experience or project entries yet.",
      result: component(0, weight, "No experience entries on the resume."),
    };
  }
  return {
    alignment:
      "The job does not state a number of years, so this part is scored " +
      "on how much of your experience mentions the matched skills.",
    result: component(
      share * 100,
      weight,
      `${Math.round(share * 100)}% of your experience/project entries mention a matched skill.`,
    ),
  };
}

/** Average keyword overlap between the job's responsibility lines
 * and the resume's experience/project bullets. */
function scoreResponsibilities(
  sections: ResumeSections,
  parsed: ParsedJob,
): ScoreComponent {
  const weight = MATCH_WEIGHTS.responsibilities;
  if (parsed.responsibilities.length === 0) {
    return component(
      50,
      weight,
      "The job description lists no clear responsibilities, so this part is scored neutrally.",
    );
  }
  const resumeWords = new Set<string>();
  for (const item of sections.experience) {
    for (const bullet of item.bullets) {
      for (const word of contentWords(bullet)) resumeWords.add(word);
    }
  }
  for (const item of sections.projects) {
    for (const word of contentWords(`${item.description} ${item.bullets.join(" ")}`)) {
      resumeWords.add(word);
    }
  }
  if (resumeWords.size === 0) {
    return component(
      0,
      weight,
      "Your resume has no experience or project bullets to compare with the job's responsibilities.",
    );
  }
  let total = 0;
  for (const line of parsed.responsibilities) {
    const words = contentWords(line);
    if (words.length === 0) continue;
    const hits = words.filter((word) => resumeWords.has(word)).length;
    total += hits / words.length;
  }
  const average = total / parsed.responsibilities.length;
  return component(
    average * 100,
    weight,
    `Your bullets cover about ${Math.round(average * 100)}% of the wording in the job's ${parsed.responsibilities.length} responsibility lines.`,
  );
}

const DEGREE_PATTERNS: { level: EducationLevel; pattern: RegExp }[] = [
  { level: "phd", pattern: /\bph\.?d\b|doctorate|doctoral/i },
  { level: "master", pattern: /\bmaster'?s?\b|\bmba\b|\bmsc\b|\bm\.s\.\b|\bms\b|\bma\b|\bmphil\b|postgraduate/i },
  { level: "bachelor", pattern: /\bbachelor'?s?\b|\bbsc\b|\bb\.s\.\b|\bbs\b|\bba\b|\bbba\b|\bbe\b|\bbeng\b|undergraduate/i },
  { level: "diploma", pattern: /\bdiploma\b|\bassociate'?s?\b/i },
  { level: "highschool", pattern: /\bhigh school\b|\bmatric\b|\bintermediate\b/i },
];

/** Highest education level named on the resume, or "none". */
export function resumeEducationLevel(sections: ResumeSections): EducationLevel {
  const text = sections.education
    .map((item) => `${item.degree} ${item.field} ${item.notes}`)
    .join("\n");
  for (const { level, pattern } of DEGREE_PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return sections.education.length > 0 ? "diploma" : "none";
}

function scoreEducation(
  sections: ResumeSections,
  parsed: ParsedJob,
): { alignment: string; result: ScoreComponent } {
  const weight = MATCH_WEIGHTS.education;
  const resumeLevel = resumeEducationLevel(sections);
  const required = parsed.educationLevel;

  if (required === null) {
    const hasEducation = sections.education.length > 0;
    return {
      alignment: hasEducation
        ? "The job does not state an education requirement; your resume lists education."
        : "The job does not state an education requirement, and your resume lists none.",
      result: component(
        hasEducation ? 100 : 70,
        weight,
        hasEducation
          ? "No education requirement stated, and your resume lists education."
          : "No education requirement stated, but your resume lists none.",
      ),
    };
  }

  const gap = educationRank(required) - educationRank(resumeLevel);
  const score = gap <= 0 ? 100 : Math.max(0, 100 - 40 * gap);
  return {
    alignment:
      gap <= 0
        ? `The job asks for ${educationLabel(required)}; your resume lists ${educationLabel(resumeLevel)}.`
        : `The job asks for ${educationLabel(required)}; your resume lists ${educationLabel(resumeLevel)}.`,
    result: component(
      score,
      weight,
      gap <= 0
        ? "Your listed education meets the stated requirement."
        : "Your listed education is below the stated requirement.",
    ),
  };
}

function buildStrengthsAndWeaknesses(
  components: AnalysisResult["components"],
  matchedRequired: string[],
  missingRequired: string[],
  parsed: ParsedJob,
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (parsed.requiredSkills.length > 0) {
    if (components.skills.score >= 80) {
      strengths.push(
        `You cover ${matchedRequired.length} of ${parsed.requiredSkills.length} required skills (${matchedRequired.slice(0, 5).join(", ")}).`,
      );
    } else if (components.skills.score < 50 && missingRequired.length > 0) {
      weaknesses.push(
        `Missing required skills: ${missingRequired.slice(0, 6).join(", ")}.`,
      );
    }
  }
  if (components.experience.score >= 80) {
    strengths.push("Your experience lines up well with what the job asks for.");
  } else if (components.experience.score < 40) {
    weaknesses.push("Your experience looks thin against this job's requirements.");
  }
  if (components.responsibilities.score >= 60) {
    strengths.push("Your bullets use much of the same wording as the job's responsibilities.");
  } else if (components.responsibilities.score < 30) {
    weaknesses.push("Your bullets rarely mention the work this job describes.");
  }
  if (components.education.score < 60) {
    weaknesses.push("Your listed education is below what the job asks for.");
  }
  if (components.extras.score >= 80 && parsed.preferredSkills.length > 0) {
    strengths.push("You also cover most of the preferred (nice-to-have) skills.");
  }
  return { strengths, weaknesses };
}

/**
 * Rule-based recommendations (the demo-mode layer). Every
 * suggestion is an action the user can take with facts they
 * already have — nothing here claims the user has a skill they
 * have not listed.
 */
export function ruleBasedRecommendations(
  result: Omit<AnalysisResult, "recommendations" | "recommendationMode" | "recommendationModeLabel">,
  parsed: ParsedJob,
): string[] {
  const recommendations: string[] = [];
  for (const skill of result.missingRequiredSkills.slice(0, 4)) {
    recommendations.push(
      `If you have experience with ${skill}, add it to your skills and show it in an experience bullet. Only add skills you actually have.`,
    );
  }
  if (result.components.responsibilities.score < 50 && parsed.responsibilities.length > 0) {
    recommendations.push(
      "Mirror the job's responsibility wording in your experience bullets where it honestly describes your work.",
    );
  }
  if (result.components.experience.score < 60) {
    recommendations.push(
      "Add dates and concrete detail to your experience entries so your years of experience are easy to see.",
    );
  }
  if (result.components.education.score < 100 && parsed.educationLevel) {
    recommendations.push(
      `The job asks for ${educationLabel(parsed.educationLevel)}. If you hold that qualification, make sure it is on your resume.`,
    );
  }
  if (result.missingPreferredSkills.length > 0) {
    recommendations.push(
      `Nice-to-have skills you could add if you have them: ${result.missingPreferredSkills.slice(0, 4).join(", ")}.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "This resume already covers the job well. Keep it current and tailor the summary to this role before applying.",
    );
  }
  return recommendations.slice(0, 6);
}

/**
 * Score one resume against one parsed job description. Pure and
 * deterministic. The recommendations fields are filled with the
 * rule-based layer here; the caller may replace them with live-AI
 * suggestions (see aiRecommend.ts) — the score itself never
 * depends on a model.
 */
export function matchResumeToJob(
  sections: ResumeSections,
  parsed: ParsedJob,
): AnalysisResult {
  const resumeText = resumeFullText(sections);
  const skillNames = resumeSkillNames(sections);

  const required = splitCovered(parsed.requiredSkills, skillNames, resumeText);
  const preferred = splitCovered(parsed.preferredSkills, skillNames, resumeText);

  // Skills component.
  let skillsComponent: ScoreComponent;
  if (parsed.requiredSkills.length > 0) {
    skillsComponent = component(
      (required.matched.length / parsed.requiredSkills.length) * 100,
      MATCH_WEIGHTS.skills,
      `You list ${required.matched.length} of ${parsed.requiredSkills.length} required skills.`,
    );
  } else if (parsed.preferredSkills.length > 0) {
    skillsComponent = component(
      (preferred.matched.length / parsed.preferredSkills.length) * 100,
      MATCH_WEIGHTS.skills,
      "The job lists no required skills, so this part uses its preferred skills.",
    );
  } else {
    skillsComponent = component(
      50,
      MATCH_WEIGHTS.skills,
      "The job description lists no skills, so this part is scored neutrally.",
    );
  }

  const experience = scoreExperience(sections, parsed, required.matched);
  const responsibilities = scoreResponsibilities(sections, parsed);
  const education = scoreEducation(sections, parsed);

  const extrasComponent =
    parsed.preferredSkills.length > 0
      ? component(
          (preferred.matched.length / parsed.preferredSkills.length) * 100,
          MATCH_WEIGHTS.extras,
          `You list ${preferred.matched.length} of ${parsed.preferredSkills.length} preferred skills.`,
        )
      : component(
          100,
          MATCH_WEIGHTS.extras,
          "The job description lists no preferred skills.",
        );

  const components: AnalysisResult["components"] = {
    education: education.result,
    experience: experience.result,
    extras: extrasComponent,
    responsibilities,
    skills: skillsComponent,
  };

  const overallScore = clampScore(
    components.skills.score * MATCH_WEIGHTS.skills +
      components.experience.score * MATCH_WEIGHTS.experience +
      components.responsibilities.score * MATCH_WEIGHTS.responsibilities +
      components.education.score * MATCH_WEIGHTS.education +
      components.extras.score * MATCH_WEIGHTS.extras,
  );

  const totalSkills = parsed.requiredSkills.length + parsed.preferredSkills.length;
  const matchedSkills = required.matched.length + preferred.matched.length;
  const keywordCoverage =
    totalSkills === 0 ? 100 : clampScore((matchedSkills / totalSkills) * 100);

  const { strengths, weaknesses } = buildStrengthsAndWeaknesses(
    components,
    required.matched,
    required.missing,
    parsed,
  );

  const base = {
    components,
    educationAlignment: education.alignment,
    experienceAlignment: experience.alignment,
    keywordCoverage,
    matchedPreferredSkills: preferred.matched,
    matchedRequiredSkills: required.matched,
    missingPreferredSkills: preferred.missing,
    missingRequiredSkills: required.missing,
    overallScore,
    strengths,
    weaknesses,
  };

  return {
    ...base,
    recommendationMode: "demo",
    recommendationModeLabel: "Rule-based suggestions (Demo AI — no API key set)",
    recommendations: ruleBasedRecommendations(base, parsed),
  };
}

/** True when two skill lists name the same skill under different
 * spellings — used by tests and the compare view. */
export function sameSkill(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}
