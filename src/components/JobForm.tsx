"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Add a job description: paste the posting text (always works)
 * or import from a URL (best effort, the server says plainly
 * when a page cannot be read, and that message is shown as-is).
 */
export function JobForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "url">("paste");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (mode === "paste" && text.trim().length < 50) {
      setError("Paste the full job description text (at least a few lines).");
      return;
    }
    if (mode === "url" && !url.trim()) {
      setError("Give the job posting URL, or switch to paste.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/jobs", {
        body: JSON.stringify({
          company,
          location,
          text: mode === "paste" ? text : undefined,
          title,
          url: mode === "url" ? url : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        job?: { id: string };
      } | null;
      if (!response.ok || !data?.job) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/jobs/${data.job.id}`);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    active
      ? "rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 font-medium text-[var(--color-accent-deep)]"
      : "rounded-lg px-3 py-2 font-medium hover:bg-[var(--color-accent-soft)]";

  return (
    <section className="card">
      <h2 className="font-semibold">Add a job description</h2>
      <div className="mt-3 flex gap-2 text-sm" role="tablist" aria-label="How to add the job">
        <button
          aria-selected={mode === "paste"}
          className={tabClass(mode === "paste")}
          onClick={() => setMode("paste")}
          role="tab"
          type="button"
        >
          Paste text
        </button>
        <button
          aria-selected={mode === "url"}
          className={tabClass(mode === "url")}
          onClick={() => setMode("url")}
          role="tab"
          type="button"
        >
          Import from URL
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Job title</span>
          <input
            className="field"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Frontend Developer"
            value={title}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Company</span>
          <input
            className="field"
            onChange={(event) => setCompany(event.target.value)}
            placeholder="e.g. Example Co"
            value={company}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Location <span className="font-normal text-[var(--color-muted)]">(optional)</span>
          </span>
          <input
            className="field"
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Remote, Lahore"
            value={location}
          />
        </label>
      </div>

      {mode === "paste" ? (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">Job description</span>
          <textarea
            className="field"
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the full posting: responsibilities, requirements, skills…"
            rows={10}
            value={text}
          />
        </label>
      ) : (
        <div className="mt-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Posting URL</span>
            <input
              className="field"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              value={url}
            />
          </label>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Import is best effort: many job boards render with JavaScript
            and cannot be read this way. If import fails, paste the text
            instead, paste always works.
          </p>
        </div>
      )}

      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy ? "Saving…" : "Save job description"}
      </button>
    </section>
  );
}
