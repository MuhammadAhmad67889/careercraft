import type {
  ATSReport,
  JobAnalysis,
  JobDescription,
  PrismaClient,
} from "@prisma/client";
import { generateRecommendations } from "./aiRecommend";
import { checkResumeAts } from "./atsCheck";
import {
  parseAnalysisResult,
  parseAtsResult,
  parseParsedJob,
  serializeAnalysisResult,
  serializeAtsResult,
  serializeParsedJob,
  type AnalysisResult,
  type AtsResult,
  type ParsedJob,
  type ParseMode,
} from "./jobData";
import { matchResumeToJob } from "./jobMatch";
import { parseJobDescription } from "./jobParse";
import { analysisLimitMessage, planOf } from "./plans";
import { getPrisma } from "./prisma";
import { getResumeForUser } from "./resumes";

/**
 * Job matching + ATS persistence. Every function takes the user
 * id and scopes its queries by it — an id alone is never enough
 * to reach a row. The isolation tests prove one user cannot read
 * another's job descriptions, analyses, or reports.
 */

export type JobResult<T> = { ok: true; value: T } | { error: string; ok: false };

export interface JobDescriptionView {
  company: string;
  createdAt: Date;
  id: string;
  location: string;
  parsed: ParsedJob;
  parseMode: ParseMode;
  rawText: string;
  sourceUrl: string | null;
  title: string;
  updatedAt: Date;
}

export function toJobDescriptionView(row: JobDescription): JobDescriptionView {
  return {
    company: row.company,
    createdAt: row.createdAt,
    id: row.id,
    location: row.location,
    parsed: parseParsedJob(row.parsedJson),
    parseMode: row.parseMode === "ai" ? "ai" : "heuristics",
    rawText: row.rawText,
    sourceUrl: row.sourceUrl,
    title: row.title,
    updatedAt: row.updatedAt,
  };
}

export interface JobAnalysisView {
  company: string;
  createdAt: Date;
  id: string;
  jobDescriptionId: string;
  jobTitle: string;
  overallScore: number;
  result: AnalysisResult;
  resumeId: string;
  resumeTitle: string;
}

type AnalysisWithJoins = JobAnalysis & {
  jobDescription: { company: string; title: string };
  resume: { title: string };
};

function toJobAnalysisView(row: AnalysisWithJoins): JobAnalysisView {
  return {
    company: row.jobDescription.company,
    createdAt: row.createdAt,
    id: row.id,
    jobDescriptionId: row.jobDescriptionId,
    jobTitle: row.jobDescription.title,
    overallScore: row.overallScore,
    result: parseAnalysisResult(row.resultJson),
    resumeId: row.resumeId,
    resumeTitle: row.resume.title,
  };
}

export interface AtsReportView {
  createdAt: Date;
  documentScore: number;
  id: string;
  jobDescriptionId: string | null;
  jobTitle: string | null;
  result: AtsResult;
  resumeId: string;
  resumeTitle: string;
}

type ReportWithJoins = ATSReport & {
  jobDescription: { title: string } | null;
  resume: { title: string };
};

function toAtsReportView(row: ReportWithJoins): AtsReportView {
  return {
    createdAt: row.createdAt,
    documentScore: row.documentScore,
    id: row.id,
    jobDescriptionId: row.jobDescriptionId,
    jobTitle: row.jobDescription?.title ?? null,
    result: parseAtsResult(row.resultJson),
    resumeId: row.resumeId,
    resumeTitle: row.resume.title,
  };
}

async function recordUsage(
  userId: string,
  kind: string,
  detail: string,
  db: PrismaClient,
): Promise<void> {
  await db.usageRecord.create({ data: { detail, kind, userId } });
}

// ---------------------------------------------------------------------------
// Job descriptions
// ---------------------------------------------------------------------------

export interface CreateJobDescriptionInput {
  company: string;
  location?: string;
  rawText: string;
  sourceUrl?: string | null;
  title: string;
}

/**
 * Save a job description and parse it. Parsing runs before the
 * save: in live mode a provider failure throws and nothing is
 * stored, so a heuristic parse is never passed off as AI.
 */
export async function createJobDescription(
  userId: string,
  input: CreateJobDescriptionInput,
  db: PrismaClient = getPrisma(),
): Promise<JobResult<JobDescriptionView>> {
  const rawText = input.rawText.trim();
  if (rawText.length < 50) {
    return {
      error: "That job description looks too short. Paste the full posting text.",
      ok: false,
    };
  }
  const { mode, parsed } = await parseJobDescription(rawText);
  const row = await db.jobDescription.create({
    data: {
      company: input.company.trim(),
      location: (input.location ?? "").trim(),
      parseMode: mode,
      parsedJson: serializeParsedJob(parsed),
      rawText,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title.trim() || "Untitled job",
      userId,
    },
  });
  await recordUsage(userId, "job_create", row.id, db);
  return { ok: true, value: toJobDescriptionView(row) };
}

