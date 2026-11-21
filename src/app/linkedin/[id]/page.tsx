import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DeleteButton } from "@/components/DeleteButton";
import { getLinkedInAnalysisForUser } from "@/lib/linkedin";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

export default async function LinkedInAnalysisPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const analysis = await getLinkedInAnalysisForUser(user.id, id);
  if (!analysis) notFound();

  const result = analysis.result;

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/linkedin">
        ← All LinkedIn analyses
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {analysis.targetRole || "General profile check"}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {analysis.generationMode === "live"
              ? "AI analysis"
              : "Rule-based checks (Demo AI, no API key set)"}
            , {analysis.createdAt.toLocaleDateString()}
          </p>
        </div>
        <DeleteButton
          endpoint={`/api/linkedin/${analysis.id}`}
          label="Delete analysis"
          redirectTo="/linkedin"
        />
      </div>

      <section className="card mt-6">
        <h2 className="font-semibold">What we checked</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
          {result.checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Suggestions</h2>
        {result.suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            No suggestions. The checks above found nothing to fix.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            {result.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        )}
        {result.suggestedHeadline && (
          <div className="mt-4 rounded-lg bg-[var(--color-accent-soft)] p-4">
            <p className="text-sm font-semibold">Suggested headline</p>
            <p className="mt-1 text-sm">{result.suggestedHeadline}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Built only from your own headline and a skill your text
              already mentions.
            </p>
          </div>
        )}
      </section>

      {(result.keywordsFound.length > 0 || result.keywordsMissing.length > 0) && (
        <section className="card mt-6">
          <h2 className="font-semibold">Keyword coverage</h2>
          {result.keywordsFound.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold">Mentioned in your text</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {result.keywordsFound.map((skill) => (
                  <li
                    className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-sm font-medium text-[var(--color-accent-deep)]"
                    key={skill}
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.keywordsMissing.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">Not mentioned</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {result.keywordsMissing.map((skill) => (
                  <li
                    className="rounded-full border border-[var(--color-line)] px-3 py-1 text-sm text-[var(--color-muted)]"
                    key={skill}
                  >
                    {skill}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Only add a skill to your profile if you actually have it.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="card mt-6">
        <h2 className="font-semibold">Text you pasted</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
          {analysis.inputText}
        </p>
      </section>
    </DashboardShell>
  );
}
