"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * LinkedIn optimizer form. Paste-in only: the user copies their
 * own headline, About, and experience text. The app never
 * scrapes LinkedIn or touches an account.
 */
export function LinkedInForm({
  initialTargetRole,
}: {
  initialTargetRole: string;
}) {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [targetRole, setTargetRole] = useState(initialTargetRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    if (!inputText.trim()) {
      setError("Paste your LinkedIn headline and About text first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/linkedin", {
        body: JSON.stringify({ inputText, targetRole }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        analysis?: { id: string };
        errors?: { form?: string };
      } | null;
      if (!response.ok || !data?.analysis) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/linkedin/${data.analysis.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Analyse your profile</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Paste your headline as the first line, then your About and
        experience text. We never scrape LinkedIn or access your
        account — this works only on what you paste. Suggestions only
        rephrase your own words; nothing is invented.
      </p>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium">Target role (optional)</span>
        <input
          className="field"
          onChange={(event) => setTargetRole(event.target.value)}
          placeholder="e.g. Frontend Developer"
          value={targetRole}
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium">Your profile text</span>
        <textarea
          className="field"
          onChange={(event) => setInputText(event.target.value)}
          placeholder={
            "Frontend Developer | React and TypeScript\n\nI build dashboards..."
          }
          rows={10}
          value={inputText}
        />
      </label>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={analyze}
        type="button"
      >
        {busy ? "Analysing…" : "Analyse profile"}
      </button>
    </section>
  );
}
