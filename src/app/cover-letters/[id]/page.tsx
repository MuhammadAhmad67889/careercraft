import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoverLetterEditor } from "@/components/CoverLetterEditor";
import { DashboardShell } from "@/components/DashboardShell";
import { getCoverLetterForUser } from "@/lib/coverLetters";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

export default async function CoverLetterDetailPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const letter = await getCoverLetterForUser(user.id, id);
  if (!letter) notFound();

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/cover-letters">
        ← All cover letters
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{letter.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Written from {letter.resumeTitle}
        {letter.jobTitle ? (
          <>
            , aimed at{" "}
            <Link
              className="text-[var(--color-accent)]"
              href={`/jobs/${letter.jobDescriptionId}`}
            >
              {letter.jobTitle}
            </Link>
          </>
        ) : null}
        , updated {letter.updatedAt.toLocaleDateString()}
      </p>

      <div className="mt-6">
        <CoverLetterEditor
          coverLetterId={letter.id}
          generationMode={letter.generationMode}
          initialBodyText={letter.bodyText}
          initialTitle={letter.title}
          initialTone={letter.tone}
        />
      </div>

      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Read the draft before you send it: it is built only from facts on
        your resume, and bracketed placeholders mark anything the
        generator did not know. Every save keeps a snapshot of the
        previous draft.
      </p>
    </DashboardShell>
  );
}
