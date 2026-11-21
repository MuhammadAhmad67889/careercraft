import Link from "next/link";
import { redirect } from "next/navigation";
import { AtsPanel } from "@/components/AtsPanel";
import { DashboardShell } from "@/components/DashboardShell";
import { listAtsReports, listJobDescriptions } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

export default async function AtsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const resumes = await listResumes(user.id);
  const jobs = await listJobDescriptions(user.id);
  const reports = await listAtsReports(user.id);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">ATS analyzer</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Check how cleanly your resume parses: structure, formatting,
        keyword coverage, content quality, and readability. ATS software
        varies by employer and vendor, so these scores are estimates for
        guidance, never a guarantee that any particular system will
        accept your resume.
      </p>

      <div className="mt-6">
        <AtsPanel
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
        <h2 className="font-semibold">Past reports</h2>
        {reports.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No reports yet. Run a check above to see your first one.
            </p>
          </div>
        ) : (
          reports.slice(0, 10).map((report) => (
            <div className="card flex flex-wrap items-center gap-3" key={report.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {report.resumeTitle}
                  {report.jobTitle ? (
                    <span className="font-normal text-[var(--color-muted)]">
                      {" "}
                      vs {report.jobTitle}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  Document score {report.documentScore}/100, Structure{" "}
                  {report.result.structureScore}/100 ,{" "}
                  {report.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-ghost"
                href={`/ats/${report.id}`}
                style={{ padding: "8px 16px" }}
              >
                View report
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
