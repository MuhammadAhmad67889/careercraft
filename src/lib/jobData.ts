import { z } from "zod";

/**
 * Structured shapes for Phase 3, stored as JSON strings in
 * JobDescription.parsedJson, JobAnalysis.resultJson and
 * ATSReport.resultJson. Everything that reads or writes those
 * columns goes through the Zod schemas here, so a corrupted or
 * hand-edited payload can never reach the UI.
 *
 * Scores in these payloads are transparent estimates produced by
 * the deterministic engine in jobMatch.ts / atsCheck.ts. They are
 * never a real ATS ranking, a pass guarantee, or a hire
 * probability, and the UI labels them as estimates wherever they
 * appear.
 */

const skillName = z.string().trim().min(1).max(80);
const skillList = z.array(skillName).max(80);
const sentence = z.string().trim().min(1).max(500);
const sentenceList = z.array(sentence).max(20);
const score = z.number().min(0).max(100);

/** Education levels the parser and matcher understand, lowest first. */
export const EDUCATION_LEVELS = [
  "none",
  "highschool",
  "diploma",
  "bachelor",
  "master",
  "phd",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export function educationRank(level: EducationLevel): number {
  return EDUCATION_LEVELS.indexOf(level);
}

export function educationLabel(level: EducationLevel): string {
  switch (level) {
    case "phd":
      return "a PhD";
    case "master":
      return "a master's degree";
    case "bachelor":
      return "a bachelor's degree";
    case "diploma":
      return "a diploma";
    case "highschool":
      return "a high-school qualification";
    case "none":
      return "no specific qualification";
  }
}

/** How a job description was parsed: built-in rules (demo mode)
 * or a live model. Shown to the user so a heuristic parse is
 * never dressed up as AI. */
export const parseModeSchema = z.enum(["heuristics", "ai"]);
export type ParseMode = z.infer<typeof parseModeSchema>;

export function parseModeLabel(mode: ParseMode): string {
  return mode === "ai"
    ? "Parsed with AI"
    : "Parsed with built-in rules (Demo AI — no API key set)";
}

/** The structured parse of one job description. */
export const parsedJobSchema = z.object({
  requiredSkills: skillList.default([]),
  preferredSkills: skillList.default([]),
  // Null means the posting does not state a number of years.
  minYearsExperience: z.number().int().min(0).max(60).nullable().default(null),
  // Null means the posting does not state an education requirement.
  educationLevel: z.enum(EDUCATION_LEVELS).nullable().default(null),
  responsibilities: z.array(z.string().trim().min(1).max(400)).max(30).default([]),
});

export type ParsedJob = z.infer<typeof parsedJobSchema>;

export function emptyParsedJob(): ParsedJob {
  return parsedJobSchema.parse({});
}

export function serializeParsedJob(parsed: ParsedJob): string {
  return JSON.stringify(parsedJobSchema.parse(parsed));
}

export function parseParsedJob(parsedJson: string): ParsedJob {
  const raw: unknown = JSON.parse(parsedJson);
  return parsedJobSchema.parse(raw);
}

/** Validate an untrusted parsed-job payload (e.g. from a live
 * model). Returns null instead of throwing so callers can fail
 * loudly with a clear error. */
export function validateParsedJob(input: unknown): ParsedJob | null {
  const parsed = parsedJobSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** One weighted component of a match score, with a plain-English
 * explanation of how the number was reached. */
export const scoreComponentSchema = z.object({
  score,
  weight: z.number().min(0).max(1),
  detail: sentence,
});

export type ScoreComponent = z.infer<typeof scoreComponentSchema>;

/** The full result of one matching run. */
export const analysisResultSchema = z.object({
  overallScore: score,
  components: z.object({
    skills: scoreComponentSchema,
    experience: scoreComponentSchema,
    responsibilities: scoreComponentSchema,
    education: scoreComponentSchema,
    extras: scoreComponentSchema,
  }),
  matchedRequiredSkills: skillList.default([]),
  missingRequiredSkills: skillList.default([]),
  matchedPreferredSkills: skillList.default([]),
  missingPreferredSkills: skillList.default([]),
  keywordCoverage: score,
  experienceAlignment: sentence,
  educationAlignment: sentence,
  strengths: sentenceList.default([]),
  weaknesses: sentenceList.default([]),
  recommendations: sentenceList.default([]),
  // Whether recommendations came from a live model or the
  // rule-based demo layer. Always shown next to them.
  recommendationMode: z.enum(["demo", "live"]),
  recommendationModeLabel: z.string().trim().min(1).max(120),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export function serializeAnalysisResult(result: AnalysisResult): string {
  return JSON.stringify(analysisResultSchema.parse(result));
}

export function parseAnalysisResult(resultJson: string): AnalysisResult {
  const raw: unknown = JSON.parse(resultJson);
  return analysisResultSchema.parse(raw);
}

/** One ATS check outcome. */
export const atsCheckSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  status: z.enum(["pass", "warn", "fail"]),
  detail: sentence,
});

export type AtsCheck = z.infer<typeof atsCheckSchema>;

export const atsRecommendationSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  text: sentence,
});

export type AtsRecommendation = z.infer<typeof atsRecommendationSchema>;

/** The full result of one ATS check. keywordCoverage is null when
 * the check ran without a job description. */
export const atsResultSchema = z.object({
  documentScore: score,
  structureScore: score,
  keywordCoverage: score.nullable(),
  checks: z.array(atsCheckSchema).max(60),
  warnings: sentenceList.default([]),
  recommendations: z.array(atsRecommendationSchema).max(30).default([]),
});

export type AtsResult = z.infer<typeof atsResultSchema>;

export function serializeAtsResult(result: AtsResult): string {
  return JSON.stringify(atsResultSchema.parse(result));
}

export function parseAtsResult(resultJson: string): AtsResult {
  const raw: unknown = JSON.parse(resultJson);
  return atsResultSchema.parse(raw);
}
