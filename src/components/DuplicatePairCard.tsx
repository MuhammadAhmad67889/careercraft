"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  duplicateReasonLabel,
  type DuplicatePairView,
  type SavedJobView,
} from "@/lib/jobSearch";

/**
 * One possible-duplicate pair: the two saved jobs side by side,
 * why they were flagged, and the two ways out — "Not duplicates"
 * (dismiss, never shown again) or merge into one copy. Merge
 * asks for confirmation first and explains that linked analyses
 * and applications move to the kept copy. Nothing happens
 * without the user choosing.
 */

function JobSummary({ job }: { job: SavedJobView }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-semibold">
        {job.title}
        {job.company ? (
          <span className="font-normal text-[var(--color-muted)]">
            {" "}
           , {job.company}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-[var(--color-muted)]">
        {job.location ? `${job.location} , ` : ""}
        Saved {job.createdAt.toLocaleDateString()}
        {job.applicationStatus ? ` , Application: ${job.applicationStatus}` : ""}
      </p>
      <Link
        className="text-sm text-[var(--color-accent)]"
        href={`/jobs/${job.id}`}
      >
        Open this job
      </Link>
    </div>
  );
}

export function DuplicatePairCard({ pair }: { pair: DuplicatePairView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(endpoint: string, body: unknown): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          errors?: { form?: string };
        } | null;
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    await post("/api/job-search/duplicates/dismiss", {
      jobIdA: pair.jobA.id,
      jobIdB: pair.jobB.id,
    });
  }

  async function merge(keep: SavedJobView, remove: SavedJobView) {
    const confirmed = window.confirm(
      `Merge these into one job?\n\n` +
        `Keep: "${keep.title}"${keep.company ? `, ${keep.company}` : ""}\n` +
        `Remove: "${remove.title}"${remove.company ? `, ${remove.company}` : ""}\n\n` +
        `Analyses, ATS reports, cover letters, applications, and interview ` +
        `sessions linked to the removed copy will move to the kept copy. ` +
        `The removed copy's posting text will be deleted.`,
    );
    if (!confirmed) return;
    await post("/api/job-search/duplicates/merge", {
      keepId: keep.id,
      removeId: remove.id,
    });
  }

  const reasonText = pair.reasons.map(duplicateReasonLabel).join(" · ");
  const similarityText =
    pair.textSimilarity !== null
      ? ` Description texts are ${Math.round(pair.textSimilarity * 100)}% similar by shared words.`
      : "";

  return (
    <div className="card">
      <p className="text-sm">
        <span className="warn-badge">Possible duplicate</span>{" "}
        <span className="text-[var(--color-muted)]">
          {reasonText}.{similarityText}
        </span>
      </p>

      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Keeping one copy merges the other into it: its analyses,
        reports, cover letters, and applications move over, then the
        extra copy is removed.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <JobSummary job={pair.jobA} />
          <button
            className="btn-ghost self-start"
            disabled={busy}
            onClick={() => merge(pair.jobA, pair.jobB)}
            type="button"
          >
            Keep this copy
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <JobSummary job={pair.jobB} />
          <button
            className="btn-ghost self-start"
            disabled={busy}
            onClick={() => merge(pair.jobB, pair.jobA)}
            type="button"
          >
            Keep this copy
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={dismiss}
          style={{ padding: "8px 16px" }}
          type="button"
        >
          {busy ? "Working…" : "Not duplicates, keep both"}
        </button>
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  );
}
