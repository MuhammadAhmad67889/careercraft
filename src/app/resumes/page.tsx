import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ResumeList } from "@/components/ResumeList";
import { planOf } from "@/lib/plans";
import { getOrCreateProfile } from "@/lib/profile";
import { listResumes } from "@/lib/resumes";
import { getCurrentUser } from "@/lib/session";

export default async function ResumesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (!profile.onboardingDone) redirect("/onboarding");

  const resumes = await listResumes(user.id);
  const plan = planOf(user.plan);

  return (
    <DashboardShell email={user.email}>
      <h1 className="text-2xl font-bold">Resumes</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {resumes.length} of {plan.maxResumes} on your {plan.label} plan.
        Build from scratch or upload a PDF/DOCX. Every resume stays private
        to your account.
      </p>
      <div className="mt-6">
        <ResumeList
          atLimit={resumes.length >= plan.maxResumes}
          planLabel={plan.label}
          resumes={resumes.map((resume) => ({
            id: resume.id,
            sourceFileName: resume.sourceFileName,
            template: resume.template,
            title: resume.title,
            updatedAt: resume.updatedAt.toISOString(),
          }))}
        />
      </div>
    </DashboardShell>
  );
}
