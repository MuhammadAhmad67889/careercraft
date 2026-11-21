import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "./auth";
import { emptyParsedJob, serializeParsedJob, type ParsedJob } from "./jobData";
import {
  dismissDuplicatePair,
  duplicateJobIds,
  duplicatePairKey,
  filterSavedJobs,
  findDuplicatePairs,
  hasActiveFilters,
  listDuplicatePairs,
  listSavedJobs,
  mergeDuplicateJobs,
  normalizeForCompare,
  normalizeUrl,
  savedJobFilterOptions,
  wordSet,
  wordSetSimilarity,
  EMPTY_SAVED_JOB_FILTERS,
  type SavedJobFilters,
  type SavedJobView,
} from "./jobSearch";
import { createResume } from "./resumes";
import { emptyResumeSections } from "./resumeData";

/**
 * Module 9 (Job Search Assistant) tests: filter behavior,
 * duplicate detection (including the false-positive guards),
 * and the dismiss/merge persistence against a real database.
 * Everything is deterministic — no live API involved.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-21T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

let jobCounter = 0;

function makeJob(overrides: Partial<SavedJobView> = {}): SavedJobView {
  jobCounter++;
  const { parsed: parsedOverride, ...rest } = overrides;
  const parsed: ParsedJob = {
    ...emptyParsedJob(),
    requiredSkills: ["React", "TypeScript"],
    ...parsedOverride,
  };
  return {
    applicationStatus: null,
    company: "Example Co",
    createdAt: daysAgo(1),
    id: `job-${jobCounter}`,
    location: "Remote",
    parsed,
    parseMode: "heuristics",
    rawText: "A long enough posting about building React dashboards with a team.",
    sourceUrl: null,
    title: "Frontend Developer",
    updatedAt: daysAgo(1),
    ...rest,
  };
}

function filters(overrides: Partial<SavedJobFilters> = {}): SavedJobFilters {
  return { ...EMPTY_SAVED_JOB_FILTERS, ...overrides };
}

// A realistic posting, long enough to clear the similarity word guard.
const LONG_POSTING = [
  "Frontend Developer at Example Co",
  "What you will do: build and maintain React dashboards for our clients.",
  "Work with designers to ship accessible responsive interfaces every week.",
  "Write tests and review pull requests from the rest of the team.",
  "Requirements: two or more years of experience with React and TypeScript.",
  "Strong HTML and CSS skills and experience with Git and REST APIs.",
  "A bachelor's degree in Computer Science or a related field is required.",
  "Nice to have: Next.js or Node.js experience and familiarity with Tailwind CSS.",
  "We offer a remote friendly team, flexible hours, and a learning budget.",
  "Apply with your CV and a link to your portfolio or GitHub profile today.",
].join(" ");

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe("saved job filters", () => {
  const jobs = [
    makeJob({ company: "Example Co", createdAt: daysAgo(1), id: "a", title: "Frontend Developer" }),
    makeJob({
      company: "Example Co",
      createdAt: daysAgo(10),
      id: "b",
      location: "Lahore",
      parsed: { ...emptyParsedJob(), requiredSkills: ["Node.js", "PostgreSQL"] },
      title: "Backend Developer",
    }),
    makeJob({
      applicationStatus: "Applied",
      company: "Sample Studio",
      createdAt: daysAgo(40),
      id: "c",
      parsed: { ...emptyParsedJob(), requiredSkills: ["Figma"] },
      title: "Product Designer",
    }),
    makeJob({
      applicationStatus: "Interview",
      company: "Sample Studio",
      createdAt: daysAgo(2),
      id: "d",
      parsed: { ...emptyParsedJob(), requiredSkills: ["React", "Next.js"] },
      title: "Full Stack Developer",
    }),
  ];

  it("empty filters return everything, newest first", () => {
    const result = filterSavedJobs(jobs, filters(), NOW);
    expect(result.map((job) => job.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("query matches title, company, location, and skills (case-insensitive)", () => {
    expect(filterSavedJobs(jobs, filters({ query: "frontend" }), NOW).map((j) => j.id)).toEqual(["a"]);
    expect(filterSavedJobs(jobs, filters({ query: "SAMPLE" }), NOW).map((j) => j.id)).toEqual(["d", "c"]);
    expect(filterSavedJobs(jobs, filters({ query: "lahore" }), NOW).map((j) => j.id)).toEqual(["b"]);
    expect(filterSavedJobs(jobs, filters({ query: "postgresql" }), NOW).map((j) => j.id)).toEqual(["b"]);
    expect(filterSavedJobs(jobs, filters({ query: "kubernetes" }), NOW)).toEqual([]);
  });

  it("company and location filters are exact matches", () => {
    expect(filterSavedJobs(jobs, filters({ company: "Example Co" }), NOW).map((j) => j.id)).toEqual(["a", "b"]);
    expect(filterSavedJobs(jobs, filters({ location: "Remote" }), NOW).map((j) => j.id)).toEqual(["a", "d", "c"]);
    expect(filterSavedJobs(jobs, filters({ company: "Nope Inc" }), NOW)).toEqual([]);
  });

  it("skill filter matches required skills only", () => {
    expect(filterSavedJobs(jobs, filters({ skill: "React" }), NOW).map((j) => j.id)).toEqual(["a", "d"]);
    expect(filterSavedJobs(jobs, filters({ skill: "react" }), NOW).map((j) => j.id)).toEqual(["a", "d"]);
    expect(filterSavedJobs(jobs, filters({ skill: "Figma" }), NOW).map((j) => j.id)).toEqual(["c"]);
  });

  it("savedWithinDays keeps only recent jobs", () => {
    expect(filterSavedJobs(jobs, filters({ savedWithinDays: 7 }), NOW).map((j) => j.id)).toEqual(["a", "d"]);
    expect(filterSavedJobs(jobs, filters({ savedWithinDays: 30 }), NOW).map((j) => j.id)).toEqual(["a", "d", "b"]);
    expect(filterSavedJobs(jobs, filters({ savedWithinDays: 90 }), NOW)).toHaveLength(4);
  });

  it("application status filter handles any / not-tracked / a stage", () => {
    expect(filterSavedJobs(jobs, filters({ applicationStatus: "any" }), NOW)).toHaveLength(4);
    expect(filterSavedJobs(jobs, filters({ applicationStatus: "not-tracked" }), NOW).map((j) => j.id)).toEqual(["a", "b"]);
    expect(filterSavedJobs(jobs, filters({ applicationStatus: "Applied" }), NOW).map((j) => j.id)).toEqual(["c"]);
    expect(filterSavedJobs(jobs, filters({ applicationStatus: "Offer" }), NOW)).toEqual([]);
  });

  it("filters combine (all must pass)", () => {
    const result = filterSavedJobs(
      jobs,
      filters({ company: "Sample Studio", savedWithinDays: 7, skill: "React" }),
      NOW,
    );
    expect(result.map((j) => j.id)).toEqual(["d"]);
  });

  it("sort orders: oldest, title, company", () => {
    expect(filterSavedJobs(jobs, filters({ sort: "oldest" }), NOW).map((j) => j.id)).toEqual(["c", "b", "d", "a"]);
    expect(filterSavedJobs(jobs, filters({ sort: "title" }), NOW).map((j) => j.id)).toEqual(["b", "a", "d", "c"]);
    expect(filterSavedJobs(jobs, filters({ sort: "company" }), NOW).map((j) => j.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("filter options come from the jobs themselves, sorted, empties dropped", () => {
    const options = savedJobFilterOptions([
      ...jobs,
      makeJob({ company: "", id: "e", location: "", parsed: { ...emptyParsedJob(), requiredSkills: [] } }),
    ]);
    expect(options.companies).toEqual(["Example Co", "Sample Studio"]);
    expect(options.locations).toEqual(["Lahore", "Remote"]);
    expect(options.skills).toEqual(["Figma", "Next.js", "Node.js", "PostgreSQL", "React", "TypeScript"]);
    expect(options.statuses).toContain("Applied");
    expect(options.statuses).toHaveLength(9);
  });

  it("hasActiveFilters is false only for the defaults", () => {
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ query: " react " }))).toBe(true);
    expect(hasActiveFilters(filters({ sort: "oldest" }))).toBe(true);
    expect(hasActiveFilters(filters({ savedWithinDays: 7 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection helpers
// ---------------------------------------------------------------------------

describe("duplicate detection helpers", () => {
  it("normalizeForCompare ignores case, punctuation, and extra spaces", () => {
    expect(normalizeForCompare("Frontend Developer!")).toBe("frontend developer");
    expect(normalizeForCompare("  FRONTEND   developer ")).toBe("frontend developer");
    expect(normalizeForCompare("Example Co.")).toBe("example co");
    expect(normalizeForCompare("")).toBe("");
  });

  it("normalizeUrl strips tracking params, trailing slash, and host case", () => {
    expect(normalizeUrl("https://Example.com/jobs/1/?utm_source=linkedin&utm_medium=post")).toBe(
      "https://example.com/jobs/1",
    );
    expect(normalizeUrl("https://example.com/jobs/1")).toBe("https://example.com/jobs/1");
    expect(normalizeUrl("https://example.com/jobs/1?ref=abc")).toBe(
      "https://example.com/jobs/1?ref=abc",
    );
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl("  ")).toBeNull();
    expect(normalizeUrl("not a url/")).toBe("not a url");
  });

  it("wordSetSimilarity is 1 for identical sets and 0 for disjoint sets", () => {
    expect(wordSetSimilarity(wordSet("a b c"), wordSet("c b a"))).toBe(1);
    expect(wordSetSimilarity(wordSet("a b"), wordSet("c d"))).toBe(0);
    expect(wordSetSimilarity(wordSet("a b c d"), wordSet("a b e f"))).toBeCloseTo(2 / 6);
  });

  it("duplicatePairKey is order-independent", () => {
    expect(duplicatePairKey("b", "a")).toBe(duplicatePairKey("a", "b"));
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection rules + false-positive guards
// ---------------------------------------------------------------------------

describe("duplicate detection rules", () => {
  it("flags the same posting URL even with tracking params", () => {
    const a = makeJob({ id: "a", sourceUrl: "https://example.com/jobs/1?utm_source=x" });
    const b = makeJob({
      company: "Other Co",
      id: "b",
      rawText: "Completely different words about accounting and spreadsheets here.",
      sourceUrl: "https://example.com/jobs/1",
      title: "Accountant",
    });
    const pairs = findDuplicatePairs([a, b]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reasons).toContain("same-url");
  });

  it("flags same title and company (case/punctuation-insensitive)", () => {
    const a = makeJob({ company: "Example Co.", id: "a", rawText: "Short one.", title: "Frontend Developer!" });
    const b = makeJob({ company: "example co", id: "b", rawText: "Different short text.", title: "frontend developer" });
    const pairs = findDuplicatePairs([a, b]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reasons).toContain("same-title-company");
  });

  it("flags near-identical description text", () => {
    const a = makeJob({ company: "Example Co", id: "a", rawText: LONG_POSTING, title: "Frontend Developer" });
    const b = makeJob({
      company: "Example Co",
      id: "b",
      rawText: `${LONG_POSTING} Apply today!`,
      title: "Frontend Developer (Remote)",
    });
    const pairs = findDuplicatePairs([a, b]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reasons).toContain("similar-text");
    expect(pairs[0].textSimilarity).toBeGreaterThanOrEqual(0.85);
  });

  it("does NOT flag same title at different companies", () => {
    const a = makeJob({ company: "Example Co", id: "a", rawText: "Short text one.", title: "Frontend Developer" });
    const b = makeJob({ company: "Other Co", id: "b", rawText: "Other short text.", title: "Frontend Developer" });
    expect(findDuplicatePairs([a, b])).toEqual([]);
  });

  it("does NOT flag different titles at the same company", () => {
    const a = makeJob({ id: "a", rawText: "Short text one.", title: "Frontend Developer" });
    const b = makeJob({ id: "b", rawText: "Other short text.", title: "Backend Developer" });
    expect(findDuplicatePairs([a, b])).toEqual([]);
  });

  it("does NOT flag on title alone when company is empty on both sides", () => {
    const a = makeJob({ company: "", id: "a", rawText: "Short text one.", title: "Frontend Developer" });
    const b = makeJob({ company: "", id: "b", rawText: "Other short text.", title: "Frontend Developer" });
    expect(findDuplicatePairs([a, b])).toEqual([]);
  });

  it("does NOT flag short texts on similarity (word-count guard)", () => {
    const short = "We are hiring a developer to join our friendly remote team soon.";
    const a = makeJob({ company: "Example Co", id: "a", rawText: short, title: "Developer" });
    const b = makeJob({ company: "Other Co", id: "b", rawText: short, title: "Engineer" });
    expect(findDuplicatePairs([a, b])).toEqual([]);
  });

  it("does NOT flag texts that are similar but below the threshold", () => {
    const otherPosting = [
      "Backend Developer at Example Co",
      "What you will do: design and build REST APIs with Node.js and PostgreSQL.",
      "Own database schema design and migrations for our core product.",
      "Write integration tests for critical endpoints and review pull requests.",
      "Requirements: three or more years of experience with Node.js and TypeScript.",
      "Strong PostgreSQL and SQL skills and experience with Docker pipelines.",
      "A bachelor's degree in Computer Science or a related field is required.",
      "Nice to have: Redis or queue experience and familiarity with AWS.",
      "We offer a remote friendly team, flexible hours, and a learning budget.",
      "Apply with your CV and a link to your portfolio or GitHub profile today.",
    ].join(" ");
    const a = makeJob({ company: "Example Co", id: "a", rawText: LONG_POSTING, title: "Frontend Developer" });
    const b = makeJob({ company: "Example Co", id: "b", rawText: otherPosting, title: "Backend Developer" });
    expect(findDuplicatePairs([a, b])).toEqual([]);
  });

  it("skips dismissed pairs", () => {
    const a = makeJob({ id: "a", rawText: "Short text one." });
    const b = makeJob({ id: "b", rawText: "Short text two." });
    // Same title + company by default fixture, so they would flag.
    expect(findDuplicatePairs([a, b])).toHaveLength(1);
    const dismissed = new Set([duplicatePairKey("a", "b")]);
    expect(findDuplicatePairs([a, b], dismissed)).toEqual([]);
  });

  it("duplicateJobIds collects every flagged id once", () => {
    const a = makeJob({ id: "a", rawText: "Short text one." });
    const b = makeJob({ id: "b", rawText: "Short text two." });
    const c = makeJob({ id: "c", rawText: "Short text three." });
    const ids = duplicateJobIds(findDuplicatePairs([a, b, c]));
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// Persistence: status join, dismiss, merge, isolation (real database)
// ---------------------------------------------------------------------------

const dbFile = join(tmpdir(), `careercraft_p9_test_${randomBytes(6).toString("hex")}.db`);
const dbUrl = `file:${dbFile}`;
let db: PrismaClient;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: join(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
}, 120_000);

afterAll(async () => {
  await db.$disconnect().catch(() => undefined);
  try {
    unlinkSync(dbFile);
  } catch {
    // Already gone — nothing to clean up.
  }
});

async function makeUser(email: string) {
  return db.user.create({
    data: { email, passwordHash: hashPassword("password-123"), plan: "pro" },
  });
}

async function insertJob(
  userId: string,
  overrides: {
    company?: string;
    location?: string;
    rawText?: string;
    sourceUrl?: string | null;
    title?: string;
  } = {},
) {
  return db.jobDescription.create({
    data: {
      company: overrides.company ?? "Example Co",
      location: overrides.location ?? "",
      parseMode: "heuristics",
      parsedJson: serializeParsedJob(emptyParsedJob()),
      rawText: overrides.rawText ?? "A posting about building dashboards with a team.",
      sourceUrl: overrides.sourceUrl ?? null,
      title: overrides.title ?? "Frontend Developer",
      userId,
    },
  });
}

describe("persistence: dismiss, merge, isolation (real database)", () => {
  it("listSavedJobs attaches the latest application status", async () => {
    const user = await makeUser("status@example.com");
    const job = await insertJob(user.id);
    const untracked = await insertJob(user.id, { title: "Backend Developer" });

    await db.jobApplication.create({
      data: {
        company: "Example Co",
        jobDescriptionId: job.id,
        position: "Frontend Developer",
        status: "Applied",
        userId: user.id,
      },
    });

    const saved = await listSavedJobs(user.id, db);
    const byId = new Map(saved.map((entry) => [entry.id, entry]));
    expect(byId.get(job.id)?.applicationStatus).toBe("Applied");
    expect(byId.get(untracked.id)?.applicationStatus).toBeNull();
  });

  it("dismissed pairs stop showing, and dismiss is idempotent", async () => {
    const user = await makeUser("dismiss@example.com");
    const a = await insertJob(user.id);
    const b = await insertJob(user.id, { rawText: "Another copy of the same posting text." });

    expect(await listDuplicatePairs(user.id, db)).toHaveLength(1);

    const first = await dismissDuplicatePair(user.id, a.id, b.id, db);
    expect(first.ok).toBe(true);
    // Same pair again, reversed order — still fine, no error.
    const second = await dismissDuplicatePair(user.id, b.id, a.id, db);
    expect(second.ok).toBe(true);

    expect(await listDuplicatePairs(user.id, db)).toEqual([]);
    expect(await db.duplicateDismissal.count({ where: { userId: user.id } })).toBe(1);
  });

  it("a user cannot dismiss or merge another user's jobs", async () => {
    const userA = await makeUser("iso-a@example.com");
    const userB = await makeUser("iso-b@example.com");
    const jobB1 = await insertJob(userB.id);
    const jobB2 = await insertJob(userB.id, { rawText: "Copy of the posting." });

    const crossDismiss = await dismissDuplicatePair(userA.id, jobB1.id, jobB2.id, db);
    expect(crossDismiss.ok).toBe(false);
    const crossMerge = await mergeDuplicateJobs(userA.id, jobB1.id, jobB2.id, db);
    expect(crossMerge.ok).toBe(false);

    // B's jobs and pairs are untouched.
    expect(await db.jobDescription.count({ where: { userId: userB.id } })).toBe(2);
    expect(await listDuplicatePairs(userB.id, db)).toHaveLength(1);
    expect(await listDuplicatePairs(userA.id, db)).toEqual([]);
  });

  it("merge re-points linked records, fills gaps, and removes the copy", async () => {
    const user = await makeUser("merge@example.com");
    const keep = await insertJob(user.id, { location: "", sourceUrl: null });
    const remove = await insertJob(user.id, {
      location: "Remote",
      rawText: "The same posting saved a second time with more detail.",
      sourceUrl: "https://example.com/jobs/9",
    });

    const resume = await createResume(
      user.id,
      { sections: emptyResumeSections(), title: "Merge CV" },
      db,
    );
    expect(resume.ok).toBe(true);
    if (!resume.ok) return;

    const analysis = await db.jobAnalysis.create({
      data: {
        jobDescriptionId: remove.id,
        overallScore: 80,
        resultJson: "{}",
        resumeId: resume.value.id,
        userId: user.id,
      },
    });
    const application = await db.jobApplication.create({
      data: {
        company: "Example Co",
        jobDescriptionId: remove.id,
        position: "Frontend Developer",
        status: "Interview",
        userId: user.id,
      },
    });

    const merged = await mergeDuplicateJobs(user.id, keep.id, remove.id, db);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    // Gaps on the kept copy were filled from the removed one.
    expect(merged.value.location).toBe("Remote");
    expect(merged.value.sourceUrl).toBe("https://example.com/jobs/9");

    // The removed copy is gone; linked records now point at keep.
    expect(await db.jobDescription.findUnique({ where: { id: remove.id } })).toBeNull();
    const movedAnalysis = await db.jobAnalysis.findUnique({ where: { id: analysis.id } });
    expect(movedAnalysis?.jobDescriptionId).toBe(keep.id);
    const movedApplication = await db.jobApplication.findUnique({
      where: { id: application.id },
    });
    expect(movedApplication?.jobDescriptionId).toBe(keep.id);
    expect(movedApplication?.status).toBe("Interview");

    // No duplicate pairs remain for this user.
    expect(await listDuplicatePairs(user.id, db)).toEqual([]);
  });

  it("merge refuses to merge a job with itself", async () => {
    const user = await makeUser("self-merge@example.com");
    const job = await insertJob(user.id);
    const result = await mergeDuplicateJobs(user.id, job.id, job.id, db);
    expect(result.ok).toBe(false);
    const dismissSelf = await dismissDuplicatePair(user.id, job.id, job.id, db);
    expect(dismissSelf.ok).toBe(false);
  });
});
