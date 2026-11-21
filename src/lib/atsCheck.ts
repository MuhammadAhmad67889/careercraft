import type {
  AtsCheck,
  AtsRecommendation,
  AtsResult,
  ParsedJob,
} from "./jobData";
import {
  sectionHasContent,
  SECTION_LABELS,
  type ResumeSections,
  type SectionId,
} from "./resumeData";
import { resumeFullText, resumeSkillNames } from "./jobMatch";
import { resumeCoversSkill } from "./skillDictionary";

/**
 * The ATS analyzer: deterministic checks on a resume's structure,
 * formatting, keyword coverage (when a job description is given),
 * content quality, and readability.
 *
 * ATS software varies a lot by employer and vendor, so these
 * scores are estimates for guidance — never a promise that any
 * particular system will accept the resume. Every report says so.
 */

function check(
  id: string,
  label: string,
  status: AtsCheck["status"],
  detail: string,
): AtsCheck {
  return { detail, id, label, status };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** All bullet-style lines on the resume, with where they came from. */
function allBullets(sections: ResumeSections): string[] {
  const bullets: string[] = [];
  for (const item of sections.experience) bullets.push(...item.bullets);
  for (const item of sections.projects) bullets.push(...item.bullets);
  for (const item of sections.volunteer) bullets.push(...item.bullets);
  bullets.push(...sections.achievements);
  return bullets.map((bullet) => bullet.trim()).filter(Boolean);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

interface StructureItem {
  id: string;
  label: string;
  points: number;
  present: boolean;
  presentDetail: string;
  missingDetail: string;
  missingStatus: AtsCheck["status"];
}

function structureItems(sections: ResumeSections): StructureItem[] {
  const personal = sections.personal;
  return [
    {
      id: "contact-name",
      label: "Name",
      missingDetail: "No name in the personal section. Every ATS expects one.",
      missingStatus: "fail",
      points: 10,
      present: personal.fullName.trim().length > 0,
      presentDetail: "Your name is in the personal section.",
    },
    {
      id: "contact-email",
      label: "Email address",
      missingDetail: "No email address. Recruiters and ATS software look for one first.",
      missingStatus: "fail",
      points: 10,
      present: personal.email.trim().length > 0,
      presentDetail: "An email address is listed.",
    },
    {
      id: "contact-phone",
      label: "Phone number",
      missingDetail: "No phone number. Many employers still ask for one.",
      missingStatus: "warn",
      points: 5,
      present: personal.phone.trim().length > 0,
      presentDetail: "A phone number is listed.",
    },
    {
      id: "summary",
      label: "Professional summary",
      missingDetail: "No summary. A short summary helps both software and humans place you quickly.",
      missingStatus: "warn",
      points: 15,
      present: sections.summary.trim().length > 0,
      presentDetail: "A professional summary is present.",
    },
    {
      id: "experience",
      label: "Work experience",
      missingDetail: "No work experience entries. Add jobs, internships, or freelance work.",
      missingStatus: "fail",
      points: 20,
      present: sections.experience.length > 0,
      presentDetail: `${sections.experience.length} experience ${sections.experience.length === 1 ? "entry" : "entries"} listed.`,
    },
    {
      id: "education",
      label: "Education",
      missingDetail: "No education entries. Add your degree or current studies.",
      missingStatus: "warn",
      points: 10,
      present: sections.education.length > 0,
      presentDetail: "Education is listed.",
    },
    {
      id: "skills",
      label: "Skills section",
      missingDetail: "No technical skills listed. ATS keyword matching leans heavily on this section.",
      missingStatus: "fail",
      points: 15,
      present: sections.technicalSkills.length > 0,
      presentDetail: `${sections.technicalSkills.length} technical skills listed.`,
    },
    {
      id: "projects",
      label: "Projects",
      missingDetail: "No projects listed. Projects are strong evidence for early-career applicants.",
      missingStatus: "warn",
      points: 10,
      present: sections.projects.length > 0,
      presentDetail: "Projects are listed.",
    },
    {
      id: "certifications",
      label: "Certifications",
      missingDetail: "No certifications listed. Optional, but list any you hold.",
      missingStatus: "warn",
      points: 5,
      present: sections.certifications.length > 0,
      presentDetail: "Certifications are listed.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Characters that commonly confuse resume parsers. Ordinary
 * punctuation, accents, and bullet dots are fine and not flagged. */
const UNUSUAL_SYMBOL_PATTERN = /[\u2600-\u27BF\u2B00-\u2BFF\uFE0F]|\p{Extended_Pictographic}/u;

function formattingChecks(
  sections: ResumeSections,
  enabledSections: SectionId[],
): AtsCheck[] {
  const checks: AtsCheck[] = [];
  const fullText = resumeFullText(sections);

  const unusual = fullText.match(new RegExp(UNUSUAL_SYMBOL_PATTERN.source, "gu"));
  checks.push(
    unusual && unusual.length > 0
      ? check(
          "unusual-symbols",
          "Unusual symbols",
          "warn",
          `Found ${unusual.length} symbol${unusual.length === 1 ? "" : "s"} (like ${[...new Set(unusual)].slice(0, 3).join(" ")}) that some parsers misread. Plain text is safest.`,
        )
      : check(
          "unusual-symbols",
          "Unusual symbols",
          "pass",
          "No symbols that commonly confuse parsers.",
        ),
  );

  const emptyEnabled = enabledSections.filter(
    (sectionId) => !sectionHasContent(sections, sectionId),
  );
  checks.push(
    emptyEnabled.length > 0
      ? check(
          "empty-sections",
          "Empty sections switched on",
          "warn",
          `These sections are switched on but empty: ${emptyEnabled.map((id) => SECTION_LABELS[id]).join(", ")}. Fill them or switch them off.`,
        )
      : check(
          "empty-sections",
          "Empty sections switched on",
          "pass",
          "Every switched-on section has content.",
        ),
  );

  const summaryWords = wordCount(sections.summary);
  checks.push(
    summaryWords > 120
      ? check(
          "summary-length",
          "Summary length",
          "warn",
          `Your summary is ${summaryWords} words. Around 50–100 words reads better and parses cleanly.`,
        )
      : check(
          "summary-length",
          "Summary length",
          "pass",
          sections.summary.trim()
            ? "Summary length is reasonable."
            : "No summary to measure.",
        ),
  );

  // Date-format consistency across experience entries.
  const dateStyles = new Set<string>();
  for (const item of sections.experience) {
    for (const dateText of [item.startDate, item.endDate]) {
      const value = dateText.trim();
      if (!value || /present|current/i.test(value)) continue;
      if (/^\d{4}$/.test(value)) dateStyles.add("year only");
      else if (/^\d{4}-\d{2}$/.test(value)) dateStyles.add("YYYY-MM");
      else if (/^[A-Za-z]+ \d{4}$/.test(value)) dateStyles.add("Month YYYY");
      else dateStyles.add("other");
    }
  }
  checks.push(
    dateStyles.size > 1
      ? check(
          "date-formats",
          "Date formats",
          "warn",
          `Experience dates use mixed formats (${[...dateStyles].join(", ")}). One consistent format parses more reliably.`,
        )
      : check(
          "date-formats",
          "Date formats",
          "pass",
          "Experience dates use one consistent format.",
        ),
  );

  return checks;
}

// ---------------------------------------------------------------------------
// Content quality + readability
// ---------------------------------------------------------------------------

const WEAK_OPENERS = [
  "worked on", "helped", "responsible for", "did ", "was part of",
  "assisted", "tasked with", "involved in",
];

const GENERIC_PHRASES = [
  "hard worker", "team player", "detail-oriented", "detail oriented",
  "fast learner", "go-getter", "think outside the box", "self-starter",
  "results-driven", "results driven", "synergy",
];

function contentChecks(sections: ResumeSections): AtsCheck[] {
  const checks: AtsCheck[] = [];
  const bullets = allBullets(sections);
  const fullText = resumeFullText(sections).toLowerCase();

  const weakBullets = bullets.filter((bullet) =>
    WEAK_OPENERS.some((opener) => bullet.toLowerCase().startsWith(opener)),
  );
  checks.push(
    weakBullets.length > 0
      ? check(
          "weak-verbs",
          "Weak opening verbs",
          "warn",
          `${weakBullets.length} bullet${weakBullets.length === 1 ? "" : "s"} start${weakBullets.length === 1 ? "s" : ""} weakly (e.g. "${weakBullets[0].slice(0, 60)}"). Start with a strong action verb like Built, Led, or Shipped.`,
        )
      : check(
          "weak-verbs",
          "Weak opening verbs",
          "pass",
          bullets.length > 0
            ? "Bullets open with action verbs."
            : "No bullets to check yet.",
        ),
  );

  const genericFound = GENERIC_PHRASES.filter((phrase) => fullText.includes(phrase));
  checks.push(
    genericFound.length > 0
      ? check(
          "generic-phrases",
          "Generic phrases",
          "warn",
          `Generic phrases found: ${genericFound.join(", ")}. Replace them with concrete work you can point to.`,
        )
      : check(
          "generic-phrases",
          "Generic phrases",
          "pass",
          "No common filler phrases found.",
        ),
  );

  const longBullets = bullets.filter((bullet) => wordCount(bullet) > 40);
  checks.push(
    longBullets.length > 0
      ? check(
          "long-bullets",
          "Overly long bullets",
          "warn",
          `${longBullets.length} bullet${longBullets.length === 1 ? " is" : "s are"} over 40 words. Split them so each bullet makes one point.`,
        )
      : check(
          "long-bullets",
          "Overly long bullets",
          "pass",
          "Bullet lengths are reasonable.",
        ),
  );

  const shortBullets = bullets.filter((bullet) => wordCount(bullet) < 4);
  checks.push(
    shortBullets.length > 0
      ? check(
          "short-bullets",
          "Very short bullets",
          "warn",
          `${shortBullets.length} bullet${shortBullets.length === 1 ? " is" : "s are"} under 4 words and carry little information. Add honest detail about what you did.`,
        )
      : check(
          "short-bullets",
          "Very short bullets",
          "pass",
          "No near-empty bullets.",
        ),
  );

  // Concrete detail: bullets with no number and few words often
  // read as vague. This only suggests adding detail the user can
  // back up — never inventing metrics.
  const vagueBullets = bullets.filter(
    (bullet) => !/\d/.test(bullet) && wordCount(bullet) < 8,
  );
  checks.push(
    vagueBullets.length >= 3
      ? check(
          "vague-bullets",
          "Vague bullets",
          "warn",
          `${vagueBullets.length} bullets are short and carry no concrete detail. Where you honestly can, say what you built, for whom, or with what.`,
        )
      : check(
          "vague-bullets",
          "Vague bullets",
          "pass",
          "Bullets carry concrete detail.",
        ),
  );

  // Readability: very long sentences in the summary.
  const sentences = sections.summary
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const longSentences = sentences.filter((sentence) => wordCount(sentence) > 35);
  checks.push(
    longSentences.length > 0
      ? check(
          "long-sentences",
          "Long sentences",
          "warn",
          `${longSentences.length} summary sentence${longSentences.length === 1 ? " is" : "s are"} over 35 words. Shorter sentences are easier to scan.`,
        )
      : check(
          "long-sentences",
          "Long sentences",
          "pass",
          "Sentence lengths are readable.",
        ),
  );

  return checks;
}

// ---------------------------------------------------------------------------
// Keyword coverage (only when a job description is provided)
// ---------------------------------------------------------------------------

function keywordCheck(
  sections: ResumeSections,
  parsed: ParsedJob,
): { coverage: number; result: AtsCheck } {
  const resumeText = resumeFullText(sections);
  const skillNames = resumeSkillNames(sections);
  const allJobSkills = [...parsed.requiredSkills, ...parsed.preferredSkills];
  if (allJobSkills.length === 0) {
    return {
      coverage: 100,
      result: check(
        "keyword-coverage",
        "Keyword coverage",
        "pass",
        "The job description lists no skills to check against.",
      ),
    };
  }
  const missing = allJobSkills.filter(
    (skill) => !resumeCoversSkill(skill, skillNames, resumeText),
  );
  const coverage = clampScore(
    ((allJobSkills.length - missing.length) / allJobSkills.length) * 100,
  );
  const status: AtsCheck["status"] =
    coverage >= 70 ? "pass" : coverage >= 40 ? "warn" : "fail";
  return {
    coverage,
    result: check(
      "keyword-coverage",
      "Keyword coverage",
      status,
      missing.length === 0
        ? `Your resume mentions all ${allJobSkills.length} skills named in the job description.`
        : `Your resume mentions ${allJobSkills.length - missing.length} of ${allJobSkills.length} skills named in the job description. Missing: ${missing.slice(0, 6).join(", ")}.`,
    ),
  };
}

// ---------------------------------------------------------------------------
// The full check
// ---------------------------------------------------------------------------

/**
 * Run every ATS check on a resume, optionally against a parsed
 * job description. Pure and deterministic.
 *
 * Scores: structureScore is the weighted presence of standard
 * sections. documentScore blends structure (50%) with a content
 * score that starts at 100 and loses points per warning/failure
 * in formatting, content, readability, and keyword checks.
 */
export function checkResumeAts(
  sections: ResumeSections,
  enabledSections: SectionId[],
  parsedJob: ParsedJob | null,
): AtsResult {
  const checks: AtsCheck[] = [];

  const items = structureItems(sections);
  let structureScore = 0;
  for (const item of items) {
    if (item.present) structureScore += item.points;
    checks.push(
      check(
        item.id,
        item.label,
        item.present ? "pass" : item.missingStatus,
        item.present ? item.presentDetail : item.missingDetail,
      ),
    );
  }
  structureScore = clampScore(structureScore);

  checks.push(...formattingChecks(sections, enabledSections));
  checks.push(...contentChecks(sections));

  let keywordCoverage: number | null = null;
  if (parsedJob) {
    const keyword = keywordCheck(sections, parsedJob);
    keywordCoverage = keyword.coverage;
    checks.push(keyword.result);
  }

  // Content score: only the non-structure checks cost points.
  const structureIds = new Set(items.map((item) => item.id));
  let penalty = 0;
  for (const entry of checks) {
    if (structureIds.has(entry.id)) continue;
    if (entry.status === "fail") penalty += 12;
    else if (entry.status === "warn") penalty += 5;
  }
  const contentScore = clampScore(100 - penalty);
  const documentScore = clampScore(0.5 * structureScore + 0.5 * contentScore);

  const warnings = checks
    .filter((entry) => entry.status !== "pass")
    .map((entry) => entry.detail);

  const recommendations: AtsRecommendation[] = [];
  for (const entry of checks) {
    if (entry.status === "fail") {
      recommendations.push({ priority: "high", text: entry.detail });
    }
  }
  for (const entry of checks) {
    if (entry.status === "warn") {
      const isStructureGap = structureIds.has(entry.id);
      recommendations.push({
        priority: isStructureGap ? "medium" : "low",
        text: entry.detail,
      });
    }
  }

  return {
    checks,
    documentScore,
    keywordCoverage,
    recommendations: recommendations.slice(0, 12),
    structureScore,
    warnings,
  };
}
