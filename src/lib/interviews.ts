import type {
  InterviewFeedback,
  InterviewQuestion,
  InterviewSession,
  PrismaClient,
} from "@prisma/client";
import type { AiMode } from "./aiImprove";
import {
  buildInterviewReport,
  parseFeedbackScores,
  type FeedbackScores,
  type InterviewReport,
  type InterviewStatus,
  type InterviewType,
} from "./interviewData";
import {
  DEMO_QUESTION_BANK,
  generateFeedback,
  generateQuestions,
  type GeneratedQuestion,
  type InterviewFacts,
} from "./interviewQuestions";
import { getJobDescriptionForUser } from "./jobs";
import { interviewLimitMessage, planOf } from "./plans";
import { getPrisma } from "./prisma";
import { getOrCreateProfile, stringToList } from "./profile";
import { getResumeForUser } from "./resumes";

/**
 * Mock interview sessions: create, answer, report. Every query is
 * user-scoped. The monthly plan limit is checked before a session
 * is created. In live mode a provider failure throws and nothing
 * is saved (routes answer 502) — demo questions or feedback are
 * never silently substituted.
 */

export type InterviewResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

export interface FeedbackView {
  answerText: string;
  feedbackText: string;
  generationMode: AiMode;
  scores: FeedbackScores;
}

export interface QuestionView {
  feedback: FeedbackView | null;
  id: string;
  order: number;
  questionText: string;
  topic: string;
}

export interface InterviewSessionView {
  createdAt: Date;
  generationMode: AiMode;
  id: string;
  interviewType: InterviewType;
  jobDescriptionId: string | null;
  jobTitle: string | null;
  questions: QuestionView[];
  report: InterviewReport;
  resumeId: string | null;
  status: InterviewStatus;
}

type SessionWithJoins = InterviewSession & {
  jobDescription: { title: string } | null;
  questions: (InterviewQuestion & { feedback: InterviewFeedback | null })[];
};

function toFeedbackView(row: InterviewFeedback): FeedbackView | null {
  const scores = parseFeedbackScores(row.scoresJson);
  if (!scores) return null;
  return {
    answerText: row.answerText,
    feedbackText: row.feedbackText,
    generationMode: row.generationMode === "live" ? "live" : "demo",
    scores,
  };
}

function toSessionView(row: SessionWithJoins): InterviewSessionView {
  const questions: QuestionView[] = row.questions.map((question) => ({
    feedback: question.feedback ? toFeedbackView(question.feedback) : null,
    id: question.id,
    order: question.order,
    questionText: question.questionText,
    topic: question.topic,
  }));
  const entries = questions
    .filter((question) => question.feedback !== null)
    .map((question) => ({
      clarity: question.feedback!.scores.clarity,
      completeness: question.feedback!.scores.completeness,
      overall: question.feedback!.scores.overall,
      relevance: question.feedback!.scores.relevance,
      topic: question.topic,
    }));
  return {
    createdAt: row.createdAt,
    generationMode: row.generationMode === "live" ? "live" : "demo",
    id: row.id,
    interviewType: row.interviewType as InterviewType,
    jobDescriptionId: row.jobDescriptionId,
    jobTitle: row.jobDescription?.title ?? null,
    questions,
    report: buildInterviewReport(entries, questions.length),
    resumeId: row.resumeId,
    status: row.status === "completed" ? "completed" : "active",
  };
}

const SESSION_INCLUDE = {
  jobDescription: { select: { title: true } },
  questions: {
    include: { feedback: true },
    orderBy: { order: "asc" },
  },
} as const;

async function recordUsage(
  userId: string,
  kind: string,
  detail: string,
  db: PrismaClient,
): Promise<void> {
  await db.usageRecord.create({ data: { detail, kind, userId } });
}

/** How many mock interviews this user has started in the current
 * calendar month, counted from UsageRecords. */
export async function interviewsUsedThisMonth(
  userId: string,
  db: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<number> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return db.usageRecord.count({
    where: { createdAt: { gte: monthStart }, kind: "interview_start", userId },
  });
}

export interface CreateInterviewInput {
  interviewType: InterviewType;
  jobDescriptionId?: string | null;
  resumeId?: string | null;
}

/**
 * Start a mock interview session. The linked job and resume (when
 * given) must belong to the user; the monthly plan limit is
 * checked before any work. Question generation runs before
 * anything is saved, so a live-mode failure leaves no half-made
 * session behind.
 */
