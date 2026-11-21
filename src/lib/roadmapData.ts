import { z } from "zod";
import { canonicalSkillName } from "./skillDictionary";

/**
 * Shared shapes for career roadmaps: the plan schema (stored as a
 * JSON string in CareerRoadmap.planJson, validated on every read
 * and write), the built-in role skill map used by demo-mode gap
 * analysis, and the deterministic demo plan builder.
 *
 * A roadmap is a study plan only. Nothing here promises a job, an
 * interview, or any career outcome — the plan says what to learn
 * next, in what order, and how to practise it.
 */

export const roadmapPlanSchema = z.object({
  /** Skills the target role asks for that the user did not list. */
  skillGaps: z.array(z.string().trim().min(1).max(80)).max(30),
  /** The gaps in the order they should be learned. */
  learningOrder: z.array(z.string().trim().min(1).max(80)).max(30),
  /** One practice suggestion per gap skill (generic, honest). */
  practiceSuggestions: z
    .array(
      z.object({
        skill: z.string().trim().min(1).max(80),
        suggestion: z.string().trim().min(1).max(300),
      }),
    )
    .max(30),
  /** Plain notes about how this plan was made and its limits. */
  notes: z.array(z.string().trim().min(1).max(400)).max(10),
  /** True when the target role was not in the built-in map and
   * the plan is a generic structure built from the user's own
   * inputs instead of a role-specific curriculum. */
  generic: z.boolean(),
});

export type RoadmapPlan = z.infer<typeof roadmapPlanSchema>;

/** Parse a stored planJson string. Returns null when it does not
 * validate — callers must handle that honestly. */
