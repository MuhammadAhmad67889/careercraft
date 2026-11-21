import type { PrismaClient, UserProfile } from "@prisma/client";
import { z } from "zod";
import { getPrisma } from "./prisma";

/** Onboarding is four steps. Each step owns a fixed set of profile
 * fields; a step can only write its own fields, so a malformed
 * request cannot smuggle writes into other steps. */
export const ONBOARDING_STEPS = [
  {
    id: "personal",
    label: "Personal",
    fields: ["fullName", "country", "city", "headline"],
  },
  {
    id: "career",
    label: "Career",
    fields: [
      "employmentStatus",
      "currentPosition",
      "experienceLevel",
      "yearsExperience",
      "targetPosition",
      "preferredIndustries",
    ],
  },
  {
    id: "preferences",
    label: "Preferences",
    fields: [
      "preferredCountries",
      "workMode",
      "employmentType",
      "salaryRange",
      "jobCategories",
    ],
  },
  {
    id: "skills",
    label: "Skills",
    fields: ["technicalSkills", "softSkills", "languages", "certifications"],
  },
] as const;

export const LAST_STEP = ONBOARDING_STEPS.length - 1;

/** List-like profile fields are stored comma-separated (the schema
 * must stay SQLite/Postgres compatible, so no scalar lists). These
 * two helpers are the only place that knows the format. */
export function listToString(items: string[]): string {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(", ");
}

export function stringToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const shortText = z.string().trim().max(120);
const longText = z.string().trim().max(500);

/** One schema for every onboarding field. Steps submit a subset;
 * unknown keys are dropped by Zod's default object behaviour. */
export const onboardingFieldsSchema = z
  .object({
    fullName: shortText,
    country: shortText,
    city: shortText,
    headline: longText,
    employmentStatus: shortText,
    currentPosition: shortText,
    experienceLevel: shortText,
    yearsExperience: z.number().int().min(0).max(60),
    targetPosition: shortText,
    preferredIndustries: longText,
    preferredCountries: longText,
    workMode: shortText,
    employmentType: shortText,
    salaryRange: shortText,
    jobCategories: longText,
    technicalSkills: longText,
    softSkills: longText,
    languages: longText,
    certifications: longText,
  })
  .partial();

export type OnboardingFields = z.infer<typeof onboardingFieldsSchema>;

/** Fetch the profile for exactly this user, or null. Every profile
 * query in the app goes through userId — never a bare profile id —
 * so one user cannot read another user's profile. */
export async function getProfileForUser(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<UserProfile | null> {
  return db.userProfile.findUnique({ where: { userId } });
}

export async function getOrCreateProfile(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<UserProfile> {
  const existing = await getProfileForUser(userId, db);
  if (existing) return existing;
  return db.userProfile.create({ data: { userId } });
}

function pickStepFields(
  step: number,
  fields: OnboardingFields,
): Record<string, string | number> {
  const allowed = ONBOARDING_STEPS[step].fields as readonly string[];
  const picked: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && allowed.includes(key)) {
      picked[key] = value;
    }
  }
  return picked;
}

/** Save one onboarding step and move the resume pointer forward.
 * Saving the last step marks onboarding done. */
export async function saveOnboardingStep(
  userId: string,
  step: number,
  fields: OnboardingFields,
  db: PrismaClient = getPrisma(),
): Promise<UserProfile> {
  if (step < 0 || step > LAST_STEP) {
    throw new Error(`Invalid onboarding step: ${step}`);
  }
  const data = {
    ...pickStepFields(step, fields),
    onboardingStep: Math.min(step + 1, LAST_STEP),
    onboardingDone: step === LAST_STEP,
  };
  return db.userProfile.upsert({
    create: { userId, ...data },
    update: data,
    where: { userId },
  });
}

/** Skip a step: advance the resume pointer without writing fields.
 * Skipping the last step also finishes onboarding. */
export async function skipOnboardingStep(
  userId: string,
  step: number,
  db: PrismaClient = getPrisma(),
): Promise<UserProfile> {
  if (step < 0 || step > LAST_STEP) {
    throw new Error(`Invalid onboarding step: ${step}`);
  }
  const data = {
    onboardingStep: Math.min(step + 1, LAST_STEP),
    onboardingDone: step === LAST_STEP,
  };
  return db.userProfile.upsert({
    create: { userId, ...data },
    update: data,
    where: { userId },
  });
}

/** Fields counted toward the profile-completion percentage shown on
 * the dashboard. yearsExperience counts once it is above zero. */
const COMPLETION_FIELDS = [
  "fullName",
  "country",
  "city",
  "headline",
  "employmentStatus",
  "currentPosition",
  "experienceLevel",
  "targetPosition",
  "preferredIndustries",
  "preferredCountries",
  "workMode",
  "employmentType",
  "salaryRange",
  "jobCategories",
  "technicalSkills",
  "softSkills",
  "languages",
  "certifications",
] as const;

export function profileCompletion(profile: UserProfile | null): number {
  if (!profile) return 0;
  const total = COMPLETION_FIELDS.length + 1; // +1 for yearsExperience
  let filled = 0;
  for (const field of COMPLETION_FIELDS) {
    if (profile[field].trim().length > 0) filled += 1;
  }
  if (profile.yearsExperience > 0) filled += 1;
  return Math.round((filled / total) * 100);
}
