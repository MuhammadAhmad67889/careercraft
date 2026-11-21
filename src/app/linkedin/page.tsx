import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { LinkedInForm } from "@/components/LinkedInForm";
import { linkedinUsedThisMonth, listLinkedInAnalyses } from "@/lib/linkedin";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export default async function LinkedInPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const analyses = await listLinkedInAnalyses(user.id);
  const usedThisMonth = await linkedinUsedThisMonth(user.id);
  const plan = planOf(user.plan);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">LinkedIn optimizer</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Paste your profile text and get checks and suggestions. We never
        scrape LinkedIn or access your account, and suggestions only
        rephrase your own words. Experience and numbers are never
        invented. You have used {usedThisMonth} of{" "}
        {plan.maxLinkedInAnalysesPerMonth} analyses this month on the{" "}
        {plan.label} plan.
      </p>

      <div className="mt-6">
        <LinkedInForm initialTargetRole={profile.targetPosition} />
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="font-semibold">Your analyses</h2>
        {analyses.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No analyses yet. Paste your profile text above to run your
              first one.
            </p>
          </div>
        ) : (
          analyses.map((analysis) => (
            <div className="card flex flex-wrap items-center gap-3" key={analysis.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {analysis.targetRole || "General profile check"}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  {analysis.result.checks.length} checks,{" "}
                  {analysis.result.suggestions.length} suggestions,{" "}
                  {analysis.generationMode === "live"
                    ? "AI analysis"
                    : "Rule-based checks (Demo AI)"}
                  , {analysis.createdAt.toLocaleDateString()}
                </p>
              </div>
              <Link
                className="btn-ghost"
                href={`/linkedin/${analysis.id}`}
                style={{ padding: "8px 16px" }}
              >
                View
              </Link>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}