export async function createInterviewSession(
  userId: string,
  input: CreateInterviewInput,
  db: PrismaClient = getPrisma(),
): Promise<InterviewResult<InterviewSessionView>> {
  let targetRole = "";
  let requiredSkills: string[] = [];
  let preferredSkills: string[] = [];
  if (input.jobDescriptionId) {
    const job = await getJobDescriptionForUser(userId, input.jobDescriptionId, db);
    if (!job) return { error: "Job description not found.", ok: false };
    targetRole = job.title;
    requiredSkills = job.parsed.requiredSkills;
    preferredSkills = job.parsed.preferredSkills;
  }

  let candidateSkills: string[] = [];
  if (input.resumeId) {
    const resume = await getResumeForUser(userId, input.resumeId, db);
    if (!resume) return { error: "Resume not found.", ok: false };
    candidateSkills = resume.sections.technicalSkills;
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found.", ok: false };
  const plan = planOf(user.plan);
  const used = await interviewsUsedThisMonth(userId, db);
  if (used >= plan.maxInterviewsPerMonth) {
    return { error: interviewLimitMessage(user.plan), ok: false };
  }

  const profile = await getOrCreateProfile(userId, db);
  if (candidateSkills.length === 0) {
    candidateSkills = stringToList(profile.technicalSkills);
  }
  if (!targetRole) targetRole = profile.targetPosition;

  const facts: InterviewFacts = {
    candidateSkills,
    experienceLevel: profile.experienceLevel,
    interviewType: input.interviewType,
    preferredSkills,
    requiredSkills,
    targetRole,
  };
  const generated = await generateQuestions(facts);

  const session = await db.interviewSession.create({
    data: {
      generationMode: generated.mode,
      interviewType: input.interviewType,
      jobDescriptionId: input.jobDescriptionId ?? null,
      questions: {
        create: generated.questions.map((question, index) => ({
          order: index + 1,
          questionText: question.questionText,
          topic: question.topic,
        })),
      },
      resumeId: input.resumeId ?? null,
      userId,
    },
    include: SESSION_INCLUDE,
  });
  await recordUsage(userId, "interview_start", session.id, db);
  return { ok: true, value: toSessionView(session) };
}

export async function listInterviewSessions(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<InterviewSessionView[]> {
  const rows = await db.interviewSession.findMany({
    include: SESSION_INCLUDE,
    orderBy: { createdAt: "desc" },
    where: { userId },
  });
  return rows.map(toSessionView);
}

export async function getInterviewSessionForUser(
  userId: string,
  sessionId: string,
  db: PrismaClient = getPrisma(),
): Promise<InterviewSessionView | null> {
  const row = await db.interviewSession.findFirst({
    include: SESSION_INCLUDE,
    where: { id: sessionId, userId },
  });
  return row ? toSessionView(row) : null;
}

export async function countInterviewSessions(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<number> {
  return db.interviewSession.count({ where: { userId } });
}

/**
 * Submit an answer to one question and store its feedback. The
 * question must belong to a session owned by this user, and each
 * question can be answered once. Answering the last unanswered
 * question completes the session. In live mode a provider failure
 * throws and nothing is saved.
 */
export async function answerInterviewQuestion(
  userId: string,
  sessionId: string,
  questionId: string,
  answerText: string,
  db: PrismaClient = getPrisma(),
): Promise<InterviewResult<InterviewSessionView>> {
  const session = await db.interviewSession.findFirst({
    include: { questions: { include: { feedback: true }, orderBy: { order: "asc" } } },
    where: { id: sessionId, userId },
  });
  if (!session) return { error: "Interview session not found.", ok: false };
  if (session.status === "completed") {
    return { error: "This interview is already completed.", ok: false };
  }

  const question = session.questions.find((entry) => entry.id === questionId);
  if (!question) return { error: "Question not found.", ok: false };
  if (question.feedback) {
    return { error: "You have already answered this question.", ok: false };
  }

  const trimmed = answerText.trim();
  if (!trimmed) return { error: "Write an answer first.", ok: false };

  // Demo feedback needs the question's keywords. They are not
  // stored, so rebuild the generated question shape from the
  // stored text and topic: the bank lookup happens by exact text.
  const generated = generatedQuestionFor(question);
  const feedback = await generateFeedback(generated, trimmed);

  await db.interviewFeedback.create({
    data: {
      answerText: trimmed,
      feedbackText: feedback.feedbackText,
      generationMode: feedback.mode,
      questionId: question.id,
      scoresJson: JSON.stringify(feedback.scores),
      userId,
    },
  });
  await recordUsage(userId, "interview_answer", question.id, db);

  const answeredCount = session.questions.filter(
    (entry) => entry.feedback !== null,
  ).length;
  if (answeredCount + 1 >= session.questions.length) {
    await db.interviewSession.update({
      data: { status: "completed" },
      where: { id: session.id },
    });
  }

  const updated = await getInterviewSessionForUser(userId, sessionId, db);
  if (!updated) return { error: "Interview session not found.", ok: false };
  return { ok: true, value: updated };
}

/** Rebuild the generated-question shape for a stored question so
 * demo feedback can use its keywords. Bank questions are matched
 * by exact text; skill questions are matched by their template. */
export function generatedQuestionFor(question: {
  questionText: string;
  topic: string;
}): GeneratedQuestion {
  return {
    keywords: keywordsForQuestionText(question.questionText, question.topic),
    questionText: question.questionText,
    topic: question.topic,
  };
}

function keywordsForQuestionText(questionText: string, topic: string): string[] {
  for (const bank of Object.values(DEMO_QUESTION_BANK)) {
    const match = bank.find((entry) => entry.questionText === questionText);
    if (match) return match.keywords;
  }
  // Skill-template questions ("This role asks for X...") carry the
  // skill as their topic.
  if (questionText.startsWith("This role asks for ") && topic) {
    return [topic.toLowerCase(), "experience", "project", "learn", "used"];
  }
  return [];
}

export async function deleteInterviewSession(
  userId: string,
  sessionId: string,
  db: PrismaClient = getPrisma(),
): Promise<InterviewResult<true>> {
  const result = await db.interviewSession.deleteMany({
    where: { id: sessionId, userId },
  });
  if (result.count === 0) {
    return { error: "Interview session not found.", ok: false };
  }
  await recordUsage(userId, "interview_delete", sessionId, db);
  return { ok: true, value: true };
}
