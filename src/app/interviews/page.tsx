import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { InterviewStartForm } from "@/components/InterviewStartForm";
import { INTERVIEW_TYPE_LABELS } from "@/lib/interviewData";
import { interviewsUsedThisMonth, listInterviewSessions } from "@/lib/interviews";
import { listJobDescriptions } from "@/lib/jobs";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

export default async function InterviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const jobs = await listJobDescriptions(user.id);
  const resumes = await listResumes(user.id);
  const sessions = await listInterviewSessions(user.id);
  const usedThisMonth = await interviewsUsedThisMonth(user.id);
  const plan = planOf(user.plan);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Mock interviews</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Practise answering interview questions and get feedback on your
        answers. Feedback describes the answer you typed. It never
        claims to measure your personality or employability. You have
        used {usedThisMonth} of {plan.maxInterviewsPerMonth} sessions this
        month on the {plan.label} plan.
      </p>

      <div className="mt-6">
        <InterviewStartForm
          jobs={jobs.map((job) => ({
            company: job.company,
            id: job.id,
            title: job.title,
          }))}
          resumes={resumes.map((resume) => ({
            id: resume.id,
            title: resume.title,
          }))}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Your sessions</h2>
        {sessions.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No mock interviews yet. Start your first one above.
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div className="card flex flex-wrap items-center gap-3" key={session.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {INTERVIEW_TYPE_LABELS[session.interviewType]} interview
                  {session.jobTitle ? `: ${session.jobTitle}` : ""}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  {session.status === "completed"
                    ? `Completed, average ${session.report.averageOverall ?? 0}/100`
                    : `In progress, ${session.report.answeredCount} of ${session.report.questionCount} answered`}
                  ,{" "}
                  {session.generationMode === "live"
                    ? "AI questions"
                    : "Demo AI: built-in question bank"}
                  , {session.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-ghost"
                href={`/interviews/${session.id}`}
                style={{ padding: "8px 16px" }}
              >
                {session.status === "completed" ? "View report" : "Continue"}
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
