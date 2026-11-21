import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ResumeEditor } from "@/components/ResumeEditor";
import { getOrCreateProfile } from "@/lib/profile";
import { getResumeForUser } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

type PageContext = { params: Promise<{ id: string }> };

export default async function ResumeEditorPage(context: PageContext) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const { id } = await context.params;
  const resume = await getResumeForUser(user.id, id);
  if (!resume) notFound();

  return (
    <DashboardShell email={user.email}>
      <p className="text-sm">
        <Link className="text-[var(--color-accent)] hover:underline" href="/resumes">
          ← All resumes
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold">Resume editor</h1>
      <div className="mt-6">
        <ResumeEditor
          initial={{
            enabledSections: resume.enabledSections,
            id: resume.id,
            reviewText: resume.reviewText,
            sections: resume.sections,
            sourceFileName: resume.sourceFileName,
            template: resume.template,
            title: resume.title,
          }}
        />
      </div>
    </DashboardShell>
  );
}
