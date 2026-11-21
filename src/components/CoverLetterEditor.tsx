"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TONES = ["Professional", "Confident", "Concise", "Enthusiastic", "Formal"];

/**
 * Cover letter editor: edit the text, save (a version snapshot is
 * stored server-side on every save), regenerate one paragraph,
 * copy the letter, or download it as a PDF. The generation mode
 * is shown so a template draft is never dressed up as AI.
 */
export function CoverLetterEditor({
  coverLetterId,
  generationMode,
  initialBodyText,
  initialTitle,
  initialTone,
}: {
  coverLetterId: string;
  generationMode: "demo" | "live";
  initialBodyText: string;
  initialTitle: string;
  initialTone: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [tone, setTone] = useState(initialTone);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [savedBodyText, setSavedBodyText] = useState(initialBodyText);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const dirty = bodyText !== savedBodyText;

  async function save() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/cover-letters/${coverLetterId}`, {
        body: JSON.stringify({ bodyText, title, tone }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
      } | null;
      if (!response.ok) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      setSavedBodyText(bodyText);
      setNotice("Saved. A snapshot of the previous draft was kept.");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateParagraph() {
    setError(null);
    setNotice(null);
    if (dirty) {
      setError("Save your edits first, then regenerate a paragraph.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/cover-letters/${coverLetterId}/regenerate`,
        {
          body: JSON.stringify({ paragraphIndex }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const data = (await response.json().catch(() => null)) as {
        coverLetter?: { bodyText: string };
        errors?: { form?: string };
      } | null;
      if (!response.ok || !data?.coverLetter) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      setBodyText(data.coverLetter.bodyText);
      setSavedBodyText(data.coverLetter.bodyText);
      setNotice("Paragraph regenerated and saved.");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLetter() {
    setNotice(null);
    try {
      await navigator.clipboard.writeText(bodyText);
      setNotice("Copied to your clipboard.");
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  async function deleteLetter() {
    if (!window.confirm("Delete this cover letter? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/cover-letters/${coverLetterId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Could not delete the letter. Try again.");
        return;
      }
      router.push("/cover-letters");
      router.refresh();
    } catch {
      setError("Could not delete the letter. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Cover letter title"
          className="field"
          onChange={(event) => setTitle(event.target.value)}
          style={{ flex: "1 1 260px" }}
          value={title}
        />
        <select
          aria-label="Tone"
          className="field"
          onChange={(event) => setTone(event.target.value)}
          style={{ flex: "0 1 180px" }}
          value={tone}
        >
          {TONES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="soon-badge">
          {generationMode === "live"
            ? "AI draft"
            : "Template draft (Demo AI, no API key set)"}
        </span>
      </div>

      <textarea
        aria-label="Cover letter text"
        className="field mt-4"
        onChange={(event) => setBodyText(event.target.value)}
        rows={18}
        value={bodyText}
      />
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Bracketed text like [add your experience here] marks a fact the
        generator did not have. Replace it with your own words before
        sending. {dirty ? "You have unsaved changes." : ""}
      </p>

      {error && <p className="error-text mt-3">{error}</p>}
      {notice && (
        <p className="mt-3 text-sm text-[var(--color-success)]">{notice}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={save}
          type="button"
        >
          {busy ? "Working…" : "Save"}
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={copyLetter}
          type="button"
        >
          Copy text
        </button>
        <a
          className="btn-ghost"
          href={`/api/cover-letters/${coverLetterId}/export`}
        >
          Download PDF
        </a>
        <span className="mx-1 hidden h-6 w-px bg-[var(--color-line)] sm:inline-block" />
        <select
          aria-label="Paragraph to regenerate"
          className="field"
          onChange={(event) => setParagraphIndex(Number(event.target.value))}
          style={{ flex: "0 1 190px" }}
          value={paragraphIndex}
        >
          {paragraphs.map((paragraph, index) => (
            <option key={index} value={index}>
              Paragraph {index + 1}: {paragraph.slice(0, 28)}…
            </option>
          ))}
        </select>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={regenerateParagraph}
          type="button"
        >
          Regenerate paragraph
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={deleteLetter}
          style={{ color: "var(--color-danger)" }}
          type="button"
        >
          Delete
        </button>
      </div>
    </section>
  );
}
