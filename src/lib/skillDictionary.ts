/**
 * A small, curated dictionary of skills the JD parser and matcher
 * recognise in free text. Each skill has a display name and the
 * spellings that count as the same skill (aliases), so "Node",
 * "Node.js" and "nodejs" all match one canonical skill.
 *
 * The dictionary is deliberately modest (~100 skills): it exists
 * so common skills are found reliably, not to be exhaustive.
 * Skills a job description names that are not in here are still
 * handled — the matcher also searches the resume text for the
 * exact phrase the JD used.
 */

export interface SkillEntry {
  /** Canonical display name, e.g. "Node.js". */
  name: string;
  /** Lowercase spellings that mean this skill, including the name. */
  aliases: string[];
}

function skill(name: string, ...aliases: string[]): SkillEntry {
  return { aliases: [name.toLowerCase(), ...aliases], name };
}

export const SKILL_DICTIONARY: SkillEntry[] = [
  // Languages
  skill("JavaScript", "js"),
  skill("TypeScript", "ts"),
  skill("Python"),
  skill("Java"),
  skill("C++", "cpp"),
  skill("C#", "csharp"),
  skill("PHP"),
  skill("Ruby"),
  skill("Go", "golang"),
  skill("Rust"),
  skill("Swift"),
  skill("Kotlin"),
  skill("SQL"),
  skill("HTML", "html5"),
  skill("CSS", "css3"),
  // Frontend
  skill("React", "react.js", "reactjs"),
  skill("Next.js", "nextjs"),
  skill("Vue", "vue.js", "vuejs"),
  skill("Angular"),
  skill("Tailwind CSS", "tailwind"),
  skill("Redux"),
  skill("Sass", "scss"),
  // Backend
  skill("Node.js", "node", "nodejs"),
  skill("Express", "express.js"),
  skill("Django"),
  skill("Flask"),
  skill("Laravel"),
  skill("Spring Boot", "spring"),
  skill("REST APIs", "rest", "restful", "rest api"),
  skill("GraphQL"),
  skill("Prisma"),
  // Data
  skill("PostgreSQL", "postgres"),
  skill("MySQL"),
  skill("MongoDB", "mongo"),
  skill("Redis"),
  skill("SQLite"),
  skill("Data Analysis", "data analytics"),
  skill("Machine Learning", "ml"),
  skill("TensorFlow"),
  skill("PyTorch"),
  skill("Pandas"),
  skill("Excel", "microsoft excel", "spreadsheets"),
  skill("Power BI", "powerbi"),
  skill("Tableau"),
  // Cloud / DevOps
  skill("AWS", "amazon web services"),
  skill("Azure", "microsoft azure"),
  skill("Google Cloud", "gcp"),
  skill("Docker"),
  skill("Kubernetes", "k8s"),
  skill("CI/CD", "ci cd", "continuous integration", "continuous deployment"),
  skill("Git"),
  skill("GitHub"),
  skill("Linux"),
  skill("Firebase"),
  skill("Vercel"),
  // Mobile
  skill("React Native"),
  skill("Flutter"),
  skill("Android"),
  skill("iOS"),
  // Quality / process
  skill("Testing", "unit testing", "test automation"),
  skill("Jest"),
  skill("Playwright"),
  skill("Cypress"),
  skill("Agile"),
  skill("Scrum"),
  skill("Project Management", "project manager"),
  skill("Figma"),
  skill("UI Design", "ui/ux", "ux design", "user interface"),
  // Business / other
  skill("Communication"),
  skill("Teamwork", "team work"),
  skill("Leadership"),
  skill("Problem Solving", "problem-solving"),
  skill("SEO", "search engine optimization"),
  skill("Digital Marketing", "marketing"),
  skill("Sales"),
  skill("Accounting"),
  skill("Customer Support", "customer service"),
  skill("Content Writing", "copywriting"),
  skill("WordPress"),
  skill("Shopify"),
];

/** Lowercase, collapse whitespace, and trim punctuation from the
 * edges so "React," and "react" compare equal. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Escape a string for use inside a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does this text mention the given phrase as whole words? The
 * lookbehind also rejects a preceding dot, so the "js" alias for
 * JavaScript does not fire inside "Node.js" or "Next.js".
 */
export function textMentions(text: string, phrase: string): boolean {
  const haystack = normalizeText(text);
  const needle = normalizeText(phrase);
  if (!needle) return false;
  const pattern = new RegExp(
    `(?<![a-z0-9.])${escapeRegExp(needle)}(?![a-z0-9])`,
  );
  return pattern.test(haystack);
}

/** Find every dictionary skill mentioned in a text, in dictionary
 * order, deduplicated. */
export function findSkillsInText(text: string): string[] {
  const found: string[] = [];
  for (const entry of SKILL_DICTIONARY) {
    if (entry.aliases.some((alias) => textMentions(text, alias))) {
      found.push(entry.name);
    }
  }
  return found;
}

/** Map any spelling of a skill to its canonical dictionary name,
 * or null when the dictionary does not know it. */
export function canonicalSkillName(value: string): string | null {
  const normalized = normalizeText(value);
  for (const entry of SKILL_DICTIONARY) {
    if (entry.aliases.includes(normalized)) return entry.name;
  }
  return null;
}

/**
 * Does a set of resume skills (plus the full resume text) cover
 * one job skill? A job skill counts as covered when the resume
 * lists it (under any alias) or mentions it anywhere in its text.
 * This is what lets off-dictionary JD skills still match.
 */
export function resumeCoversSkill(
  jobSkill: string,
  resumeSkillNames: string[],
  resumeText: string,
): boolean {
  const canonical = canonicalSkillName(jobSkill);
  for (const resumeSkill of resumeSkillNames) {
    if (normalizeText(resumeSkill) === normalizeText(jobSkill)) return true;
    if (canonical && canonicalSkillName(resumeSkill) === canonical) return true;
  }
  if (textMentions(resumeText, jobSkill)) return true;
  if (canonical) {
    const entry = SKILL_DICTIONARY.find((item) => item.name === canonical);
    if (entry && entry.aliases.some((alias) => textMentions(resumeText, alias))) {
      return true;
    }
  }
  return false;
}

/** Words that carry no matching signal when comparing
 * responsibility lines with resume bullets. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "in", "into", "is", "it", "of", "on", "or", "our", "that", "the",
  "their", "this", "to", "we", "will", "with", "you", "your",
]);

/** Very light stemming so "dashboards" matches "dashboard" and
 * "building" matches "build" when comparing responsibility lines
 * with resume bullets. Deliberately conservative: short words and
 * words ending in "ss" (like "css") are left alone. */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

/** Split text into meaningful lowercase words for overlap checks. */
export function contentWords(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9+#.]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .map(stem);
}
