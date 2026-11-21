import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DuplicatePairCard } from "@/components/DuplicatePairCard";
import { JobForm } from "@/components/JobForm";
import { JobSearchFilters } from "@/components/JobSearchFilters";
import { APPLICATION_STATUSES } from "@/lib/applications";
import { parseModeLabel } from "@/lib/jobData";
import {
  duplicateJobIds,
  filterSavedJobs,
  hasActiveFilters,
  listDuplicatePairs,
  listSavedJobs,
  savedJobFilterOptions,
  EMPTY_SAVED_JOB_FILTERS,
  type SavedJobFilters,
  type SavedJobSort,
} from "@/lib/jobSearch";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = {
  searchParams: Promise<{
    company?: string;
    location?: string;
    q?: string;
    skill?: string;
    sort?: string;
    status?: string;
    within?: string;
  }>;
};

const SORTS: SavedJobSort[] = ["newest", "oldest", "title", "company"];
const WITHIN_DAYS = [7, 30, 90];

/** Read the filters from the URL, keeping only values the
 * dropdowns can actually offer — a hand-edited URL falls back
 * to "any" instead of silently matching nothing. */
function parseFilters(
  params: Awaited<PageContext["searchParams"]>,
  options: ReturnType<typeof savedJobFilterOptions>,
): SavedJobFilters {
  const within = Number(params.within);
  const status =
    params.status === "not-tracked" ||
    (APPLICATION_STATUSES as readonly string[]).includes(params.status ?? "")
      ? (params.status as string)
      : "any";
  return {
    ...EMPTY_SAVED_JOB_FILTERS,
    applicationStatus: status,
    company: options.companies.includes(params.company ?? "")
      ? (params.company as string)
      : "",
    location: options.locations.includes(params.location ?? "")
      ? (params.location as string)
      : "",
    query: params.q ?? "",
    savedWithinDays: WITHIN_DAYS.includes(within) ? within : null,
    skill: options.skills.includes(params.skill ?? "")
      ? (params.skill as string)
      : "",
    sort: SORTS.includes(params.sort as SavedJobSort)
      ? (params.sort as SavedJobSort)
      : "newest",
  };
}

export default async function JobSearchPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const jobs = await listSavedJobs(user.id);
  const options = savedJobFilterOptions(jobs);
  const filters = parseFilters(await context.searchParams, options);
  const visibleJobs = filterSavedJobs(jobs, filters);
  const duplicatePairs = await listDuplicatePairs(user.id);
  const flaggedIds = duplicateJobIds(duplicatePairs);
  const filtersActive = hasActiveFilters(filters);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Job search</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Every job you save, in one place. Filter by company, location,
        skill, or application status, and sort out copies of the same
        posting. These are the same saved jobs used for matching.
        Nothing here is scraped or fetched for you.
      </p>

      <div className="mt-6">
        <JobForm />
      </div>

      {duplicatePairs.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold">
            Possible duplicates ({duplicatePairs.length})
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            These pairs look like the same posting saved twice. Nothing
            is removed automatically. Merge a pair into one job, or
            mark it as not duplicates and it will not be shown again.
          </p>
          {duplicatePairs.map((pair) => (
            <DuplicatePairCard
              key={`${pair.jobIdA}|${pair.jobIdB}`}
              pair={pair}
            />
          ))}
        </section>
      )}

      <div className="mt-6">
        <JobSearchFilters
          filters={filters}
          options={options}
          showClear={filtersActive}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">
          Saved jobs{" "}
          <span className="font-normal text-[var(--color-muted)]">
            ({filtersActive
              ? `showing ${visibleJobs.length} of ${jobs.length}`
              : jobs.length})
          </span>
        </h2>
        {jobs.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No saved jobs yet. Add one above by pasting a posting or
              importing it from its URL, and it will show up here for
              filtering and matching.
            </p>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No saved jobs match these filters.{" "}
              <Link className="text-[var(--color-accent)]" href="/job-search">
                Clear the filters
              </Link>{" "}
              to see all {jobs.length} saved jobs.
            </p>
          </div>
        ) : (
          visibleJobs.map((job) => (
            <div className="card flex flex-wrap items-center gap-3" key={job.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {job.title}
                  {job.company ? (
                    <span className="font-normal text-[var(--color-muted)]">
                      {" "}
                     , {job.company}
                    </span>
                  ) : null}{" "}
                  {flaggedIds.has(job.id) && (
                    <span className="warn-badge">Possible duplicate</span>
                  )}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  {job.location ? `${job.location} , ` : ""}
                  {job.parsed.requiredSkills.length} required skills ,{" "}
                  {parseModeLabel(job.parseMode)}, Saved{" "}
                  {job.createdAt.toLocaleDateString()}
                  {job.applicationStatus
                    ? ` , Application: ${job.applicationStatus}`
                    : " , Not tracked yet"}
                </p>
              </div>
              <Link
                className="btn-primary"
                href={`/jobs/${job.id}`}
                style={{ padding: "8px 16px" }}
              >
                Open
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
