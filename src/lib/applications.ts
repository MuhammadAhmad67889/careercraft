import type { JobApplication, PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma";

/**
 * Application tracker persistence + analytics. Every function
 * takes the user id and scopes its queries by it — an id alone is
 * never enough to reach a row. Every status change writes an
 * ApplicationStatusHistory row in the same transaction, so the
 * timeline and the conversion analytics always agree with the
 * current status.
 */

export type ApplicationResult<T> =
  | { ok: true; value: T }
  | { error: string; ok: false };

/** The nine pipeline stages, in board order. Stored as plain
 * strings (schema must stay SQLite/Postgres compatible) and
 * validated against this list on every write. */
export const APPLICATION_STATUSES = [
  "Saved",
  "Applied",
  "Screening",
  "Assessment",
  "Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export interface ApplicationHistoryEntry {
  changedAt: Date;
  fromStatus: string | null;
  id: string;
  toStatus: string;
}

export interface ApplicationView {
  appliedDate: Date | null;
  company: string;
  coverLetterId: string | null;
  coverLetterTitle: string | null;
  createdAt: Date;
  employmentType: string;
  history: ApplicationHistoryEntry[];
  id: string;
  interviewDate: Date | null;
  interviewNote: string;
  jobDescriptionId: string | null;
  jobTitle: string | null;
  jobUrl: string | null;
  location: string;
  notes: string;
  position: string;
  recruiterEmail: string;
  recruiterName: string;
  resumeId: string | null;
  resumeTitle: string | null;
  salaryRange: string;
  status: ApplicationStatus;
  updatedAt: Date;
}

type ApplicationWithJoins = JobApplication & {
  coverLetter: { title: string } | null;
  history: {
    changedAt: Date;
    fromStatus: string | null;
    id: string;
    toStatus: string;
  }[];
  jobDescription: { title: string } | null;
  resume: { title: string } | null;
};

function toApplicationView(row: ApplicationWithJoins): ApplicationView {
  return {
    appliedDate: row.appliedDate,
    company: row.company,
    coverLetterId: row.coverLetterId,
    coverLetterTitle: row.coverLetter?.title ?? null,
    createdAt: row.createdAt,
    employmentType: row.employmentType,
    history: row.history.map((entry) => ({
      changedAt: entry.changedAt,
      fromStatus: entry.fromStatus,
      id: entry.id,
      toStatus: entry.toStatus,
    })),
    id: row.id,
    interviewDate: row.interviewDate,
    interviewNote: row.interviewNote,
    jobDescriptionId: row.jobDescriptionId,
    jobTitle: row.jobDescription?.title ?? null,
    jobUrl: row.jobUrl,
    location: row.location,
    notes: row.notes,
    position: row.position,
    recruiterEmail: row.recruiterEmail,
    recruiterName: row.recruiterName,
    resumeId: row.resumeId,
    resumeTitle: row.resume?.title ?? null,
    salaryRange: row.salaryRange,
    status: isApplicationStatus(row.status) ? row.status : "Saved",
    updatedAt: row.updatedAt,
  };
}

const APPLICATION_INCLUDE = {
  coverLetter: { select: { title: true } },
  history: { orderBy: { changedAt: "asc" } },
  jobDescription: { select: { title: true } },
  resume: { select: { title: true } },
} as const;

async function recordUsage(
  userId: string,
  kind: string,
  detail: string,
  db: PrismaClient,
): Promise<void> {
  await db.usageRecord.create({ data: { detail, kind, userId } });
}

/** Linked records must belong to the user. Returns an error
 * message when one does not, else null. */
async function linkOwnershipError(
  userId: string,
  links: {
    coverLetterId?: string | null;
    jobDescriptionId?: string | null;
    resumeId?: string | null;
  },
  db: PrismaClient,
): Promise<string | null> {
  if (links.resumeId) {
    const resume = await db.resume.findFirst({
      where: { id: links.resumeId, userId },
    });
    if (!resume) return "Resume not found.";
  }
  if (links.jobDescriptionId) {
    const job = await db.jobDescription.findFirst({
      where: { id: links.jobDescriptionId, userId },
    });
    if (!job) return "Job description not found.";
  }
  if (links.coverLetterId) {
    const letter = await db.coverLetter.findFirst({
      where: { id: links.coverLetterId, userId },
    });
    if (!letter) return "Cover letter not found.";
  }
  return null;
}

export interface CreateApplicationInput {
  appliedDate?: Date | null;
  company: string;
  coverLetterId?: string | null;
  employmentType?: string;
  interviewDate?: Date | null;
  interviewNote?: string;
  jobDescriptionId?: string | null;
  jobUrl?: string | null;
  location?: string;
  notes?: string;
  position: string;
  recruiterEmail?: string;
  recruiterName?: string;
  resumeId?: string | null;
  salaryRange?: string;
  status?: string;
}

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
  db: PrismaClient = getPrisma(),
): Promise<ApplicationResult<ApplicationView>> {
  const company = input.company.trim();
  const position = input.position.trim();
  if (!company || !position) {
    return { error: "Company and position are required.", ok: false };
  }
  const status = input.status ?? "Saved";
  if (!isApplicationStatus(status)) {
    return { error: `Unknown status "${status}".`, ok: false };
  }
  const linkError = await linkOwnershipError(userId, input, db);
  if (linkError) return { error: linkError, ok: false };

  const row = await db.$transaction(async (tx) => {
    const created = await tx.jobApplication.create({
      data: {
        appliedDate: input.appliedDate ?? null,
        company,
        coverLetterId: input.coverLetterId ?? null,
        employmentType: (input.employmentType ?? "").trim(),
        interviewDate: input.interviewDate ?? null,
        interviewNote: (input.interviewNote ?? "").trim(),
        jobDescriptionId: input.jobDescriptionId ?? null,
        jobUrl: input.jobUrl?.trim() ? input.jobUrl.trim() : null,
        location: (input.location ?? "").trim(),
        notes: (input.notes ?? "").trim(),
        position,
        recruiterEmail: (input.recruiterEmail ?? "").trim(),
        recruiterName: (input.recruiterName ?? "").trim(),
        resumeId: input.resumeId ?? null,
        salaryRange: (input.salaryRange ?? "").trim(),
        status,
        userId,
      },
    });
    await tx.applicationStatusHistory.create({
      data: { applicationId: created.id, fromStatus: null, toStatus: status },
    });
    return tx.jobApplication.findUniqueOrThrow({
      include: APPLICATION_INCLUDE,
      where: { id: created.id },
    });
  });
  await recordUsage(userId, "application_create", row.id, db);
  return { ok: true, value: toApplicationView(row) };
}

