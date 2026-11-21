import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ScoreBar } from "@/components/ScoreBar";
import type { AtsCheck } from "@/lib/jobData";
import { getAtsReportForUser } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

const STATUS_LABEL: Record<AtsCheck["status"], string> = {
  fail: "Needs fixing",
  pass: "OK",
  warn: "Worth improving",
};

const PRIORITY_LABEL = {
  high: "Fix first",
  low: "Nice to have",
  medium: "Worth doing",
} as const;

export default async function AtsReportPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const report = await getAtsReportForUser(user.id, id);
  if (!report) notFound();

  const { result } = report;

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/ats">
        ← All ATS reports
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {report.resumeTitle}
        {report.jobTitle ? (
          <span className="font-normal text-[var(--color-muted)]">
            {" "}
            vs {report.jobTitle}
          </span>
        ) : null}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Checked {report.createdAt.toLocaleDateString()}. ATS software
        varies by employer and vendor, treat these scores as guidance,
        not a pass guarantee.
      </p>

      <section className="card mt-6">
        <div className="space-y-5">
          <ScoreBar label="Document quality (estimate)" score={result.documentScore} />
          <ScoreBar label="Structure" score={result.structureScore} />
          {result.keywordCoverage !== null && (
            <ScoreBar
              detail="Share of the job's named skills your resume mentions."
              label="Keyword coverage"
              score={result.keywordCoverage}
            />
          )}
        </div>
      </section>

      {result.recommendations.length > 0 && (
        <section className="card mt-6">
          <h2 className="font-semibold">What to fix, in order</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {result.recommendations.map((item) => (
              <li className="flex gap-3" key={item.text}>
                <span className="soon-badge shrink-0" style={{ padding: "2px 10px" }}>
                  {PRIORITY_LABEL[item.priority]}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
          <Link
            className="btn-primary mt-4"
            href={`/resumes/${report.resumeId}`}
            style={{ padding: "8px 16px" }}
          >
            Open this resume in the editor
          </Link>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="font-semibold">All checks</h2>
        <ul className="mt-3 divide-y divide-[var(--color-line)]">
          {result.checks.map((entry) => (
            <li className="py-3" key={entry.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{entry.label}</p>
                <span className="soon-badge" style={{ padding: "2px 10px" }}>
                  {STATUS_LABEL[entry.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {entry.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </DashboardShell>
  );
}
