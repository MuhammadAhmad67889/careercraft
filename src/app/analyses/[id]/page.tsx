import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ScoreBar } from "@/components/ScoreBar";
import { getJobAnalysisForUser } from "@/lib/jobs";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

function SkillList({ emptyText, skills }: { emptyText: string; skills: string[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">{emptyText}</p>;
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

export default async function AnalysisDetailPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const analysis = await getJobAnalysisForUser(user.id, id);
  if (!analysis) notFound();

  const { result } = analysis;
  const components = [
    { key: "skills", label: "Technical skill coverage", value: result.components.skills },
    { key: "experience", label: "Experience relevance", value: result.components.experience },
    { key: "responsibilities", label: "Responsibilities alignment", value: result.components.responsibilities },
    { key: "education", label: "Education compatibility", value: result.components.education },
    { key: "extras", label: "Additional requirements", value: result.components.extras },
  ];

  return (
    <DashboardShell email={user.email}>
      <Link
        className="text-sm text-[var(--color-accent)]"
        href={`/jobs/${analysis.jobDescriptionId}`}
      >
        ← Back to the job
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {analysis.resumeTitle}
        <span className="font-normal text-[var(--color-muted)]">
          {" "}
          vs {analysis.jobTitle}
          {analysis.company ? `, ${analysis.company}` : ""}
        </span>
      </h1>

      <section className="card mt-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-4xl font-bold text-[var(--color-accent)]">
            {result.overallScore}/100
          </p>
          <p className="text-sm font-medium">Estimated match</p>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This is a transparent estimate from keyword and structure checks
          on your resume and the posting. It is not a real ATS ranking and
          not a probability of being hired, use the breakdown below to
          decide what to improve. Keyword coverage:{" "}
          {result.keywordCoverage}%.
        </p>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">How the estimate breaks down</h2>
        <div className="mt-4 space-y-5">
          {components.map((item) => (
            <ScoreBar
              detail={item.value.detail}
              key={item.key}
              label={item.label}
              score={item.value.score}
              weightLabel={`${Math.round(item.value.weight * 100)}% of the estimate`}
            />
          ))}
        </div>
        <div className="mt-5 space-y-2 text-sm text-[var(--color-muted)]">
          <p>{result.experienceAlignment}</p>
          <p>{result.educationAlignment}</p>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Skills</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Matched required skills</p>
            <SkillList emptyText="None matched yet." skills={result.matchedRequiredSkills} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Missing required skills</p>
            <SkillList emptyText="None missing." skills={result.missingRequiredSkills} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Matched preferred skills</p>
            <SkillList emptyText="None matched." skills={result.matchedPreferredSkills} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Missing preferred skills</p>
            <SkillList emptyText="None missing." skills={result.missingPreferredSkills} />
          </div>
        </div>
      </section>

      {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
        <section className="card mt-6">
          <h2 className="font-semibold">Strengths and gaps</h2>
          {result.strengths.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              {result.strengths.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {result.weaknesses.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-muted)]">
              {result.weaknesses.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card mt-6">
        <h2 className="font-semibold">Recommended improvements</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {result.recommendationModeLabel}
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {result.recommendations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Link
          className="btn-primary mt-4"
          href={`/resumes/${analysis.resumeId}`}
          style={{ padding: "8px 16px" }}
        >
          Open this resume in the editor
        </Link>
      </section>
    </DashboardShell>
  );
}