export interface ListApplicationsOptions {
  search?: string;
  sort?: "newest" | "oldest" | "company";
  status?: string;
}

export async function listApplications(
  userId: string,
  options: ListApplicationsOptions = {},
  db: PrismaClient = getPrisma(),
): Promise<ApplicationView[]> {
  const rows = await db.jobApplication.findMany({
    include: APPLICATION_INCLUDE,
    orderBy:
      options.sort === "oldest"
        ? { createdAt: "asc" }
        : options.sort === "company"
          ? { company: "asc" }
          : { updatedAt: "desc" },
    where: {
      userId,
      ...(options.status && isApplicationStatus(options.status)
        ? { status: options.status }
        : {}),
      ...(options.search?.trim()
        ? {
            OR: [
              { company: { contains: options.search.trim() } },
              { position: { contains: options.search.trim() } },
            ],
          }
        : {}),
    },
  });
  return rows.map(toApplicationView);
}

export async function getApplicationForUser(
  userId: string,
  applicationId: string,
  db: PrismaClient = getPrisma(),
): Promise<ApplicationView | null> {
  const row = await db.jobApplication.findFirst({
    include: APPLICATION_INCLUDE,
    where: { id: applicationId, userId },
  });
  return row ? toApplicationView(row) : null;
}

export async function countApplications(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<number> {
  return db.jobApplication.count({ where: { userId } });
}

export interface UpdateApplicationInput {
  appliedDate?: Date | null;
  company?: string;
  coverLetterId?: string | null;
  employmentType?: string;
  interviewDate?: Date | null;
  interviewNote?: string;
  jobDescriptionId?: string | null;
  jobUrl?: string | null;
  location?: string;
  notes?: string;
  position?: string;
  recruiterEmail?: string;
  recruiterName?: string;
  resumeId?: string | null;
  salaryRange?: string;
  status?: string;
}

/**
 * Update an application. When the status changes, a history row
 * is written in the same transaction. An invalid status is
 * rejected before anything is stored.
 */
export async function updateApplication(
  userId: string,
  applicationId: string,
  input: UpdateApplicationInput,
  db: PrismaClient = getPrisma(),
): Promise<ApplicationResult<ApplicationView>> {
  const existing = await db.jobApplication.findFirst({
    where: { id: applicationId, userId },
  });
  if (!existing) return { error: "Application not found.", ok: false };

  if (input.status !== undefined && !isApplicationStatus(input.status)) {
    return { error: `Unknown status "${input.status}".`, ok: false };
  }
  const linkError = await linkOwnershipError(userId, input, db);
  if (linkError) return { error: linkError, ok: false };

  const statusChanged =
    input.status !== undefined && input.status !== existing.status;

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.jobApplication.update({
      data: {
        ...(input.appliedDate !== undefined
          ? { appliedDate: input.appliedDate }
          : {}),
        ...(input.company !== undefined
          ? { company: input.company.trim() || existing.company }
          : {}),
        ...(input.coverLetterId !== undefined
          ? { coverLetterId: input.coverLetterId }
          : {}),
        ...(input.employmentType !== undefined
          ? { employmentType: input.employmentType.trim() }
          : {}),
        ...(input.interviewDate !== undefined
          ? { interviewDate: input.interviewDate }
          : {}),
        ...(input.interviewNote !== undefined
          ? { interviewNote: input.interviewNote.trim() }
          : {}),
        ...(input.jobDescriptionId !== undefined
          ? { jobDescriptionId: input.jobDescriptionId }
          : {}),
        ...(input.jobUrl !== undefined
          ? { jobUrl: input.jobUrl?.trim() ? input.jobUrl.trim() : null }
          : {}),
        ...(input.location !== undefined
          ? { location: input.location.trim() }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
        ...(input.position !== undefined
          ? { position: input.position.trim() || existing.position }
          : {}),
        ...(input.recruiterEmail !== undefined
          ? { recruiterEmail: input.recruiterEmail.trim() }
          : {}),
        ...(input.recruiterName !== undefined
          ? { recruiterName: input.recruiterName.trim() }
          : {}),
        ...(input.resumeId !== undefined ? { resumeId: input.resumeId } : {}),
        ...(input.salaryRange !== undefined
          ? { salaryRange: input.salaryRange.trim() }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      where: { id: existing.id },
    });
    if (statusChanged) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: existing.id,
          fromStatus: existing.status,
          toStatus: updated.status,
        },
      });
    }
    return tx.jobApplication.findUniqueOrThrow({
      include: APPLICATION_INCLUDE,
      where: { id: existing.id },
    });
  });
  if (statusChanged) {
    await recordUsage(userId, "application_status_change", row.id, db);
  }
  return { ok: true, value: toApplicationView(row) };
}

