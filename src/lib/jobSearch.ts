import type { PrismaClient } from "@prisma/client";
import { APPLICATION_STATUSES } from "./applications";
import {
  getJobDescriptionForUser,
  listJobDescriptions,
  type JobDescriptionView,
  type JobResult,
} from "./jobs";
import { getPrisma } from "./prisma";

/**
 * Job Search Assistant (module 9): filters over the user's saved
 * job descriptions, plus duplicate detection.
 *
 * Everything here works only on jobs the user saved themselves —
 * nothing is scraped or fetched from job boards. Duplicate
 * detection is deterministic and explainable: a pair is flagged
 * only for a stated reason (same posting URL, same title and
 * company, or near-identical description text), and the user
 * decides what happens next — dismiss the pair or merge the two
 * copies. Nothing is ever deleted silently.
 *
 * Every database function takes the user id and scopes its
 * queries by it, like the rest of the app.
 */

// ---------------------------------------------------------------------------
// Saved jobs with their application status
// ---------------------------------------------------------------------------

/** A saved job plus the status of its most recently updated
 * tracked application, or null when no application is tracked
 * for it yet. */
export interface SavedJobView extends JobDescriptionView {
  applicationStatus: string | null;
}

/** Load the user's saved jobs and attach each one's latest
 * application status (from the Application Tracker). */