export async function listJobDescriptions(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<JobDescriptionView[]> {
  const rows = await db.jobDescription.findMany({
    orderBy: { updatedAt: "desc" },
    where: { userId },
  });
  return rows.map(toJobDescriptionView);
}

export async function getJobDescriptionForUser(
  userId: string,
  jobDescriptionId: string,
  db: PrismaClient = getPrisma(),
): Promise<JobDescriptionView | null> {
  const row = await db.jobDescription.findFirst({
    where: { id: jobDescriptionId, userId },
  });
  return row ? toJobDescriptionView(row) : null;
}

// ---------------------------------------------------------------------------
// Job analyses (matching runs)
// ---------------------------------------------------------------------------

/** How many analyses this user has run in the current calendar
 * month, counted from UsageRecords. */
export async function analysesUsedThisMonth(
  userId: string,
  db: PrismaClient = getPrisma(),
  now: Date = new Date(),
): Promise<number> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return db.usageRecord.count({
    where: { createdAt: { gte: monthStart }, kind: "job_analysis", userId },
  });
}

/**
 * Run the matching engine for one resume against one job
 * description and save the result. Both records must belong to
 * the user. The monthly plan limit is checked before any work.
 * In live mode, a recommendation failure throws and nothing is
 * saved (the route answers 502).
 */
export async function runJobAnalysis(
  userId: string,
  resumeId: string,
  jobDescriptionId: string,
  db: PrismaClient = getPrisma(),
): Promise<JobResult<JobAnalysisView>> {
  const resume = await getResumeForUser(userId, resumeId, db);
  if (!resume) return { error: "Resume not found.", ok: false };
  const job = await getJobDescriptionForUser(userId, jobDescriptionId, db);
  if (!job) return { error: "Job description not found.", ok: false };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found.", ok: false };
  const plan = planOf(user.plan);
  const used = await analysesUsedThisMonth(userId, db);
  if (used >= plan.maxAnalysesPerMonth) {
    return { error: analysisLimitMessage(user.plan), ok: false };
  }

  const matched = matchResumeToJob(resume.sections, job.parsed);
  const recommendations = await generateRecommendations(matched, job.parsed);
  const result: AnalysisResult = {
    ...matched,
    recommendationMode: recommendations.mode,
    recommendationModeLabel: recommendations.modeLabel,
    recommendations: recommendations.recommendations,
  };

  const row = await db.jobAnalysis.create({
    data: {
      jobDescriptionId,
      overallScore: result.overallScore,
      resultJson: serializeAnalysisResult(result),
      resumeId,
      userId,
    },
    include: {
      jobDescription: { select: { company: true, title: true } },
      resume: { select: { title: true } },
    },
  });
  await recordUsage(userId, "job_analysis", row.id, db);
  return { ok: true, value: toJobAnalysisView(row) };
}

export async function listJobAnalyses(
  userId: string,
  db: PrismaClient = getPrisma(),
  jobDescriptionId?: string,
): Promise<JobAnalysisView[]> {
  const rows = await db.jobAnalysis.findMany({
    include: {
      jobDescription: { select: { company: true, title: true } },
      resume: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { userId, ...(jobDescriptionId ? { jobDescriptionId } : {}) },
  });
  return rows.map(toJobAnalysisView);
}

export async function getJobAnalysisForUser(
  userId: string,
  analysisId: string,
  db: PrismaClient = getPrisma(),
): Promise<JobAnalysisView | null> {
  const row = await db.jobAnalysis.findFirst({
    include: {
      jobDescription: { select: { company: true, title: true } },
      resume: { select: { title: true } },
    },
    where: { id: analysisId, userId },
  });
  return row ? toJobAnalysisView(row) : null;
}

export async function countJobAnalyses(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<number> {
  return db.jobAnalysis.count({ where: { userId } });
}

// ---------------------------------------------------------------------------
// ATS reports
// ---------------------------------------------------------------------------

/**
 * Run the ATS checks for one resume, optionally against one of
 * the user's job descriptions (for keyword coverage), and save
 * the report. ATS checks are not capped by the monthly analysis
 * limit; usage is still recorded.
 */
export async function runAtsCheck(
  userId: string,
  resumeId: string,
  jobDescriptionId: string | null,
  db: PrismaClient = getPrisma(),
): Promise<JobResult<AtsReportView>> {
  const resume = await getResumeForUser(userId, resumeId, db);
  if (!resume) return { error: "Resume not found.", ok: false };

  let parsedJob: ParsedJob | null = null;
  if (jobDescriptionId) {
    const job = await getJobDescriptionForUser(userId, jobDescriptionId, db);
    if (!job) return { error: "Job description not found.", ok: false };
    parsedJob = job.parsed;
  }

  const result = checkResumeAts(resume.sections, resume.enabledSections, parsedJob);
  const row = await db.aTSReport.create({
    data: {
      documentScore: result.documentScore,
      jobDescriptionId,
      resultJson: serializeAtsResult(result),
      resumeId,
      userId,
    },
    include: {
      jobDescription: { select: { title: true } },
      resume: { select: { title: true } },
    },
  });
  await recordUsage(userId, "ats_report", row.id, db);
  return { ok: true, value: toAtsReportView(row) };
}

export async function listAtsReports(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<AtsReportView[]> {
  const rows = await db.aTSReport.findMany({
    include: {
      jobDescription: { select: { title: true } },
      resume: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    where: { userId },
  });
  return rows.map(toAtsReportView);
}

export async function getAtsReportForUser(
  userId: string,
  reportId: string,
  db: PrismaClient = getPrisma(),
): Promise<AtsReportView | null> {
  const row = await db.aTSReport.findFirst({
    include: {
      jobDescription: { select: { title: true } },
      resume: { select: { title: true } },
    },
    where: { id: reportId, userId },
  });
  return row ? toAtsReportView(row) : null;
}

export async function countAtsReports(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<number> {
  return db.aTSReport.count({ where: { userId } });
}