export async function deleteApplication(
  userId: string,
  applicationId: string,
  db: PrismaClient = getPrisma(),
): Promise<ApplicationResult<true>> {
  const result = await db.jobApplication.deleteMany({
    where: { id: applicationId, userId },
  });
  if (result.count === 0) return { error: "Application not found.", ok: false };
  await recordUsage(userId, "application_delete", applicationId, db);
  return { ok: true, value: true };
}

// ---------------------------------------------------------------------------
// Analytics — computed only from the user's real records. Rates
// are null when there is nothing to divide by, so the UI can show
// an honest empty state instead of a fake 0%.
// ---------------------------------------------------------------------------

export interface ApplicationAnalytics {
  /** Applications per month, keyed "YYYY-MM", oldest first. Uses
   * the applied date when set, else the date the record was made. */
  byMonth: { count: number; month: string }[];
  /** Share (0–100, rounded) that ever reached Offer or Accepted. */
  offerRate: number | null;
  /** Share (0–100, rounded) that ever reached Interview, Offer,
   * or Accepted — including ones later rejected. */
  interviewConversionRate: number | null;
  /** Share (0–100, rounded) currently Rejected. */
  rejectionRate: number | null;
  /** Current count per status; every status is present. */
  statusDistribution: Record<ApplicationStatus, number>;
  total: number;
}

/** The minimum shape analytics needs. reachedStatuses comes from
 * the history rows, so an application rejected after an interview
 * still counts as having reached the interview stage. */
export interface AnalyticsInput {
  appliedDate: Date | null;
  createdAt: Date;
  reachedStatuses: string[];
  status: string;
}

const INTERVIEW_STAGE: string[] = ["Interview", "Offer", "Accepted"];
const OFFER_STAGE: string[] = ["Offer", "Accepted"];

function percent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 100);
}

function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Pure analytics over application records — no database access,
 * so the math is directly unit-testable. */
export function computeApplicationAnalytics(
  applications: AnalyticsInput[],
): ApplicationAnalytics {
  const statusDistribution = Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;

  const monthCounts = new Map<string, number>();
  let reachedInterview = 0;
  let reachedOffer = 0;
  let rejected = 0;

  for (const application of applications) {
    if (isApplicationStatus(application.status)) {
      statusDistribution[application.status] += 1;
    }
    if (application.status === "Rejected") rejected += 1;

    const reached = new Set([...application.reachedStatuses, application.status]);
    if (INTERVIEW_STAGE.some((stage) => reached.has(stage))) reachedInterview += 1;
    if (OFFER_STAGE.some((stage) => reached.has(stage))) reachedOffer += 1;

    const key = monthKey(application.appliedDate ?? application.createdAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const total = applications.length;
  return {
    byMonth: [...monthCounts.entries()]
      .map(([month, count]) => ({ count, month }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    interviewConversionRate: percent(reachedInterview, total),
    offerRate: percent(reachedOffer, total),
    rejectionRate: percent(rejected, total),
    statusDistribution,
    total,
  };
}

export async function getApplicationAnalytics(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<ApplicationAnalytics> {
  const rows = await db.jobApplication.findMany({
    include: { history: { select: { toStatus: true } } },
    where: { userId },
  });
  return computeApplicationAnalytics(
    rows.map((row) => ({
      appliedDate: row.appliedDate,
      createdAt: row.createdAt,
      reachedStatuses: row.history.map((entry) => entry.toStatus),
      status: row.status,
    })),
  );
}
