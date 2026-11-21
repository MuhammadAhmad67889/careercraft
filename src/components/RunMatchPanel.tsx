"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MatchResumeOption {
  id: string;
  title: string;
}

/**
 * Pick one or more resumes and run the match against this job.
 * Each run counts toward the monthly plan limit; when the limit
 * is hit the server's message is shown and remaining runs stop.
 */
export function RunMatchPanel({
  jobDescriptionId,
  resumes,
}: {
  jobDescriptionId: string;
  resumes: MatchResumeOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    resumes.length === 1 ? [resumes[0].id] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(resumeId: string) {
    setSelected((current) =>
      current.includes(resumeId)
        ? current.filter((id) => id !== resumeId)
        : [...current, resumeId],
    );
  }

  async function runMatches() {
    setError(null);
    if (selected.length === 0) {
      setError("Choose at least one resume to analyze.");
      return;
    }
    setBusy(true);
    try {
      for (const resumeId of selected) {
        const response = await fetch(`/api/jobs/${jobDescriptionId}/analyze`, {
          body: JSON.stringify({ resumeId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await response.json().catch(() => null)) as {
          errors?: { form?: string };
        } | null;
        if (!response.ok) {
          setError(data?.errors?.form ?? "Something went wrong. Try again.");
          break;
        }
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (resumes.length === 0) {
    return (
      <section className="card">
        <h2 className="font-semibold">Run a match</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          You have no resumes yet. Create one in the resume builder first,
          then come back to run a match.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Run a match</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Choose one or more resumes to score against this job. Scores are
        estimates to guide your edits, not a real ATS ranking and not a
        promise of an interview.
      </p>
      <div className="mt-3 space-y-2">
        {resumes.map((resume) => (
          <label className="flex items-center gap-2 text-sm" key={resume.id}>
            <input
              checked={selected.includes(resume.id)}
              onChange={() => toggle(resume.id)}
              type="checkbox"
            />
            {resume.title}
          </label>
        ))}
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={runMatches}
        type="button"
      >
        {busy ? "Analyzing…" : "Run match"}
      </button>
    </section>
  );
}
