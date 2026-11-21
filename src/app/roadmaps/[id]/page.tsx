import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DeleteButton } from "@/components/DeleteButton";
import { MilestoneList } from "@/components/MilestoneList";
import { RoadmapForm } from "@/components/RoadmapForm";
import { getOrCreateProfile, stringToList } from "@/lib/profile";
import { getRoadmapForUser, roadmapModeLabel } from "@/lib/roadmaps";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

export default async function RoadmapPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const roadmap = await getRoadmapForUser(user.id, id);
  if (!roadmap) notFound();

  const plan = roadmap.plan;

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/roadmaps">
        ← All roadmaps
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {roadmap.currentRole || "Now"} → {roadmap.targetRole}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {roadmapModeLabel(roadmap.generationMode)}
            {roadmap.timeline ? ` · Timeline: ${roadmap.timeline}` : ""} ·{" "}
            {roadmap.hoursPerWeek} hours per week
          </p>
        </div>
        <DeleteButton
          endpoint={`/api/roadmaps/${roadmap.id}`}
          label="Delete roadmap"
          redirectTo="/roadmaps"
        />
      </div>

      <section className="card mt-6">
        <h2 className="font-semibold">Skill gaps</h2>
        {plan.generic ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            This is a generic study structure, not a role-specific
            curriculum. Start by collecting real job postings for{" "}
            {roadmap.targetRole} and listing the skills they ask for.
          </p>
        ) : plan.skillGaps.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            You already list every core skill for this role. Focus on
            portfolio projects and interview practice.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Skills this role usually asks for that you did not list:
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {plan.skillGaps.map((skill) => (
                <li
                  className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-sm font-medium text-[var(--color-accent-deep)]"
                  key={skill}
                >
                  {skill}
                </li>
              ))}
            </ul>
          </>
        )}
        {plan.learningOrder.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Learning order</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
              {plan.learningOrder.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ol>
          </div>
        )}
        {plan.practiceSuggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Practice suggestions</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
              {plan.practiceSuggestions.map((entry) => (
                <li key={entry.skill}>
                  <span className="font-medium">{entry.skill}:</span>{" "}
                  {entry.suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.notes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-[var(--color-muted)]">
            {plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Milestones</h2>
        <div className="mt-3">
          <MilestoneList milestones={roadmap.milestones} roadmapId={roadmap.id} />
        </div>
      </section>

      <div className="mt-6">
        <RoadmapForm
          initial={{
            currentRole: roadmap.currentRole,
            currentSkills: stringToList(profile.technicalSkills).join(", "),
            experienceLevel: roadmap.experienceLevel,
            hoursPerWeek: roadmap.hoursPerWeek,
            targetRole: roadmap.targetRole,
            timeline: roadmap.timeline,
          }}
          roadmapId={roadmap.id}
        />
      </div>
    </DashboardShell>
  );
}
