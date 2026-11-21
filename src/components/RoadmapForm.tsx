"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface RoadmapFormValues {
  currentRole: string;
  currentSkills: string;
  experienceLevel: string;
  hoursPerWeek: number;
  targetRole: string;
  timeline: string;
}

/**
 * Create (or regenerate) a career roadmap. Skills are prefilled
 * from the profile but stay editable. A roadmap is a study plan:
 * it orders what to learn next, and never promises a job.
 */
export function RoadmapForm({
  initial,
  roadmapId,
}: {
  initial: RoadmapFormValues;
  /** When set, the form regenerates this roadmap instead of creating one. */
  roadmapId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RoadmapFormValues>(
    key: K,
    value: RoadmapFormValues[K],
  ) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function submit() {
    setError(null);
    if (!values.targetRole.trim()) {
      setError("Enter the role you are aiming for.");
      return;
    }
    setBusy(true);
    try {
      const endpoint = roadmapId
        ? `/api/roadmaps/${roadmapId}/regenerate`
        : "/api/roadmaps";
      const response = await fetch(endpoint, {
        body: JSON.stringify(values),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        roadmap?: { id: string };
      } | null;
      if (!response.ok || !data?.roadmap) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      router.push(`/roadmaps/${data.roadmap.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">
        {roadmapId ? "Regenerate this roadmap" : "Create a roadmap"}
      </h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Tell us where you are and where you want to be. You get a study
        plan: skill gaps, a learning order, and week-by-week milestones
        you can tick off. It is a plan for learning, not a promise of a job.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Target role</span>
          <input
            className="field"
            onChange={(event) => set("targetRole", event.target.value)}
            placeholder="e.g. Frontend Developer"
            value={values.targetRole}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Current role</span>
          <input
            className="field"
            onChange={(event) => set("currentRole", event.target.value)}
            placeholder="e.g. Student, Support Agent"
            value={values.currentRole}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">
            Skills you already have (comma-separated)
          </span>
          <input
            className="field"
            onChange={(event) => set("currentSkills", event.target.value)}
            placeholder="e.g. HTML, CSS, JavaScript"
            value={values.currentSkills}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Experience level</span>
          <input
            className="field"
            onChange={(event) => set("experienceLevel", event.target.value)}
            placeholder="e.g. Beginner, 1 year"
            value={values.experienceLevel}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Timeline</span>
          <input
            className="field"
            onChange={(event) => set("timeline", event.target.value)}
            placeholder="e.g. 3 months, 12 weeks"
            value={values.timeline}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Study hours per week</span>
          <input
            className="field"
            max={60}
            min={1}
            onChange={(event) =>
              set("hoursPerWeek", Number.parseInt(event.target.value, 10) || 1)
            }
            type="number"
            value={values.hoursPerWeek}
          />
        </label>
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy
          ? "Building your plan…"
          : roadmapId
            ? "Regenerate roadmap"
            : "Create roadmap"}
      </button>
    </section>
  );
}
