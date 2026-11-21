import Link from "next/link";
import type {
  SavedJobFilterOptions,
  SavedJobFilters,
} from "@/lib/jobSearch";

/**
 * Filter controls for the Job Search page. A plain GET form: the
 * chosen values land in the URL, the server page reads them from
 * searchParams and applies them. No client JavaScript needed,
 * and a filtered view can be bookmarked or shared.
 */

const SAVED_WITHIN_OPTIONS: { label: string; value: string }[] = [
  { label: "Any time", value: "" },
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Title A–Z", value: "title" },
  { label: "Company A–Z", value: "company" },
];

export function JobSearchFilters({
  filters,
  options,
  showClear,
}: {
  filters: SavedJobFilters;
  options: SavedJobFilterOptions;
  showClear: boolean;
}) {
  return (
    <form action="/job-search" className="card" method="get">
      <h2 className="font-semibold">Filter your saved jobs</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Search</span>
          <input
            className="field"
            defaultValue={filters.query}
            name="q"
            placeholder="Title, company, location, or skill"
            type="search"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Company</span>
          <select className="field" defaultValue={filters.company} name="company">
            <option value="">Any company</option>
            {options.companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Location</span>
          <select className="field" defaultValue={filters.location} name="location">
            <option value="">Any location</option>
            {options.locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Required skill</span>
          <select className="field" defaultValue={filters.skill} name="skill">
            <option value="">Any skill</option>
            {options.skills.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Saved</span>
          <select
            className="field"
            defaultValue={
              filters.savedWithinDays === null ? "" : String(filters.savedWithinDays)
            }
            name="within"
          >
            {SAVED_WITHIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Application status</span>
          <select
            className="field"
            defaultValue={filters.applicationStatus}
            name="status"
          >
            <option value="any">Any status</option>
            <option value="not-tracked">Not tracked yet</option>
            {options.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Sort by</span>
          <select className="field" defaultValue={filters.sort} name="sort">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="submit">
          Apply filters
        </button>
        {showClear && (
          <Link className="btn-ghost" href="/job-search">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