export async function listSavedJobs(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<SavedJobView[]> {
  const jobs = await listJobDescriptions(userId, db);
  const applications = await db.jobApplication.findMany({
    orderBy: { updatedAt: "desc" },
    select: { jobDescriptionId: true, status: true },
    where: { jobDescriptionId: { not: null }, userId },
  });

  // Applications come back newest first, so the first one seen
  // for a job is its current status.
  const statusByJob = new Map<string, string>();
  for (const application of applications) {
    if (application.jobDescriptionId && !statusByJob.has(application.jobDescriptionId)) {
      statusByJob.set(application.jobDescriptionId, application.status);
    }
  }

  return jobs.map((job) => ({
    ...job,
    applicationStatus: statusByJob.get(job.id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type SavedJobSort = "newest" | "oldest" | "title" | "company";

export interface SavedJobFilters {
  /** Free text matched against title, company, location, skills. */
  query: string;
  /** Exact company name, or "" for any. */
  company: string;
  /** Exact location, or "" for any. */
  location: string;
  /** One required skill name, or "" for any. */
  skill: string;
  /** Only jobs saved within this many days; null means any time. */
  savedWithinDays: number | null;
  /** "any", "not-tracked", or one of APPLICATION_STATUSES. */
  applicationStatus: string;
  sort: SavedJobSort;
}

export const EMPTY_SAVED_JOB_FILTERS: SavedJobFilters = {
  applicationStatus: "any",
  company: "",
  location: "",
  query: "",
  savedWithinDays: null,
  skill: "",
  sort: "newest",
};

function matchesQuery(job: SavedJobView, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    job.title,
    job.company,
    job.location,
    ...job.parsed.requiredSkills,
    ...job.parsed.preferredSkills,
  ];
  return haystacks.some((text) => text.toLowerCase().includes(needle));
}

function matchesApplicationStatus(job: SavedJobView, wanted: string): boolean {
  if (wanted === "any") return true;
  if (wanted === "not-tracked") return job.applicationStatus === null;
  return job.applicationStatus === wanted;
}

function compareJobs(a: SavedJobView, b: SavedJobView, sort: SavedJobSort): number {
  switch (sort) {
    case "oldest":
      return a.createdAt.getTime() - b.createdAt.getTime();
    case "title":
      return a.title.localeCompare(b.title) || b.createdAt.getTime() - a.createdAt.getTime();
    case "company":
      return (
        a.company.localeCompare(b.company) ||
        a.title.localeCompare(b.title) ||
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    case "newest":
    default:
      return b.createdAt.getTime() - a.createdAt.getTime();
  }
}

/**
 * Apply the Job Search filters to a list of saved jobs. Pure and
 * deterministic: same jobs + same filters + same "now" always
 * give the same result, which is what the tests pin down.
 */
export function filterSavedJobs(
  jobs: SavedJobView[],
  filters: SavedJobFilters,
  now: Date = new Date(),
): SavedJobView[] {
  const cutoff =
    filters.savedWithinDays === null
      ? null
      : now.getTime() - filters.savedWithinDays * 24 * 60 * 60 * 1000;

  const matched = jobs.filter((job) => {
    if (!matchesQuery(job, filters.query)) return false;
    if (filters.company && job.company !== filters.company) return false;
    if (filters.location && job.location !== filters.location) return false;
    if (
      filters.skill &&
      !job.parsed.requiredSkills.some(
        (skill) => skill.toLowerCase() === filters.skill.toLowerCase(),
      )
    ) {
      return false;
    }
    if (cutoff !== null && job.createdAt.getTime() < cutoff) return false;
    if (!matchesApplicationStatus(job, filters.applicationStatus)) return false;
    return true;
  });

  return matched.sort((a, b) => compareJobs(a, b, filters.sort));
}

export interface SavedJobFilterOptions {
  companies: string[];
  locations: string[];
  skills: string[];
  statuses: string[];
}

/** The distinct values the filter dropdowns can offer, built
 * from the user's own saved jobs (never invented). */
export function savedJobFilterOptions(jobs: SavedJobView[]): SavedJobFilterOptions {
  const companies = new Set<string>();
  const locations = new Set<string>();
  const skills = new Set<string>();
  for (const job of jobs) {
    if (job.company.trim()) companies.add(job.company.trim());
    if (job.location.trim()) locations.add(job.location.trim());
    for (const skill of job.parsed.requiredSkills) skills.add(skill);
  }
  const sorted = (values: Set<string>) =>
    [...values].sort((a, b) => a.localeCompare(b));
  return {
    companies: sorted(companies),
    locations: sorted(locations),
    skills: sorted(skills),
    statuses: [...APPLICATION_STATUSES],
  };
}

/** True when any filter differs from the empty defaults — used
 * to show the "clear filters" link and honest result counts. */
export function hasActiveFilters(filters: SavedJobFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.company !== "" ||
    filters.location !== "" ||
    filters.skill !== "" ||
    filters.savedWithinDays !== null ||
    filters.applicationStatus !== "any" ||
    filters.sort !== "newest"
  );
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export type DuplicateReason = "same-url" | "same-title-company" | "similar-text";

export interface DuplicatePair {
  /** The two job ids in sorted order, so a pair is canonical. */
  jobIdA: string;
  jobIdB: string;
  reasons: DuplicateReason[];
  /** Word-set similarity of the two descriptions (0–1) when it
   * was computed, else null. Shown to the user as a percentage. */
  textSimilarity: number | null;
}

/** Plain-English label for each duplicate reason. */
export function duplicateReasonLabel(reason: DuplicateReason): string {
  switch (reason) {
    case "same-url":
      return "Same posting URL";
    case "same-title-company":
      return "Same title and company";
    case "similar-text":
      return "Very similar description text";
  }
}

/** Canonical key for a pair of job ids (sorted, joined). */
export function duplicatePairKey(jobIdA: string, jobIdB: string): string {
  return jobIdA < jobIdB ? `${jobIdA}|${jobIdB}` : `${jobIdB}|${jobIdA}`;
}

/**
 * Normalize text for comparison: lowercase, punctuation becomes
 * spaces, whitespace collapses. "Frontend Developer!" and
 * "frontend  developer" compare equal after this.
 */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a posting URL for comparison: lowercase host, no
 * trailing slash, tracking parameters (utm_*) removed. Returns
 * null for empty input; unparseable URLs fall back to the raw
 * trimmed lowercase string so equality still works.
 */
export function normalizeUrl(url: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) {
      if (!key.toLowerCase().startsWith("utm_")) params.set(key, value);
    }
    const query = params.toString();
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

/** The set of distinct words in a text, normalized. */
export function wordSet(text: string): Set<string> {
  const normalized = normalizeForCompare(text);
  return new Set(normalized ? normalized.split(" ") : []);
}

/**
 * Jaccard similarity of two word sets: shared words divided by
 * all distinct words. 1 means identical word sets, 0 means no
 * shared words. Deterministic and easy to explain.
 */
export function wordSetSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared++;
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Two descriptions count as near-identical at or above this
 * word-set similarity. High on purpose: different postings from
 * the same company share boilerplate but rarely 85% of words. */
export const SIMILAR_TEXT_THRESHOLD = 0.85;

/** Texts shorter than this many distinct words are never flagged
 * on similarity alone — short generic postings overlap too much
 * by chance. */
export const MIN_WORDS_FOR_SIMILARITY = 40;

function duplicateReasonsFor(
  a: JobDescriptionView,
  b: JobDescriptionView,
): { reasons: DuplicateReason[]; textSimilarity: number | null } {
  const reasons: DuplicateReason[] = [];

  const urlA = normalizeUrl(a.sourceUrl);
  const urlB = normalizeUrl(b.sourceUrl);
  if (urlA !== null && urlA === urlB) reasons.push("same-url");

  // Title alone is too weak (every company hires "Frontend
  // Developer"), so the company must match too — and be present.
  const companyA = normalizeForCompare(a.company);
  const companyB = normalizeForCompare(b.company);
  if (
    companyA !== "" &&
    companyA === companyB &&
    normalizeForCompare(a.title) === normalizeForCompare(b.title) &&
    normalizeForCompare(a.title) !== ""
  ) {
    reasons.push("same-title-company");
  }

  const wordsA = wordSet(a.rawText);
  const wordsB = wordSet(b.rawText);
  let textSimilarity: number | null = null;
  if (wordsA.size >= MIN_WORDS_FOR_SIMILARITY && wordsB.size >= MIN_WORDS_FOR_SIMILARITY) {
    textSimilarity = wordSetSimilarity(wordsA, wordsB);
    if (textSimilarity >= SIMILAR_TEXT_THRESHOLD) reasons.push("similar-text");
  }

  return { reasons, textSimilarity };
}

/**
 * Find every pair of saved jobs that look like duplicates of
 * each other, skipping pairs the user already dismissed.
 * `dismissedPairKeys` holds canonical keys from
 * duplicatePairKey(). The result is sorted by pair key so the
 * UI order is stable.
 */
export function findDuplicatePairs(
  jobs: JobDescriptionView[],
  dismissedPairKeys: ReadonlySet<string> = new Set(),
): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      const a = jobs[i];
      const b = jobs[j];
      const key = duplicatePairKey(a.id, b.id);
      if (dismissedPairKeys.has(key)) continue;
      const { reasons, textSimilarity } = duplicateReasonsFor(a, b);
      if (reasons.length === 0) continue;
      const [jobIdA, jobIdB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      pairs.push({ jobIdA, jobIdB, reasons, textSimilarity });
    }
  }
  return pairs.sort((x, y) =>
    duplicatePairKey(x.jobIdA, x.jobIdB).localeCompare(
      duplicatePairKey(y.jobIdA, y.jobIdB),
    ),
  );
}

/** The set of job ids that appear in any duplicate pair — used
 * for the "Possible duplicate" badge in lists. */
export function duplicateJobIds(pairs: DuplicatePair[]): Set<string> {
  const ids = new Set<string>();
  for (const pair of pairs) {
    ids.add(pair.jobIdA);
    ids.add(pair.jobIdB);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Duplicate persistence: dismiss + merge
// ---------------------------------------------------------------------------

export interface DuplicatePairView extends DuplicatePair {
  jobA: SavedJobView;
  jobB: SavedJobView;
}

/** Load the user's possible-duplicate pairs with both jobs
 * attached, minus the pairs already dismissed. */
export async function listDuplicatePairs(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<DuplicatePairView[]> {
  const jobs = await listSavedJobs(userId, db);
  const dismissals = await db.duplicateDismissal.findMany({
    select: { jobIdA: true, jobIdB: true },
    where: { userId },
  });
  const dismissedKeys = new Set(
    dismissals.map((row) => duplicatePairKey(row.jobIdA, row.jobIdB)),
  );
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return findDuplicatePairs(jobs, dismissedKeys).flatMap((pair) => {
    const jobA = byId.get(pair.jobIdA);
    const jobB = byId.get(pair.jobIdB);
    return jobA && jobB ? [{ ...pair, jobA, jobB }] : [];
  });
}

/**
 * Record "these two are not duplicates" so the pair never shows
 * again. Both jobs must belong to the user — an id alone is
 * never enough, same rule as everywhere else.
 */
export async function dismissDuplicatePair(
  userId: string,
  jobIdA: string,
  jobIdB: string,
  db: PrismaClient = getPrisma(),
): Promise<JobResult<true>> {
  if (jobIdA === jobIdB) {
    return { error: "A job cannot be paired with itself.", ok: false };
  }
  const jobA = await getJobDescriptionForUser(userId, jobIdA, db);
  const jobB = await getJobDescriptionForUser(userId, jobIdB, db);
  if (!jobA || !jobB) return { error: "Job description not found.", ok: false };

  const [firstId, secondId] = jobIdA < jobIdB ? [jobIdA, jobIdB] : [jobIdB, jobIdA];
  await db.duplicateDismissal.upsert({
    create: { jobIdA: firstId, jobIdB: secondId, userId },
    update: {},
    where: {
      userId_jobIdA_jobIdB: { jobIdA: firstId, jobIdB: secondId, userId },
    },
  });
  return { ok: true, value: true };
}

/**
 * Merge two saved jobs into one: everything linked to the
 * removed copy (analyses, ATS reports, cover letters,
 * applications, interview sessions) is re-pointed at the kept
 * copy first, missing fields on the kept copy (company,
 * location, source URL) are filled from the removed one, and
 * only then is the removed copy deleted. Runs in one
 * transaction, so a failure midway changes nothing.
 */
export async function mergeDuplicateJobs(
  userId: string,
  keepId: string,
  removeId: string,
  db: PrismaClient = getPrisma(),
): Promise<JobResult<JobDescriptionView>> {
  if (keepId === removeId) {
    return { error: "Choose two different jobs to merge.", ok: false };
  }
  const keep = await getJobDescriptionForUser(userId, keepId, db);
  const remove = await getJobDescriptionForUser(userId, removeId, db);
  if (!keep || !remove) return { error: "Job description not found.", ok: false };

  await db.$transaction(async (tx) => {
    // Fill gaps on the kept copy from the removed one, so no
    // detail the user typed is lost in the merge.
    await tx.jobDescription.update({
      data: {
        company: keep.company.trim() ? keep.company : remove.company,
        location: keep.location.trim() ? keep.location : remove.location,
        sourceUrl: keep.sourceUrl ?? remove.sourceUrl,
      },
      where: { id: keepId },
    });

    // Move every linked record to the kept copy before deleting
    // the removed one (analyses and ATS reports would otherwise
    // cascade-delete with it).
    await tx.jobAnalysis.updateMany({
      data: { jobDescriptionId: keepId },
      where: { jobDescriptionId: removeId, userId },
    });
    await tx.aTSReport.updateMany({
      data: { jobDescriptionId: keepId },
      where: { jobDescriptionId: removeId, userId },
    });
    await tx.coverLetter.updateMany({
      data: { jobDescriptionId: keepId },
      where: { jobDescriptionId: removeId, userId },
    });
    await tx.jobApplication.updateMany({
      data: { jobDescriptionId: keepId },
      where: { jobDescriptionId: removeId, userId },
    });
    await tx.interviewSession.updateMany({
      data: { jobDescriptionId: keepId },
      where: { jobDescriptionId: removeId, userId },
    });

    await tx.jobDescription.delete({ where: { id: removeId } });
    await tx.usageRecord.create({
      data: { detail: `${removeId} merged into ${keepId}`, kind: "job_merge", userId },
    });
  });

  const merged = await getJobDescriptionForUser(userId, keepId, db);
  if (!merged) return { error: "Job description not found.", ok: false };
  return { ok: true, value: merged };
}