export function parseRoadmapPlan(json: string): RoadmapPlan | null {
  try {
    const parsed = roadmapPlanSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Built-in role skill map (demo mode)
// ---------------------------------------------------------------------------

export interface RoleSkillMapEntry {
  /** Role name as shown to the user. */
  role: string;
  /** Lowercase spellings that mean this role. */
  aliases: string[];
  /** Skills in a sensible learning order. */
  skills: string[];
}

/** A small, honest map of common roles to the skills their
 * postings usually ask for, in learning order. Demo gap analysis
 * compares the user's skills against this list. Roles outside
 * this map get a generic plan instead of an invented curriculum. */
export const ROLE_SKILL_MAP: RoleSkillMapEntry[] = [
  {
    role: "Frontend Developer",
    aliases: ["frontend developer", "front-end developer", "front end developer", "frontend engineer", "ui developer"],
    skills: ["HTML", "CSS", "JavaScript", "Git", "React", "TypeScript", "Tailwind CSS", "REST APIs", "Testing", "Next.js"],
  },
  {
    role: "Backend Developer",
    aliases: ["backend developer", "back-end developer", "back end developer", "backend engineer", "api developer"],
    skills: ["JavaScript", "Node.js", "Express", "SQL", "PostgreSQL", "REST APIs", "Git", "Testing", "Docker", "Redis"],
  },
  {
    role: "Full-Stack Developer",
    aliases: ["full-stack developer", "full stack developer", "fullstack developer", "full-stack engineer"],
    skills: ["HTML", "CSS", "JavaScript", "Git", "React", "Node.js", "SQL", "PostgreSQL", "REST APIs", "TypeScript", "Testing", "Docker"],
  },
  {
    role: "Data Analyst",
    aliases: ["data analyst", "business analyst", "data analytics"],
    skills: ["Excel", "SQL", "Data Analysis", "Python", "Pandas", "Power BI", "Tableau", "Communication"],
  },
  {
    role: "DevOps Engineer",
    aliases: ["devops engineer", "devops", "site reliability engineer", "sre", "cloud engineer"],
    skills: ["Linux", "Git", "Docker", "CI/CD", "AWS", "Kubernetes", "Python", "Testing"],
  },
  {
    role: "Mobile Developer",
    aliases: ["mobile developer", "android developer", "ios developer", "react native developer", "flutter developer"],
    skills: ["JavaScript", "React", "React Native", "Git", "REST APIs", "TypeScript", "Testing"],
  },
  {
    role: "UI/UX Designer",
    aliases: ["ui/ux designer", "ux designer", "ui designer", "product designer"],
    skills: ["UI Design", "Figma", "HTML", "CSS", "Communication", "Teamwork"],
  },
  {
    role: "QA Engineer",
    aliases: ["qa engineer", "quality assurance engineer", "test engineer", "software tester"],
    skills: ["Testing", "JavaScript", "Playwright", "Cypress", "Git", "SQL", "Agile"],
  },
  {
    role: "Digital Marketer",
    aliases: ["digital marketer", "digital marketing specialist", "seo specialist", "marketing executive"],
    skills: ["Digital Marketing", "SEO", "Content Writing", "Excel", "Data Analysis", "Communication"],
  },
];

/** Find the map entry for a target role, matching on the role
 * name or an alias (case-insensitive, trimmed). */
export function findRoleInMap(targetRole: string): RoleSkillMapEntry | null {
  const normalized = targetRole.trim().toLowerCase();
  if (!normalized) return null;
  for (const entry of ROLE_SKILL_MAP) {
    if (entry.role.toLowerCase() === normalized) return entry;
    if (entry.aliases.includes(normalized)) return entry;
  }
  return null;
}

/** The user's skills that match a map skill, using the shared
 * skill dictionary so "JS" counts as JavaScript. */
function userHasSkill(userSkills: string[], mapSkill: string): boolean {
  const canonical = canonicalSkillName(mapSkill) ?? mapSkill;
  return userSkills.some((skill) => {
    const userCanonical = canonicalSkillName(skill) ?? skill;
    return userCanonical.toLowerCase() === canonical.toLowerCase();
  });
}

export interface RoadmapInputs {
  currentRole: string;
  targetRole: string;
  currentSkills: string[];
  experienceLevel: string;
  hoursPerWeek: number;
  timeline: string;
}

/** Request shape for creating/regenerating a roadmap. Skills
 * arrive as one comma-separated string, like the profile fields. */
export const roadmapInputsSchema = z.object({
  currentRole: z.string().trim().max(120).optional(),
  currentSkills: z.string().trim().max(1000).optional(),
  experienceLevel: z.string().trim().max(60).optional(),
  hoursPerWeek: z.number().int().min(1).max(60).optional(),
  targetRole: z.string().trim().min(1).max(120),
  timeline: z.string().trim().max(60).optional(),
});

export type RoadmapInputsRequest = z.infer<typeof roadmapInputsSchema>;

/** Turn a validated request into the internal inputs shape. */
export function toRoadmapInputs(data: RoadmapInputsRequest): RoadmapInputs {
  return {
    currentRole: data.currentRole ?? "",
    currentSkills: (data.currentSkills ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0),
    experienceLevel: data.experienceLevel ?? "",
    hoursPerWeek: data.hoursPerWeek ?? 5,
    targetRole: data.targetRole,
    timeline: data.timeline ?? "",
  };
}

/** Weeks in a timeline string like "3 months" or "12 weeks".
 * Falls back to 12 when nothing parseable is found. */
export function timelineWeeks(timeline: string): number {
  const match = timeline.match(/(\d+)\s*(week|month|year)/i);
  if (!match) return 12;
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === "week") return Math.max(1, Math.min(52, amount));
  if (unit === "month") return Math.max(1, Math.min(52, amount * 4));
  return 52;
}

export interface DemoMilestone {
  title: string;
  week: number;
}

export interface DemoPlan {
  plan: RoadmapPlan;
  milestones: DemoMilestone[];
}

const GENERIC_MILESTONE_TITLES = [
  "Collect 5 real job postings for the target role and list the skills they ask for",
  "Rank those skills by how often they appear and pick the top 3 to learn first",
  "Learn the first skill: finish one beginner course or tutorial series",
  "Build a small project that uses the first skill end to end",
  "Learn the second skill and add it to your project",
  "Learn the third skill and add it to your project",
  "Polish the project: README, screenshots, and a short write-up of what you built",
  "Update your resume with the project and the new skills",
  "Practise explaining the project out loud, as you would in an interview",
  "Apply to a few matching roles and note what the postings ask for next",
];

/**
 * Build a demo-mode plan. When the target role is in the built-in
 * map, gaps are the map skills the user did not list, in map
 * order. When it is not, the plan is a generic structure built
 * from the user's own inputs and says so plainly — no detailed
 * curriculum is invented for an unknown role.
 */
export function buildDemoRoadmap(inputs: RoadmapInputs): DemoPlan {
  const weeks = timelineWeeks(inputs.timeline);
  const entry = findRoleInMap(inputs.targetRole);

  if (!entry) {
    const milestones = GENERIC_MILESTONE_TITLES.map((title, index) => ({
      title,
      week: Math.min(weeks, Math.floor((index * weeks) / GENERIC_MILESTONE_TITLES.length) + 1),
    }));
    return {
      milestones,
      plan: {
        generic: true,
        learningOrder: [],
        notes: [
          `"${inputs.targetRole}" is not in the built-in role map, so this is a generic study structure built from your own inputs, not a role-specific curriculum.`,
          "Start by reading real job postings for this role: they tell you which skills to learn first.",
          "This is a study plan only. It cannot promise interviews or a job.",
        ],
        practiceSuggestions: [],
        skillGaps: [],
      },
    };
  }

  const gaps = entry.skills.filter(
    (skill) => !userHasSkill(inputs.currentSkills, skill),
  );
  const practiceSuggestions = gaps.map((skill) => ({
    skill,
    suggestion: `Build one small project that uses ${skill}, then write a short README explaining what it does.`,
  }));

  // One milestone per gap skill, spread across the timeline. With
  // few hours per week, later skills naturally land in later weeks.
  const milestones: DemoMilestone[] = gaps.map((skill, index) => ({
    title: `Learn ${skill} (about ${inputs.hoursPerWeek} hours this week)`,
    week: gaps.length === 0 ? 1 : Math.min(weeks, Math.floor((index * weeks) / gaps.length) + 1),
  }));
  if (milestones.length === 0) {
    milestones.push({
      title: `You already list every core skill for ${entry.role}. Build a portfolio project that combines them.`,
      week: 1,
    });
  } else {
    milestones.push({
      title: "Combine the new skills in one portfolio project and update your resume",
      week: weeks,
    });
  }

  return {
    milestones,
    plan: {
      generic: false,
      learningOrder: gaps,
      notes: [
        `Gap analysis compared your listed skills against the built-in skill list for ${entry.role}.`,
        "Skill lists vary by employer — check real postings for the exact tools they ask for.",
        "This is a study plan only. It cannot promise interviews or a job.",
      ],
      practiceSuggestions,
      skillGaps: gaps,
    },
  };
}
