"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ApplicationCardData {
  appliedDate: string | null;
  company: string;
  id: string;
  location: string;
  position: string;
  status: string;
  updatedAt: string;
}

const STATUSES = [
  "Saved",
  "Applied",
  "Screening",
  "Assessment",
  "Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

/**
 * Application tracker board. Kanban view: drag a card to another
 * column to change its status — the move is saved through the API
 * and rolled back with an error message if the save fails, so a
 * card never silently disappears. List view: search, filter by
 * status, and sort.
 */
export function ApplicationsBoard({
  applications: initialApplications,
}: {
  applications: ApplicationCardData[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  // When the server re-renders with fresh data (after a create or
  // a drag save), adopt it — useState alone would keep the first
  // render's list forever and new cards would never appear.
  const [lastInitial, setLastInitial] = useState(initialApplications);
  if (initialApplications !== lastInitial) {
    setLastInitial(initialApplications);
    setApplications(initialApplications);
  }
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "company">("newest");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moveApplication(applicationId: string, nextStatus: string) {
    const application = applications.find((item) => item.id === applicationId);
    if (!application || application.status === nextStatus) return;
    const previousStatus = application.status;
    setError(null);
    // Optimistic move; rolled back below if the save fails.
    setApplications((current) =>
      current.map((item) =>
        item.id === applicationId ? { ...item, status: nextStatus } : item,
      ),
    );
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        body: JSON.stringify({ status: nextStatus }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          errors?: { form?: string };
        } | null;
        throw new Error(data?.errors?.form ?? "The move could not be saved.");
      }
      router.refresh();
    } catch (moveError) {
      setApplications((current) =>
        current.map((item) =>
          item.id === applicationId ? { ...item, status: previousStatus } : item,
        ),
      );
      setError(
        moveError instanceof Error
          ? moveError.message
          : "The move could not be saved. The card was put back.",
      );
    }
  }

  const visible = applications
    .filter((application) => {
      if (statusFilter && application.status !== statusFilter) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        application.company.toLowerCase().includes(query) ||
        application.position.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sort === "company") return a.company.localeCompare(b.company);
      if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={view === "board" ? "btn-primary" : "btn-ghost"}
          onClick={() => setView("board")}
          type="button"
        >
          Board
        </button>
        <button
          className={view === "list" ? "btn-primary" : "btn-ghost"}
          onClick={() => setView("list")}
          type="button"
        >
          List
        </button>
        <input
          aria-label="Search applications"
          className="field"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search company or position"
          style={{ flex: "1 1 200px" }}
          value={search}
        />
        <select
          aria-label="Filter by status"
          className="field"
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ flex: "0 1 170px" }}
          value={statusFilter}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort applications"
          className="field"
          onChange={(event) =>
            setSort(event.target.value as "newest" | "oldest" | "company")
          }
          style={{ flex: "0 1 150px" }}
          value={sort}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="company">Company A to Z</option>
        </select>
      </div>

      {error && <p className="error-text mt-3">{error}</p>}

      {applications.length === 0 ? (
        <div className="card mt-4">
          <p className="text-sm text-[var(--color-muted)]">
            No applications tracked yet. Add your first one above (company,
            position, and where it stands) and it will appear here.
          </p>
        </div>
      ) : view === "board" ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {STATUSES.map((status) => {
            const inColumn = visible.filter(
              (application) => application.status === status,
            );
            return (
              <section
                aria-label={`${status} column`}
                className="w-56 shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-3"
                key={status}
                onDragLeave={() => setDragOverStatus(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverStatus(status);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverStatus(null);
                  const applicationId = event.dataTransfer.getData("text/plain");
                  if (applicationId) void moveApplication(applicationId, status);
                }}
                style={
                  dragOverStatus === status
                    ? { outline: "2px dashed var(--color-accent)", outlineOffset: "-2px" }
                    : undefined
                }
              >
                <h3 className="flex items-center justify-between text-sm font-semibold">
                  {status}
                  <span className="soon-badge">{inColumn.length}</span>
                </h3>
                <div className="mt-3 space-y-2">
                  {inColumn.map((application) => (
                    <article
                      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3"
                      draggable
                      key={application.id}
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", application.id)
                      }
                    >
                      <Link
                        className="font-medium text-[var(--color-accent)]"
                        href={`/applications/${application.id}`}
                      >
                        {application.position}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {application.company}
                        {application.location ? ` · ${application.location}` : ""}
                      </p>
                      {application.appliedDate && (
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          Applied {application.appliedDate}
                        </p>
                      )}
                    </article>
                  ))}
                  {inColumn.length === 0 && (
                    <p className="text-xs text-[var(--color-muted)]">
                      Drop a card here.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((application) => (
                <tr
                  className="border-b border-[var(--color-line)] last:border-0"
                  key={application.id}
                >
                  <td className="px-4 py-3 font-medium">{application.position}</td>
                  <td className="px-4 py-3">{application.company}</td>
                  <td className="px-4 py-3">{application.status}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {application.appliedDate ?? "Not set"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="text-[var(--color-accent)]"
                      href={`/applications/${application.id}`}
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-[var(--color-muted)]" colSpan={5}>
                    No applications match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
