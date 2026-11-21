"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ApplicationFormOptions {
  coverLetters: { id: string; title: string }[];
  jobs: { company: string; id: string; title: string }[];
  resumes: { id: string; title: string }[];
}

export interface ApplicationFormValues {
  appliedDate: string;
  company: string;
  coverLetterId: string;
  employmentType: string;
  interviewDate: string;
  interviewNote: string;
  jobDescriptionId: string;
  jobUrl: string;
  location: string;
  notes: string;
  position: string;
  recruiterEmail: string;
  recruiterName: string;
  resumeId: string;
  salaryRange: string;
  status: string;
}

export const EMPTY_APPLICATION_FORM: ApplicationFormValues = {
  appliedDate: "",
  company: "",
  coverLetterId: "",
  employmentType: "",
  interviewDate: "",
  interviewNote: "",
  jobDescriptionId: "",
  jobUrl: "",
  location: "",
  notes: "",
  position: "",
  recruiterEmail: "",
  recruiterName: "",
  resumeId: "",
  salaryRange: "",
  status: "Saved",
};

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
 * Create or edit one tracked application. In create mode it POSTs
 * and refreshes the page; in edit mode it PATCHes the existing
 * record. Linked resume / cover letter / job description are
 * chosen from the user's own records only.
 */
export function ApplicationForm({
  applicationId,
  initialValues,
  options,
}: {
  applicationId?: string;
  initialValues: ApplicationFormValues;
  options: ApplicationFormOptions;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function set<K extends keyof ApplicationFormValues>(
    key: K,
    value: ApplicationFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError(null);
    setNotice(null);
    if (!values.company.trim() || !values.position.trim()) {
      setError("Company and position are required.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        appliedDate: values.appliedDate || null,
        company: values.company,
        coverLetterId: values.coverLetterId || null,
        employmentType: values.employmentType,
        interviewDate: values.interviewDate || null,
        interviewNote: values.interviewNote,
        jobDescriptionId: values.jobDescriptionId || null,
        jobUrl: values.jobUrl || null,
        location: values.location,
        notes: values.notes,
        position: values.position,
        recruiterEmail: values.recruiterEmail,
        recruiterName: values.recruiterName,
        resumeId: values.resumeId || null,
        salaryRange: values.salaryRange,
        status: values.status,
      };
      const response = await fetch(
        applicationId ? `/api/applications/${applicationId}` : "/api/applications",
        {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: applicationId ? "PATCH" : "POST",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        application?: { id: string };
        errors?: { form?: string };
      } | null;
      if (!response.ok) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      if (applicationId) {
        setNotice("Saved.");
      } else {
        setValues(EMPTY_APPLICATION_FORM);
        setNotice("Application added to your tracker.");
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteApplication() {
    if (!applicationId) return;
    if (!window.confirm("Delete this application? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Could not delete the application. Try again.");
        return;
      }
      router.push("/applications");
      router.refresh();
    } catch {
      setError("Could not delete the application. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Company *</span>
          <input
            className="field"
            onChange={(event) => set("company", event.target.value)}
            placeholder="e.g. Example Co"
            value={values.company}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Position *</span>
          <input
            className="field"
            onChange={(event) => set("position", event.target.value)}
            placeholder="e.g. Frontend Developer"
            value={values.position}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select
            className="field"
            onChange={(event) => set("status", event.target.value)}
            value={values.status}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Applied date</span>
          <input
            className="field"
            onChange={(event) => set("appliedDate", event.target.value)}
            type="date"
            value={values.appliedDate}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Location</span>
          <input
            className="field"
            onChange={(event) => set("location", event.target.value)}
            placeholder="e.g. Remote"
            value={values.location}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Employment type</span>
          <input
            className="field"
            onChange={(event) => set("employmentType", event.target.value)}
            placeholder="e.g. Full-time"
            value={values.employmentType}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Salary range</span>
          <input
            className="field"
            onChange={(event) => set("salaryRange", event.target.value)}
            placeholder="e.g. PKR 150k–250k / month"
            value={values.salaryRange}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Job URL</span>
          <input
            className="field"
            onChange={(event) => set("jobUrl", event.target.value)}
            placeholder="https://…"
            value={values.jobUrl}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Recruiter name</span>
          <input
            className="field"
            onChange={(event) => set("recruiterName", event.target.value)}
            value={values.recruiterName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Recruiter email</span>
          <input
            className="field"
            onChange={(event) => set("recruiterEmail", event.target.value)}
            value={values.recruiterEmail}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Resume used</span>
          <select
            className="field"
            onChange={(event) => set("resumeId", event.target.value)}
            value={values.resumeId}
          >
            <option value="">None linked</option>
            {options.resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Cover letter used</span>
          <select
            className="field"
            onChange={(event) => set("coverLetterId", event.target.value)}
            value={values.coverLetterId}
          >
            <option value="">None linked</option>
            {options.coverLetters.map((letter) => (
              <option key={letter.id} value={letter.id}>
                {letter.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Saved job description</span>
          <select
            className="field"
            onChange={(event) => set("jobDescriptionId", event.target.value)}
            value={values.jobDescriptionId}
          >
            <option value="">None linked</option>
            {options.jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.company ? ` — ${job.company}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Interview date</span>
          <input
            className="field"
            onChange={(event) => set("interviewDate", event.target.value)}
            type="date"
            value={values.interviewDate}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Interview note</span>
          <input
            className="field"
            onChange={(event) => set("interviewNote", event.target.value)}
            placeholder="e.g. Video call, 30 minutes"
            value={values.interviewNote}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Notes</span>
          <textarea
            className="field"
            onChange={(event) => set("notes", event.target.value)}
            rows={3}
            value={values.notes}
          />
        </label>
      </div>

      {error && <p className="error-text mt-3">{error}</p>}
      {notice && (
        <p className="mt-3 text-sm text-[var(--color-success)]">{notice}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={submit}
          type="button"
        >
          {busy ? "Saving…" : applicationId ? "Save changes" : "Add application"}
        </button>
        {applicationId && (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={deleteApplication}
            style={{ color: "var(--color-danger)" }}
            type="button"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
