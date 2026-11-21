import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getPrisma } from "@/lib/prisma";
import { countApplications } from "@/lib/applications";
import { countInterviewSessions } from "@/lib/interviews";
import { countJobAnalyses, countAtsReports } from "@/lib/jobs";
import { getOrCreateProfile, profileCompletion } from "@/lib/profile";
import { countResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

/** Human-readable labels for audit actions shown as recent activity. */
const ACTIVITY_LABELS: Record<string, string> = {
  signup: "Account created",
  login: "Signed in",
  login_failed: "Failed sign-in attempt",
  logout: "Signed out",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
};

/** The four stat cards below (Resumes, Job analyses, ATS
 * reports, Applications) are all rendered with real counts from
 * the database — nothing is hardcoded. */

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const db = getPrisma();
  const recentActivity = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    where: { userId: user.id },
  });
  const resumeCount = await countResumes(user.id);
  const analysisCount = await countJobAnalyses(user.id);
  const atsReportCount = await countAtsReports(user.id);
  const applicationCount = await countApplications(user.id);
  const interviewCount = await countInterviewSessions(user.id);

  const displayName = profile.fullName || user.name || user.email;
  const completion = profileCompletion(profile);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Welcome, {displayName}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {profile.headline || "Your career workspace is ready."}
      </p>

      <section className="card mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Profile completion</h2>
          <span className="font-semibold text-[var(--color-accent)]">{completion}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-line)]"
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[var(--color-accent)]"
            style={{ width: `${completion}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {completion === 100
            ? "Your profile is complete. Matching tools will have everything they need."
            : "A fuller profile makes matching and roadmaps more useful. You can update it anytime."}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Resumes</p>
          <p className="mt-1 text-3xl font-bold">{resumeCount}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {resumeCount === 0
              ? "No resumes yet. Create one or upload a PDF/DOCX to get started."
              : "Open the resume builder to edit, duplicate, or export."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Job analyses</p>
          <p className="mt-1 text-3xl font-bold">{analysisCount}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {analysisCount === 0
              ? "No analyses yet. Save a job description and run a match."
              : "Open job matching to compare resumes against a posting."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">ATS reports</p>
          <p className="mt-1 text-3xl font-bold">{atsReportCount}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {atsReportCount === 0
              ? "No reports yet. Run an ATS check on a resume."
              : "Open the ATS analyzer to see what to fix first."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Applications</p>
          <p className="mt-1 text-3xl font-bold">{applicationCount}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {applicationCount === 0
              ? "No applications tracked yet. Add your first one in the tracker."
              : "Open the tracker to move applications through your pipeline."}
          </p>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">Nothing yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4">
                <span>{ACTIVITY_LABELS[entry.action] ?? entry.action}</span>
                <span className="text-[var(--color-muted)]">
                  {entry.createdAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Recommended next steps</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-muted)]">
          {completion < 100 && (
            <li>Finish your profile so later tools can match you accurately.</li>
          )}
          <li>
            {resumeCount === 0
              ? "Create your first resume in the resume builder, start from scratch or upload a PDF/DOCX."
              : analysisCount === 0
                ? "Save a job description and run your first match to see where your resume stands."
                : "Keep your resume current: add new experience and projects as they happen."}
          </li>
          <li>
            {interviewCount === 0
              ? "Practise with a mock interview before a real one: five questions, feedback on each answer."
              : "Run another mock interview, or build a roadmap for the skills your target role asks for."}
          </li>
        </ul>
      </section>
    </DashboardShell>
  );
}
