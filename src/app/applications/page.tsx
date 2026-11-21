import { redirect } from "next/navigation";
import {
  ApplicationForm,
  EMPTY_APPLICATION_FORM,
} from "@/components/ApplicationForm";
import { ApplicationsBoard } from "@/components/ApplicationsBoard";
import { DashboardShell } from "@/components/DashboardShell";
import {
  APPLICATION_STATUSES,
  getApplicationAnalytics,
  listApplications,
} from "@/lib/applications";
import { listCoverLetters } from "@/lib/coverLetters";
import { listJobDescriptions } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

type PageContext = { searchParams: Promise<{ jobId?: string }> };

function formatDate(date: Date | null): string | null {
  return date ? date.toLocaleDateString() : null;
}

export default async function ApplicationsPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { jobId } = await context.searchParams;
  const applications = await listApplications(user.id);
  const analytics = await getApplicationAnalytics(user.id);
  const resumes = await listResumes(user.id);
  const jobs = await listJobDescriptions(user.id);
  const letters = await listCoverLetters(user.id);

  const prefillJob = jobs.find((job) => job.id === jobId);
  const initialValues = {
    ...EMPTY_APPLICATION_FORM,
    company: prefillJob?.company ?? "",
    jobDescriptionId: prefillJob?.id ?? "",
    position: prefillJob?.title ?? "",
  };

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Applications</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Track every application from saved to accepted. Drag cards between
        columns to update their status — every change is saved and added
        to the application&apos;s history.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Total applications</p>
          <p className="mt-1 text-3xl font-bold">{analytics.total}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {analytics.total === 0
              ? "Nothing tracked yet. Add your first application below."
              : "Counted from your own records only."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">
            Reached an interview
          </p>
          <p className="mt-1 text-3xl font-bold">
            {analytics.interviewConversionRate === null
              ? "—"
              : `${analytics.interviewConversionRate}%`}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {analytics.interviewConversionRate === null
              ? "No applications yet, so there is no rate to show."
              : "Share of applications that reached Interview, Offer, or Accepted."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Reached an offer</p>
          <p className="mt-1 text-3xl font-bold">
            {analytics.offerRate === null ? "—" : `${analytics.offerRate}%`}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {analytics.offerRate === null
              ? "No applications yet, so there is no rate to show."
              : "Share of applications that reached Offer or Accepted."}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-[var(--color-muted)]">Rejected</p>
          <p className="mt-1 text-3xl font-bold">
            {analytics.rejectionRate === null
              ? "—"
              : `${analytics.rejectionRate}%`}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {analytics.rejectionRate === null
              ? "No applications yet, so there is no rate to show."
              : "Share of applications currently marked Rejected."}
          </p>
        </div>
      </section>

      {analytics.total > 0 && (
        <section className="card mt-6">
          <h2 className="font-semibold">Where things stand</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {APPLICATION_STATUSES.map((status) => (
              <span className="soon-badge" key={status} style={{ padding: "3px 10px" }}>
                {status}: {analytics.statusDistribution[status]}
              </span>
            ))}
          </div>
          {analytics.byMonth.length > 0 && (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              By month:{" "}
              {analytics.byMonth
                .map((entry) => `${entry.month} (${entry.count})`)
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      <section className="card mt-6">
        <h2 className="font-semibold">Add an application</h2>
        <div className="mt-4">
          <ApplicationForm
            initialValues={initialValues}
            options={{
              coverLetters: letters.map((letter) => ({
                id: letter.id,
                title: letter.title,
              })),
              jobs: jobs.map((job) => ({
                company: job.company,
                id: job.id,
                title: job.title,
              })),
              resumes: resumes.map((resume) => ({
                id: resume.id,
                title: resume.title,
              })),
            }}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Your pipeline</h2>
        <div className="mt-3">
          <ApplicationsBoard
            applications={applications.map((application) => ({
              appliedDate: formatDate(application.appliedDate),
              company: application.company,
              id: application.id,
              location: application.location,
              position: application.position,
              status: application.status,
              updatedAt: application.updatedAt.toISOString(),
            }))}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
