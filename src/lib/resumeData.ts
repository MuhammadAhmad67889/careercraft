import { z } from "zod";

/**
 * Resume section data: the shape stored (as a JSON string) in
 * Resume.sectionsJson. Everything that reads or writes that column
 * goes through the Zod schemas here, so a corrupted or hand-edited
 * payload can never reach the editor or the PDF exporter.
 *
 * Sections follow the master-prompt order. Each section can be
 * switched on or off per resume; the enabled list is stored
 * separately on the Resume row.
 */

export const SECTION_IDS = [
  "personal",
  "summary",
  "experience",
  "education",
  "technicalSkills",
  "softSkills",
  "projects",
  "certifications",
  "languages",
  "achievements",
  "publications",
  "volunteer",
  "links",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  achievements: "Achievements",
  certifications: "Certifications",
  education: "Education",
  experience: "Work Experience",
  languages: "Languages",
  links: "Professional Links",
  personal: "Personal Information",
  projects: "Projects",
  publications: "Publications",
  softSkills: "Soft Skills",
  summary: "Professional Summary",
  technicalSkills: "Technical Skills",
  volunteer: "Volunteer Experience",
};

/** Sections enabled on a brand-new resume. */
export const DEFAULT_ENABLED_SECTIONS: SectionId[] = [
  "personal",
  "summary",
  "experience",
  "education",
  "technicalSkills",
  "projects",
];

const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(4000);
const bulletList = z.array(z.string().trim().max(1000)).max(30);

export const personalSchema = z.object({
  email: shortText.default(""),
  fullName: shortText.default(""),
  headline: shortText.default(""),
  location: shortText.default(""),
  phone: shortText.default(""),
  website: shortText.default(""),
});

export const experienceItemSchema = z.object({
  bullets: bulletList.default([]),
  company: shortText.default(""),
  current: z.boolean().default(false),
  endDate: shortText.default(""),
  location: shortText.default(""),
  startDate: shortText.default(""),
  title: shortText.default(""),
});

export const educationItemSchema = z.object({
  degree: shortText.default(""),
  endDate: shortText.default(""),
  field: shortText.default(""),
  notes: longText.default(""),
  school: shortText.default(""),
  startDate: shortText.default(""),
});

export const projectItemSchema = z.object({
  bullets: bulletList.default([]),
  description: longText.default(""),
  link: shortText.default(""),
  name: shortText.default(""),
  tech: shortText.default(""),
});

export const certificationItemSchema = z.object({
  date: shortText.default(""),
  issuer: shortText.default(""),
  name: shortText.default(""),
});

export const languageItemSchema = z.object({
  level: shortText.default(""),
  name: shortText.default(""),
});

export const publicationItemSchema = z.object({
  date: shortText.default(""),
  link: shortText.default(""),
  publisher: shortText.default(""),
  title: shortText.default(""),
});

export const volunteerItemSchema = z.object({
  bullets: bulletList.default([]),
  endDate: shortText.default(""),
  organization: shortText.default(""),
  role: shortText.default(""),
  startDate: shortText.default(""),
});

export const linkItemSchema = z.object({
  label: shortText.default(""),
  url: shortText.default(""),
});

/** The full sections payload. Every field has a default so partial
 * or older payloads still parse into a complete object. */
export const resumeSectionsSchema = z.object({
  achievements: bulletList.default([]),
  certifications: z.array(certificationItemSchema).max(30).default([]),
  education: z.array(educationItemSchema).max(20).default([]),
  experience: z.array(experienceItemSchema).max(30).default([]),
  languages: z.array(languageItemSchema).max(20).default([]),
  links: z.array(linkItemSchema).max(20).default([]),
  personal: personalSchema.default(() => personalSchema.parse({})),
  projects: z.array(projectItemSchema).max(30).default([]),
  publications: z.array(publicationItemSchema).max(30).default([]),
  softSkills: z.array(shortText).max(60).default([]),
  summary: longText.default(""),
  technicalSkills: z.array(shortText).max(60).default([]),
  volunteer: z.array(volunteerItemSchema).max(20).default([]),
});

export type ResumeSections = z.infer<typeof resumeSectionsSchema>;
export type PersonalInfo = z.infer<typeof personalSchema>;
export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;
export type CertificationItem = z.infer<typeof certificationItemSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;
export type PublicationItem = z.infer<typeof publicationItemSchema>;
export type VolunteerItem = z.infer<typeof volunteerItemSchema>;
export type LinkItem = z.infer<typeof linkItemSchema>;

/** A blank sections payload for a new resume. */
export function emptyResumeSections(): ResumeSections {
  return resumeSectionsSchema.parse({});
}

export function serializeSections(sections: ResumeSections): string {
  return JSON.stringify(resumeSectionsSchema.parse(sections));
}

/** Parse a stored sectionsJson string. Throws on invalid JSON or a
 * payload that fails validation — callers must not paper over a
 * corrupt resume by rendering half of it. */
export function parseSections(sectionsJson: string): ResumeSections {
  const raw: unknown = JSON.parse(sectionsJson);
  return resumeSectionsSchema.parse(raw);
}

/** Validate an untrusted sections payload from an API request.
 * Returns null instead of throwing so routes can answer 400. */
export function validateSections(input: unknown): ResumeSections | null {
  const parsed = resumeSectionsSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

/** Enabled sections are stored comma-separated (schema must stay
 * SQLite/Postgres compatible). Unknown ids are dropped. */
export function enabledToString(enabled: SectionId[]): string {
  return enabled.join(", ");
}

export function stringToEnabled(value: string): SectionId[] {
  const found = value
    .split(",")
    .map((item) => item.trim())
    .filter(isSectionId);
  // Personal info is always available — a resume without a name
  // block is useless, so it can never be switched off entirely.
  return found.includes("personal") ? found : ["personal", ...found];
}

/** Validate an untrusted enabled-sections list from an API request. */
export function validateEnabledSections(input: unknown): SectionId[] | null {
  if (!Array.isArray(input)) return null;
  const enabled: SectionId[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !isSectionId(item)) return null;
    if (!enabled.includes(item)) enabled.push(item);
  }
  return enabled.includes("personal") ? enabled : ["personal", ...enabled];
}

/** Does a section have anything worth rendering? Used by templates
 * and the PDF exporter so empty sections never print headings. */
export function sectionHasContent(
  sections: ResumeSections,
  sectionId: SectionId,
): boolean {
  switch (sectionId) {
    case "personal":
      return Object.values(sections.personal).some((v) => v.trim().length > 0);
    case "summary":
      return sections.summary.trim().length > 0;
    case "technicalSkills":
      return sections.technicalSkills.length > 0;
    case "softSkills":
      return sections.softSkills.length > 0;
    case "achievements":
      return sections.achievements.length > 0;
    default:
      return sections[sectionId].length > 0;
  }
}
