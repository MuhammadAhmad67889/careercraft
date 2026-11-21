"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AtsResumeOption {
  id: string;
  title: string;
}

export interface AtsJobOption {
  company: string;
  id: string;
  title: string;
}

/**
 * Run an ATS check: pick a resume, optionally pick a job
 * description to measure keyword coverage against it.
 */
export function AtsPanel({
  jobs,
  resumes,
}: {
  jobs: AtsJobOption[];
  resumes: AtsResumeOption[];
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [jobDescriptionId, setJobDescriptionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setError(null);
    if (!resumeId) {
      setError("Choose a resume to check.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/ats", {
        body: JSON.stringify({
          jobDescriptionId: jobDescriptionId || undefined,
          resumeId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        report?: { id: string };
      } | null;
      if (!response.ok || !data?.report) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/ats/${data.report.id}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (resumes.length === 0) {
    return (
      <section className="card">
        <h2 className="font-semibold">Run a check</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          You have no resumes yet. Create one in the resume builder first,
          then come back to check it.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Run a check</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Resume</span>
          <select
            className="field"
            onChange={(event) => setResumeId(event.target.value)}
            value={resumeId}
          >
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Job description (optional)
          </span>
          <select
            className="field"
            onChange={(event) => setJobDescriptionId(event.target.value)}
            value={jobDescriptionId}
          >
            <option value="">No job, structure and content only</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company ? `, ${job.company}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={runCheck}
        type="button"
      >
        {busy ? "Checking…" : "Run ATS check"}
      </button>
    </section>
  );
}
