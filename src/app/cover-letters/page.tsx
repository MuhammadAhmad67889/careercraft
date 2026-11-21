import Link from "next/link";
import { redirect } from "next/navigation";
import { CoverLetterForm } from "@/components/CoverLetterForm";
import { DashboardShell } from "@/components/DashboardShell";
import { coverLettersUsedThisMonth, listCoverLetters } from "@/lib/coverLetters";
import { listJobDescriptions } from "@/lib/jobs";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

type PageContext = { searchParams: Promise<{ jobId?: string }> };

export default async function CoverLettersPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { jobId } = await context.searchParams;
  const resumes = await listResumes(user.id);
  const jobs = await listJobDescriptions(user.id);
  const letters = await listCoverLetters(user.id);
  const usedThisMonth = await coverLettersUsedThisMonth(user.id);
  const plan = planOf(user.plan);
  const preselectedJobId = jobs.some((job) => job.id === jobId) ? jobId : undefined;

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Cover letters</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Draft a cover letter from your resume facts. The generator never
        invents experience, skills, or company claims: anything it does
        not know stays as a bracketed placeholder for you. You have used{" "}
        {usedThisMonth} of {plan.maxCoverLettersPerMonth} generations this
        month on the {plan.label} plan.
      </p>

      <div className="mt-6">
        <CoverLetterForm
          jobs={jobs.map((job) => ({
            company: job.company,
            id: job.id,
            title: job.title,
          }))}
          preselectedJobId={preselectedJobId}
          resumes={resumes.map((resume) => ({
            id: resume.id,
            title: resume.title,
          }))}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Your cover letters</h2>
        {letters.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No cover letters yet. Generate your first one above.
            </p>
          </div>
        ) : (
          letters.map((letter) => (
            <div className="card flex flex-wrap items-center gap-3" key={letter.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{letter.title}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {letter.tone} tone, from {letter.resumeTitle},{" "}
                  {letter.generationMode === "live"
                    ? "AI draft"
                    : "Template draft (Demo AI)"}
                  , updated {letter.updatedAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-ghost"
                href={`/cover-letters/${letter.id}`}
                style={{ padding: "8px 16px" }}
              >
                Open editor
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
