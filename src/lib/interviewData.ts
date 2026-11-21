import { z } from "zod";

/**
 * Shared shapes for mock interviews: the interview types, the
 * feedback score schema (stored as a JSON string in
 * InterviewFeedback.scoresJson and validated on every read and
 * write), and the final report shape.
 *
 * Feedback here is practice guidance only. Nothing in this module
 * claims to measure personality or employability — the scores
 * describe the typed answer (length, structure, keyword coverage,
 * or a model's reading of it), never the person.
 */

export const INTERVIEW_TYPES = [
  "technical",
  "behavioral",
  "hr",
  "system-design",
  "situational",
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  hr: "HR",
  "system-design": "System design",
  situational: "Situational",
};

export function isInterviewType(value: string): value is InterviewType {
  return (INTERVIEW_TYPES as readonly string[]).includes(value);
}

export const INTERVIEW_STATUSES = ["active", "completed"] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** How many questions one session asks. */
export const QUESTIONS_PER_SESSION = 5;

/**
 * Scores for one answer. Each dimension is 0–100 and describes
 * the answer text only. `checks` lists the plain observations
 * behind the numbers so the user can see why.
 */
export const feedbackScoresSchema = z.object({
  clarity: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  relevance: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  checks: z.array(z.string().trim().min(1).max(300)).max(10),
});

export type FeedbackScores = z.infer<typeof feedbackScoresSchema>;

/** Parse a stored scoresJson string. Returns null when the stored
 * value does not validate — callers must handle that honestly
 * instead of guessing. */
export function parseFeedbackScores(json: string): FeedbackScores | null {
  try {
    const parsed = feedbackScoresSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The final report for a completed session, aggregated from the
 * per-question feedback. Averages are plain means of the stored
 * scores; strengths/weaknesses name the strongest and weakest
 * dimensions; study topics come from the lowest-scoring answers. */
export interface InterviewReport {
  answeredCount: number;
  questionCount: number;
  averageOverall: number | null;
  averageClarity: number | null;
  averageCompleteness: number | null;
  averageRelevance: number | null;
  strengths: string[];
  weaknesses: string[];
  studyTopics: string[];
}

export interface ReportEntry {
  overall: number;
  clarity: number;
  completeness: number;
  relevance: number;
  topic: string;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

const DIMENSION_LABELS: Record<"clarity" | "completeness" | "relevance", string> = {
  clarity: "Clarity of writing",
  completeness: "Completeness of answers",
  relevance: "Relevance to the question",
};

/**
 * Aggregate per-answer scores into the final report. Pure and
 * deterministic: the same entries always produce the same report,
 * so nothing in an answer's text can steer the summary.
 */
export function buildInterviewReport(
  entries: ReportEntry[],
  questionCount: number,
): InterviewReport {
  const averages = {
    clarity: average(entries.map((entry) => entry.clarity)),
    completeness: average(entries.map((entry) => entry.completeness)),
    relevance: average(entries.map((entry) => entry.relevance)),
  };
  const ranked = (
    Object.entries(averages) as ["clarity" | "completeness" | "relevance", number | null][]
  )
    .filter((entry): entry is ["clarity" | "completeness" | "relevance", number] => entry[1] !== null)
    .sort((a, b) => b[1] - a[1]);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (ranked.length > 0) {
    const [bestKey, bestScore] = ranked[0];
    strengths.push(
      `${DIMENSION_LABELS[bestKey]} was your strongest area (average ${bestScore}/100).`,
    );
    const [worstKey, worstScore] = ranked[ranked.length - 1];
    if (worstKey !== bestKey) {
      weaknesses.push(
        `${DIMENSION_LABELS[worstKey]} scored lowest (average ${worstScore}/100). ` +
          "Practising this area is likely to help most.",
      );
    }
  }

  // Study topics: the topics of the two lowest-scoring answers,
  // de-duplicated, in score order.
  const weakest = [...entries].sort((a, b) => a.overall - b.overall);
  const studyTopics: string[] = [];
  for (const entry of weakest) {
    const topic = entry.topic.trim();
    if (topic && !studyTopics.includes(topic)) studyTopics.push(topic);
    if (studyTopics.length >= 3) break;
  }

  return {
    answeredCount: entries.length,
    questionCount,
    averageOverall: average(entries.map((entry) => entry.overall)),
    averageClarity: averages.clarity,
    averageCompleteness: averages.completeness,
    averageRelevance: averages.relevance,
    strengths,
    weaknesses,
    studyTopics,
  };
}

/** The disclaimer shown with every piece of interview feedback. */
export const FEEDBACK_DISCLAIMER =
  "This feedback is practice guidance based on your typed answers. " +
  "It does not measure your personality or employability, and it " +
  "cannot predict how a real interview will go.";
