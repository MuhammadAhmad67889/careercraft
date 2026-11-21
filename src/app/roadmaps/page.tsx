import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { RoadmapForm } from "@/components/RoadmapForm";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile, listToString, stringToList } from "@/lib/profile";
import { countRoadmaps, listRoadmaps } from "@/lib/roadmaps";
import { getCurrentUser } from "@/lib/session";

export default async function RoadmapsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const roadmaps = await listRoadmaps(user.id);
  const activeCount = await countRoadmaps(user.id);
  const plan = planOf(user.plan);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Career roadmaps</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        A week-by-week study plan from where you are to the role you want:
        skill gaps, a learning order, and milestones you can tick off. A
        roadmap is a plan for learning. It cannot promise interviews or
        a job. You have {activeCount} of {plan.maxActiveRoadmaps} active{" "}
        {plan.maxActiveRoadmaps === 1 ? "roadmap" : "roadmaps"} on the{" "}
        {plan.label} plan.
      </p>

      <div className="mt-6">
        <RoadmapForm
          initial={{
            currentRole: profile.currentPosition,
            currentSkills: listToString(stringToList(profile.technicalSkills)),
            experienceLevel: profile.experienceLevel,
            hoursPerWeek: 5,
            targetRole: profile.targetPosition,
            timeline: "",
          }}
        />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Your roadmaps</h2>
        {roadmaps.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No roadmaps yet. Create your first one above.
            </p>
          </div>
        ) : (
          roadmaps.map((roadmap) => {
            const done = roadmap.milestones.filter((m) => m.done).length;
            return (
              <div className="card flex flex-wrap items-center gap-3" key={roadmap.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {roadmap.currentRole || "Now"} → {roadmap.targetRole}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {done} of {roadmap.milestones.length} milestones done,{" "}
                    {roadmap.generationMode === "live"
                      ? "AI plan"
                      : "Rule-based plan (Demo AI)"}
                    , updated {roadmap.updatedAt.toLocaleDateString()}
                  </p>
                </div>
                <Link
                  className="btn-ghost"
                  href={`/roadmaps/${roadmap.id}`}
                  style={{ padding: "8px 16px" }}
                >
                  Open
                </Link>
              </div>
            );
          })
        )}
      </section>
    </DashboardShell>
  );
}
