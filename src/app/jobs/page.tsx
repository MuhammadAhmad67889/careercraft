import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { JobForm } from "@/components/JobForm";
import { parseModeLabel } from "@/lib/jobData";
import {
  analysesUsedThisMonth,
  listJobAnalyses,
  listJobDescriptions,
} from "@/lib/jobs";
import { duplicateJobIds, listDuplicatePairs } from "@/lib/jobSearch";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const jobs = await listJobDescriptions(user.id);
  const duplicatePairs = await listDuplicatePairs(user.id);
  const flaggedIds = duplicateJobIds(duplicatePairs);
  const analyses = await listJobAnalyses(user.id);
  const plan = planOf(user.plan);
  const usedThisMonth = await analysesUsedThisMonth(user.id);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Job matching</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Save a job description, then score your resumes against it. Scores
        are transparent estimates to guide your edits, not a real ATS
        ranking and not a promise of an interview. You have used{" "}
        {usedThisMonth} of {plan.maxAnalysesPerMonth} analyses this month on
        your {plan.label} plan.
      </p>

      <div className="mt-6">
        <JobForm />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Saved job descriptions</h2>
        {duplicatePairs.length > 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            {duplicatePairs.length}{" "}
            {duplicatePairs.length === 1 ? "pair looks" : "pairs look"} like
            the same posting saved twice. Review{" "}
            <Link className="text-[var(--color-accent)]" href="/job-search">
              possible duplicates in Job search
            </Link>{" "}
            to merge them or keep both.
          </p>
        )}
        {jobs.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No job descriptions yet. Paste one above to get started.
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <div className="card flex flex-wrap items-center gap-3" key={job.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {job.title}
                  {job.company ? (
                    <span className="font-normal text-[var(--color-muted)]">
                      {" "}
                     , {job.company}
                    </span>
                  ) : null}{" "}
                  {flaggedIds.has(job.id) && (
                    <span className="warn-badge">Possible duplicate</span>
                  )}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  {job.location ? `${job.location} , ` : ""}
                  {job.parsed.requiredSkills.length} required skills ,{" "}
                  {job.parsed.preferredSkills.length} preferred ,{" "}
                  {parseModeLabel(job.parseMode)}, Saved{" "}
                  {job.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-primary"
                href={`/jobs/${job.id}`}
                style={{ padding: "8px 16px" }}
              >
                Open
              </Link>
            </div>
          ))
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Recent analyses</h2>
        {analyses.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No analyses yet. Open a job description and run a match
              against one of your resumes.
            </p>
          </div>
        ) : (
          analyses.slice(0, 10).map((analysis) => (
            <div
              className="card flex flex-wrap items-center gap-3"
              key={analysis.id}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {analysis.resumeTitle}
                  <span className="font-normal text-[var(--color-muted)]">
                    {" "}
                    vs {analysis.jobTitle}
                    {analysis.company ? `, ${analysis.company}` : ""}
                  </span>
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  Estimate {analysis.overallScore}/100 ,{" "}
                  {analysis.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-ghost"
                href={`/analyses/${analysis.id}`}
                style={{ padding: "8px 16px" }}
              >
                View breakdown
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
