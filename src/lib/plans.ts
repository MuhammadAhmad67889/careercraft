/**
 * Subscription plans and their limits. Billing is demo-only in the
 * MVP (no real charges), but limits are enforced server-side for
 * real, so the numbers here are the single source of truth.
 */

export type PlanId = "free" | "pro" | "premium";

export interface PlanLimits {
  label: string;
  maxResumes: number;
  /** Job-match analyses allowed per calendar month. */
  maxAnalysesPerMonth: number;
  /** Cover letters that can be generated per calendar month. */
  maxCoverLettersPerMonth: number;
  /** Mock interview sessions that can be started per calendar month. */
  maxInterviewsPerMonth: number;
  /** Career roadmaps that can exist at the same time. */
  maxActiveRoadmaps: number;
  /** LinkedIn analyses allowed per calendar month. */
  maxLinkedInAnalysesPerMonth: number;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    label: "Free",
    maxAnalysesPerMonth: 3,
    maxCoverLettersPerMonth: 2,
    maxResumes: 1,
    maxInterviewsPerMonth: 2,
    maxActiveRoadmaps: 1,
    maxLinkedInAnalysesPerMonth: 2,
  },
  premium: {
    label: "Premium",
    maxAnalysesPerMonth: 200,
    maxCoverLettersPerMonth: 100,
    maxResumes: 50,
    maxInterviewsPerMonth: 100,
    maxActiveRoadmaps: 20,
    maxLinkedInAnalysesPerMonth: 100,
  },
  pro: {
    label: "Pro",
    maxAnalysesPerMonth: 50,
    maxCoverLettersPerMonth: 20,
    maxResumes: 10,
    maxInterviewsPerMonth: 20,
    maxActiveRoadmaps: 5,
    maxLinkedInAnalysesPerMonth: 20,
  },
};

export function planOf(planValue: string): PlanLimits {
  if (planValue === "pro" || planValue === "premium") {
    return PLANS[planValue];
  }
  return PLANS.free;
}

/** Clear, honest message when a user hits the resume limit. */
export function resumeLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxResumes} active ` +
    `${plan.maxResumes === 1 ? "resume" : "resumes"}. ` +
    "Delete an existing resume or upgrade your plan to add another."
  );
}

/** Clear, honest message when a user hits the monthly analysis limit. */
export function analysisLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxAnalysesPerMonth} job-match ` +
    `${plan.maxAnalysesPerMonth === 1 ? "analysis" : "analyses"} per month, ` +
    "and you have used them all. The count resets next month, or upgrade " +
    "your plan for more."
  );
}

/** Clear, honest message when a user hits the monthly cover-letter limit. */
export function coverLetterLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxCoverLettersPerMonth} cover ` +
    `${plan.maxCoverLettersPerMonth === 1 ? "letter" : "letters"} per month, ` +
    "and you have used them all. The count resets next month, or upgrade " +
    "your plan for more."
  );
}

/** Clear, honest message when a user hits the monthly interview limit. */
export function interviewLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxInterviewsPerMonth} mock ` +
    `${plan.maxInterviewsPerMonth === 1 ? "interview" : "interviews"} per month, ` +
    "and you have used them all. The count resets next month, or upgrade " +
    "your plan for more."
  );
}

/** Clear, honest message when a user hits the active-roadmap limit. */
export function roadmapLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxActiveRoadmaps} active ` +
    `${plan.maxActiveRoadmaps === 1 ? "roadmap" : "roadmaps"} at a time. ` +
    "Delete an existing roadmap or upgrade your plan to add another."
  );
}

/** Clear, honest message when a user hits the monthly LinkedIn limit. */
export function linkedinLimitMessage(planValue: string): string {
  const plan = planOf(planValue);
  return (
    `Your ${plan.label} plan allows ${plan.maxLinkedInAnalysesPerMonth} LinkedIn ` +
    `${plan.maxLinkedInAnalysesPerMonth === 1 ? "analysis" : "analyses"} per month, ` +
    "and you have used them all. The count resets next month, or upgrade " +
    "your plan for more."
  );
}
