"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ProfileData = {
  fullName: string;
  country: string;
  city: string;
  headline: string;
  employmentStatus: string;
  currentPosition: string;
  experienceLevel: string;
  yearsExperience: number;
  targetPosition: string;
  preferredIndustries: string;
  preferredCountries: string;
  workMode: string;
  employmentType: string;
  salaryRange: string;
  jobCategories: string;
  technicalSkills: string;
  softSkills: string;
  languages: string;
  certifications: string;
  onboardingStep: number;
  onboardingDone: boolean;
};

type FieldDef = {
  key: keyof ProfileData;
  label: string;
  kind: "text" | "number" | "select" | "textarea";
  options?: string[];
  hint?: string;
  placeholder?: string;
};

const STEPS: { label: string; intro: string; fields: FieldDef[] }[] = [
  {
    label: "Personal",
    intro: "The basics. Everything here is optional, skip what you like.",
    fields: [
      { key: "fullName", label: "Full name", kind: "text", placeholder: "e.g. Ayesha Khan" },
      { key: "country", label: "Country", kind: "text", placeholder: "e.g. Pakistan" },
      { key: "city", label: "City", kind: "text", placeholder: "e.g. Lahore" },
      {
        key: "headline",
        label: "Professional headline",
        kind: "text",
        placeholder: "e.g. Frontend developer, React and TypeScript",
      },
    ],
  },
  {
    label: "Career",
    intro: "Where you are now and where you want to be.",
    fields: [
      {
        key: "employmentStatus",
        label: "Employment status",
        kind: "select",
        options: ["Employed", "Self-employed / Freelance", "Student", "Unemployed", "Career break"],
      },
      { key: "currentPosition", label: "Current position", kind: "text", placeholder: "e.g. Junior web developer" },
      {
        key: "experienceLevel",
        label: "Experience level",
        kind: "select",
        options: ["Student", "Entry level", "Junior", "Mid-level", "Senior", "Lead / Manager"],
      },
      { key: "yearsExperience", label: "Years of experience", kind: "number" },
      { key: "targetPosition", label: "Target position", kind: "text", placeholder: "e.g. Frontend developer" },
      {
        key: "preferredIndustries",
        label: "Preferred industries",
        kind: "text",
        hint: "Separate with commas.",
        placeholder: "e.g. SaaS, fintech, e-commerce",
      },
    ],
  },
  {
    label: "Preferences",
    intro: "The kind of roles you want to see.",
    fields: [
      {
        key: "preferredCountries",
        label: "Preferred countries",
        kind: "text",
        hint: "Separate with commas.",
        placeholder: "e.g. Pakistan, Germany, Remote worldwide",
      },
      {
        key: "workMode",
        label: "Work mode",
        kind: "select",
        options: ["Remote", "Hybrid", "On-site", "No preference"],
      },
      {
        key: "employmentType",
        label: "Employment type",
        kind: "select",
        options: ["Full-time", "Part-time", "Contract", "Internship", "Freelance"],
      },
      { key: "salaryRange", label: "Desired salary range", kind: "text", placeholder: "e.g. PKR 150k–250k / month" },
      {
        key: "jobCategories",
        label: "Job categories",
        kind: "text",
        hint: "Separate with commas.",
        placeholder: "e.g. Web development, UI engineering",
      },
    ],
  },
  {
    label: "Skills",
    intro: "What you bring. These feed matching later, so be honest, the AI never adds skills you did not list.",
    fields: [
      {
        key: "technicalSkills",
        label: "Technical skills",
        kind: "textarea",
        hint: "Separate with commas.",
        placeholder: "e.g. React, TypeScript, Node.js, PostgreSQL",
      },
      {
        key: "softSkills",
        label: "Soft skills",
        kind: "textarea",
        hint: "Separate with commas.",
        placeholder: "e.g. Communication, teamwork, time management",
      },
      {
        key: "languages",
        label: "Languages",
        kind: "text",
        hint: "Separate with commas.",
        placeholder: "e.g. English, Urdu",
      },
      {
        key: "certifications",
        label: "Certifications",
        kind: "textarea",
        hint: "Separate with commas.",
        placeholder: "e.g. Meta Front-End Developer, AWS Cloud Practitioner",
      },
    ],
  },
];

const LAST_STEP = STEPS.length - 1;

function toFieldValue(profile: ProfileData, key: keyof ProfileData): string {
  const value = profile[key];
  return typeof value === "number" ? String(value) : String(value ?? "");
}

/** Multi-step onboarding. Progress is saved to the server on every
 * step, so closing the tab and coming back resumes where the user
 * left off. Every step can be skipped. */
export function OnboardingForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(profile.onboardingStep, LAST_STEP));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const stepDef of STEPS) {
      for (const field of stepDef.fields) {
        initial[field.key] = toFieldValue(profile, field.key);
      }
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function stepFields(stepIndex: number): Record<string, string | number> {
    const fields: Record<string, string | number> = {};
    for (const field of STEPS[stepIndex].fields) {
      const raw = values[field.key] ?? "";
      if (field.kind === "number") {
        const parsed = Number.parseInt(raw, 10);
        fields[field.key] = Number.isNaN(parsed) ? 0 : parsed;
      } else {
        fields[field.key] = raw;
      }
    }
    return fields;
  }

  async function submit(skip: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        body: JSON.stringify(
          skip ? { skip: true, step } : { fields: stepFields(step), step },
        ),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = (await res.json().catch(() => ({}))) as {
        errors?: Record<string, string>;
        profile?: ProfileData;
      };
      if (!res.ok) {
        setError(data.errors?.form ?? "Could not save. Try again.");
        return;
      }
      if (step === LAST_STEP) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setStep(step + 1);
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const current = STEPS[step];

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
        <span>
          Step {step + 1} of {STEPS.length}: {current.label}
        </span>
        <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-line)]"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
      >
        <div
          className="h-full bg-[var(--color-accent)]"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <p className="mt-5 text-sm text-[var(--color-muted)]">{current.intro}</p>

      <div className="mt-4 space-y-4">
        {current.fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="mb-1 block text-sm font-medium">
              {field.label}
            </label>
            {field.kind === "select" ? (
              <select
                id={field.key}
                className="field"
                value={values[field.key] ?? ""}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                <option value="">Select…</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.kind === "textarea" ? (
              <textarea
                id={field.key}
                className="field"
                rows={3}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            ) : (
              <input
                id={field.key}
                type={field.kind === "number" ? "number" : "text"}
                min={field.kind === "number" ? 0 : undefined}
                max={field.kind === "number" ? 60 : undefined}
                className="field"
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            )}
            {field.hint && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">{field.hint}</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="error-text mt-4">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep(step - 1)}
            disabled={busy}
          >
            Back
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => submit(false)}
          disabled={busy}
        >
          {busy ? "Saving…" : step === LAST_STEP ? "Finish" : "Save and continue"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => submit(true)}
          disabled={busy}
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}
