import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getOrCreateProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user.id);
  if (profile.onboardingDone) redirect("/dashboard");

  // Pass plain data to the client form (no Date objects).
  const profileData = {
    fullName: profile.fullName,
    country: profile.country,
    city: profile.city,
    headline: profile.headline,
    employmentStatus: profile.employmentStatus,
    currentPosition: profile.currentPosition,
    experienceLevel: profile.experienceLevel,
    yearsExperience: profile.yearsExperience,
    targetPosition: profile.targetPosition,
    preferredIndustries: profile.preferredIndustries,
    preferredCountries: profile.preferredCountries,
    workMode: profile.workMode,
    employmentType: profile.employmentType,
    salaryRange: profile.salaryRange,
    jobCategories: profile.jobCategories,
    technicalSkills: profile.technicalSkills,
    softSkills: profile.softSkills,
    languages: profile.languages,
    certifications: profile.certifications,
    onboardingStep: profile.onboardingStep,
    onboardingDone: profile.onboardingDone,
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold">Welcome to CareerCraft</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        A few quick questions so the tools can work for you. Your progress is
        saved as you go, so leave anytime and pick up where you stopped.
      </p>
      <div className="card mt-6">
        <OnboardingForm profile={profileData} />
      </div>
    </main>
  );
}
