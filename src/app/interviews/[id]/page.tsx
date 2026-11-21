import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { DeleteButton } from "@/components/DeleteButton";
import { InterviewSessionPanel } from "@/components/InterviewSessionPanel";
import { INTERVIEW_TYPE_LABELS } from "@/lib/interviewData";
import { getInterviewSessionForUser } from "@/lib/interviews";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

export default async function InterviewSessionPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const session = await getInterviewSessionForUser(user.id, id);
  if (!session) notFound();

  return (
    <DashboardShell email={user.email}>
      <Link className="text-sm text-[var(--color-accent)]" href="/interviews">
        ← All mock interviews
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {INTERVIEW_TYPE_LABELS[session.interviewType]} interview
            {session.jobTitle ? `: ${session.jobTitle}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {session.generationMode === "live"
              ? "Questions written by AI from your target role and skills."
              : "Demo AI: built-in question bank."}{" "}
            {session.status === "completed"
              ? "Session completed."
              : `Question ${session.report.answeredCount + 1} of ${session.report.questionCount}.`}
          </p>
        </div>
        <DeleteButton
          endpoint={`/api/interviews/${session.id}`}
          label="Delete session"
          redirectTo="/interviews"
        />
      </div>

      <div className="mt-6">
        <InterviewSessionPanel
          initialSession={{
            generationMode: session.generationMode,
            id: session.id,
            questions: session.questions,
            report: session.report,
            status: session.status,
          }}
        />
      </div>
    </DashboardShell>
  );
}
