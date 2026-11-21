"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CoverLetterResumeOption {
  id: string;
  title: string;
}

export interface CoverLetterJobOption {
  company: string;
  id: string;
  title: string;
}

const TONES = ["Professional", "Confident", "Concise", "Enthusiastic", "Formal"];

/**
 * Generate a cover letter: pick a resume, optionally a saved job
 * description (or type the company/position by hand), and a tone.
 * Each generation counts toward the monthly plan limit; when the
 * limit is hit the server's message is shown.
 */
export function CoverLetterForm({
  jobs,
  preselectedJobId,
  resumes,
}: {
  jobs: CoverLetterJobOption[];
  preselectedJobId?: string;
  resumes: CoverLetterResumeOption[];
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [jobId, setJobId] = useState(preselectedJobId ?? "");
  const [companyName, setCompanyName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [tone, setTone] = useState("Professional");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    if (!resumeId) {
      setError("Choose a resume first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/cover-letters", {
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          jobDescriptionId: jobId || undefined,
          positionTitle: positionTitle.trim() || undefined,
          resumeId,
          tone,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        coverLetter?: { id: string };
        errors?: { form?: string };
      } | null;
      if (!response.ok || !data?.coverLetter) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/cover-letters/${data.coverLetter.id}`);
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
        <h2 className="font-semibold">Generate a cover letter</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          You have no resumes yet. Create one in the resume builder first,
          then come back. A cover letter is written from your resume facts only.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Generate a cover letter</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        The draft uses only facts from your resume: it never invents
        experience or skills. Anything missing is left as a bracketed
        placeholder for you to fill in.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Resume</span>
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tone</span>
          <select
            className="field"
            onChange={(event) => setTone(event.target.value)}
            value={tone}
          >
            {TONES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">
            Job description (optional)
          </span>
          <select
            className="field"
            onChange={(event) => setJobId(event.target.value)}
            value={jobId}
          >
            <option value="">None, I will type the company and position</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company ? `, ${job.company}` : ""}
              </option>
            ))}
          </select>
        </label>
        {!jobId && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Company</span>
              <input
                className="field"
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="e.g. Example Co"
                value={companyName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Position</span>
              <input
                className="field"
                onChange={(event) => setPositionTitle(event.target.value)}
                placeholder="e.g. Frontend Developer"
                value={positionTitle}
              />
            </label>
          </>
        )}
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={generate}
        type="button"
      >
        {busy ? "Generating…" : "Generate cover letter"}
      </button>
    </section>
  );
}
