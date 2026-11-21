"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface InterviewJobOption {
  company: string;
  id: string;
  title: string;
}

export interface InterviewResumeOption {
  id: string;
  title: string;
}

const TYPES = [
  { id: "technical", label: "Technical" },
  { id: "behavioral", label: "Behavioral" },
  { id: "hr", label: "HR" },
  { id: "system-design", label: "System design" },
  { id: "situational", label: "Situational" },
];

/**
 * Start a mock interview: pick a type, optionally link a saved
 * job description and a resume so the questions fit the role.
 * Each session counts toward the monthly plan limit; when the
 * limit is hit the server's message is shown.
 */
export function InterviewStartForm({
  jobs,
  resumes,
}: {
  jobs: InterviewJobOption[];
  resumes: InterviewResumeOption[];
}) {
  const router = useRouter();
  const [interviewType, setInterviewType] = useState("technical");
  const [jobId, setJobId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/interviews", {
        body: JSON.stringify({
          interviewType,
          jobDescriptionId: jobId || undefined,
          resumeId: resumeId || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        session?: { id: string };
      } | null;
      if (!response.ok || !data?.session) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/interviews/${data.session.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Start a mock interview</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Five practice questions, one at a time. You type each answer and
        get feedback on the answer itself: how clear, complete, and
        relevant it is. This is practice guidance only. It does not
        measure your personality or employability.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Interview type</span>
          <select
            className="field"
            onChange={(event) => setInterviewType(event.target.value)}
            value={interviewType}
          >
            {TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Job description (optional)
          </span>
          <select
            className="field"
            onChange={(event) => setJobId(event.target.value)}
            value={jobId}
          >
            <option value="">None</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company ? `, ${job.company}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Resume (optional)</span>
          <select
            className="field"
            onChange={(event) => setResumeId(event.target.value)}
            value={resumeId}
          >
            <option value="">None</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={start}
        type="button"
      >
        {busy ? "Preparing questions…" : "Start mock interview"}
      </button>
    </section>
  );
}
