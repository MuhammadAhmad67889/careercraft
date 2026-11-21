import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { RunMatchPanel } from "@/components/RunMatchPanel";
import { educationLabel, parseModeLabel } from "@/lib/jobData";
import { getJobDescriptionForUser, listJobAnalyses } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">None found.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span className="soon-badge" key={skill} style={{ padding: "3px 10px" }}>
          {skill}
        </span>
      ))}
    </div>
  );
}

export default async function JobDetailPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const job = await getJobDescriptionForUser(user.id, id);
  if (!job) notFound();

  const resumes = await listResumes(user.id);
  const analyses = await listJobAnalyses(user.id, undefined, id);

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/jobs">
        ← All job descriptions
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {job.title}
        {job.company ? (
          <span className="font-normal text-[var(--color-muted)]">
            {" "}
           , {job.company}
          </span>
        ) : null}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {parseModeLabel(job.parseMode)}, Saved{" "}
        {job.createdAt.toLocaleDateString()}
        {job.sourceUrl ? (
          <>
            {" "}
           , Imported from{" "}
            <a
              className="text-[var(--color-accent)]"
              href={job.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              the posting
            </a>
          </>
        ) : null}
      </p>

      <section className="card mt-6">
        <h2 className="font-semibold">What we found in this posting</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Required skills</p>
            <SkillChips skills={job.parsed.requiredSkills} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Preferred skills</p>
            <SkillChips skills={job.parsed.preferredSkills} />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="font-medium">Experience asked for:</span>{" "}
              {job.parsed.minYearsExperience !== null
                ? `${job.parsed.minYearsExperience}+ years`
                : "Not stated"}
            </p>
            <p>
              <span className="font-medium">Education asked for:</span>{" "}
              {job.parsed.educationLevel
                ? educationLabel(job.parsed.educationLevel)
                : "Not stated"}
            </p>
          </div>
          {job.parsed.responsibilities.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Responsibilities</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
                {job.parsed.responsibilities.slice(0, 8).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          className="btn-primary"
          href={`/cover-letters?jobId=${job.id}`}
          style={{ padding: "10px 18px" }}
        >
          Generate cover letter
        </Link>
        <Link
          className="btn-ghost"
          href={`/applications?jobId=${job.id}`}
          style={{ padding: "10px 18px" }}
        >
          Track application
        </Link>
      </div>

      <div className="mt-6">
        <RunMatchPanel
          jobDescriptionId={job.id}
          resumes={resumes.map((resume) => ({
            id: resume.id,
            title: resume.title,
          }))}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Analyses for this job</h2>
        {analyses.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No analyses yet for this job. Run a match above, you can
              compare several resumes against the same posting.
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="px-4 py-3 font-medium">Resume</th>
                  <th className="px-4 py-3 font-medium">Estimate</th>
                  <th className="px-4 py-3 font-medium">Keyword coverage</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr
                    className="border-b border-[var(--color-line)] last:border-0"
                    key={analysis.id}
                  >
                    <td className="px-4 py-3 font-medium">
                      {analysis.resumeTitle}
                    </td>
                    <td className="px-4 py-3">{analysis.overallScore}/100</td>
                    <td className="px-4 py-3">
                      {analysis.result.keywordCoverage}%
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {analysis.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="text-[var(--color-accent)]"
                        href={`/analyses/${analysis.id}`}
                      >
                        Breakdown
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="card mt-6">
        <summary className="cursor-pointer font-semibold">
          Original posting text
        </summary>
        <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
          {job.rawText}
        </pre>
      </details>
    </DashboardShell>
  );
}
