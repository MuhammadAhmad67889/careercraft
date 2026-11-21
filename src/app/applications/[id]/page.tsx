import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplicationForm } from "@/components/ApplicationForm";
import { DashboardShell } from "@/components/DashboardShell";
import { getApplicationForUser } from "@/lib/applications";
import { listCoverLetters } from "@/lib/coverLetters";
import { listJobDescriptions } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function ApplicationDetailPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const application = await getApplicationForUser(user.id, id);
  if (!application) notFound();

  const resumes = await listResumes(user.id);
  const jobs = await listJobDescriptions(user.id);
  const letters = await listCoverLetters(user.id);

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/applications">
        ← All applications
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {application.position}
        <span className="font-normal text-[var(--color-muted)]">
          {" "}
          · {application.company}
        </span>
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Status: <span className="font-medium">{application.status}</span>
        {application.appliedDate
          ? ` · Applied ${application.appliedDate.toLocaleDateString()}`
          : ""}
        {application.interviewDate
          ? ` · Interview ${application.interviewDate.toLocaleDateString()}${application.interviewNote ? ` (${application.interviewNote})` : ""}`
          : ""}
      </p>

      <section className="card mt-6">
        <h2 className="font-semibold">Linked records</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            Resume:{" "}
            {application.resumeId ? (
              <Link
                className="text-[var(--color-accent)]"
                href={`/resumes/${application.resumeId}`}
              >
                {application.resumeTitle ?? "Open resume"}
              </Link>
            ) : (
              <span className="text-[var(--color-muted)]">None linked</span>
            )}
          </li>
          <li>
            Cover letter:{" "}
            {application.coverLetterId ? (
              <Link
                className="text-[var(--color-accent)]"
                href={`/cover-letters/${application.coverLetterId}`}
              >
                {application.coverLetterTitle ?? "Open cover letter"}
              </Link>
            ) : (
              <span className="text-[var(--color-muted)]">None linked</span>
            )}
          </li>
          <li>
            Job description:{" "}
            {application.jobDescriptionId ? (
              <Link
                className="text-[var(--color-accent)]"
                href={`/jobs/${application.jobDescriptionId}`}
              >
                {application.jobTitle ?? "Open job description"}
              </Link>
            ) : (
              <span className="text-[var(--color-muted)]">None linked</span>
            )}
          </li>
          {application.jobUrl && (
            <li>
              Posting:{" "}
              <a
                className="text-[var(--color-accent)]"
                href={application.jobUrl}
                rel="noreferrer"
                target="_blank"
              >
                {application.jobUrl}
              </a>
            </li>
          )}
        </ul>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Details</h2>
        <div className="mt-4">
          <ApplicationForm
            applicationId={application.id}
            initialValues={{
              appliedDate: toDateInputValue(application.appliedDate),
              company: application.company,
              coverLetterId: application.coverLetterId ?? "",
              employmentType: application.employmentType,
              interviewDate: toDateInputValue(application.interviewDate),
              interviewNote: application.interviewNote,
              jobDescriptionId: application.jobDescriptionId ?? "",
              jobUrl: application.jobUrl ?? "",
              location: application.location,
              notes: application.notes,
              position: application.position,
              recruiterEmail: application.recruiterEmail,
              recruiterName: application.recruiterName,
              resumeId: application.resumeId ?? "",
              salaryRange: application.salaryRange,
              status: application.status,
            }}
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

      <section className="card mt-6">
        <h2 className="font-semibold">Status history</h2>
        {application.history.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            No status changes recorded yet.
          </p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {application.history.map((entry) => (
              <li className="flex items-center justify-between gap-4" key={entry.id}>
                <span>
                  {entry.fromStatus
                    ? `${entry.fromStatus} → ${entry.toStatus}`
                    : `Started as ${entry.toStatus}`}
                </span>
                <span className="text-[var(--color-muted)]">
                  {entry.changedAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </DashboardShell>
  );
}
