import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  emptyResumeSections,
  type ResumeSections,
  type SectionId,
} from "./resumeData";

/**
 * Resume upload + extraction. Two jobs:
 *
 * 1. Validate the uploaded file (extension, size, magic bytes) so
 *    only real PDFs and DOCXs reach the parsers.
 * 2. Turn extracted text into editor sections on a best-effort
 *    basis. Anything the parser cannot place is returned as
 *    reviewText — uploaded content is never silently dropped.
 *
 * Uploaded text is untrusted data: it is only ever parsed into
 * fields, never treated as instructions.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadKind = "pdf" | "docx";

export type UploadCheck =
  | { kind: UploadKind; ok: true }
  | { error: string; ok: false };

/** Magic bytes: PDFs start with "%PDF", DOCX is a ZIP ("PK"). */
function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function checkUpload(fileName: string, buffer: Buffer): UploadCheck {
  if (buffer.length === 0) {
    return { error: "The uploaded file is empty.", ok: false };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      error: `File is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      ok: false,
    };
  }
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    if (!startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) {
      return { error: "That file is not a valid PDF.", ok: false };
    }
    return { kind: "pdf", ok: true };
  }
  if (lowerName.endsWith(".docx")) {
    if (!startsWithBytes(buffer, [0x50, 0x4b])) {
      return { error: "That file is not a valid DOCX document.", ok: false };
    }
    return { kind: "docx", ok: true };
  }
  return {
    error: "Only PDF and DOCX resumes can be uploaded.",
    ok: false,
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractUploadText(
  kind: UploadKind,
  buffer: Buffer,
): Promise<string> {
  const text =
    kind === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);
  return text.replace(/\r\n/g, "\n").trim();
}

/** Heading keywords that start a section in a plain-text resume.
 * Matched against short lines only, so a sentence mentioning
 * "experience" mid-paragraph does not split the document. */
const HEADING_KEYWORDS: { keywords: string[]; section: SectionId }[] = [
  { keywords: ["summary", "profile", "objective", "about"], section: "summary" },
  {
    keywords: ["experience", "employment", "work history", "career"],
    section: "experience",
  },
  { keywords: ["education", "academic"], section: "education" },
  {
    keywords: ["technical skills", "skills", "technologies", "tech stack"],
    section: "technicalSkills",
  },
  { keywords: ["soft skills"], section: "softSkills" },
  { keywords: ["projects", "portfolio"], section: "projects" },
  { keywords: ["certification", "certificates", "courses"], section: "certifications" },
  { keywords: ["languages"], section: "languages" },
  { keywords: ["achievements", "awards", "honors", "honours"], section: "achievements" },
  { keywords: ["publications", "papers"], section: "publications" },
  { keywords: ["volunteer", "volunteering", "community"], section: "volunteer" },
  { keywords: ["links", "profiles", "social"], section: "links" },
];

function headingSection(line: string): SectionId | null {
  const cleaned = line.trim().toLowerCase().replace(/[:\-–—]+$/, "").trim();
  if (cleaned.length === 0 || cleaned.length > 40) return null;
  for (const { keywords, section } of HEADING_KEYWORDS) {
    if (keywords.some((keyword) => cleaned === keyword || cleaned.startsWith(keyword))) {
      return section;
    }
  }
  return null;
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_PATTERN = /(\+?\d[\d\s\-()]{6,}\d)/;
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/;

function splitList(text: string): string[] {
  return text
    .split(/[\n,•·|]/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter((item) => item.length > 0 && item.length <= 120)
    .slice(0, 60);
}

function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•·]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 30);
}

export interface ParsedResume {
  /** Sections that received content, so the caller can enable them. */
  filledSections: SectionId[];
  /** Text the parser could not place — shown to the user for review. */
  reviewText: string;
  sections: ResumeSections;
}

/**
 * Best-effort parse of plain resume text into sections. The first
 * lines are treated as the header (name, headline, contact). Lines
 * that look like section headings switch the current section.
 * Blocks that do not fit a structured section are kept in
 * reviewText rather than forced into a wrong field.
 */
export function parseResumeText(rawText: string): ParsedResume {
  const sections = emptyResumeSections();
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const blocks = new Map<SectionId, string[]>();
  const headerLines: string[] = [];
  const unplaced: string[] = [];
  let current: SectionId | null = null;

  for (const line of lines) {
    const heading = headingSection(line);
    if (heading) {
      current = heading;
      if (!blocks.has(heading)) blocks.set(heading, []);
      continue;
    }
    if (current === null) {
      headerLines.push(line);
    } else {
      blocks.get(current)?.push(line);
    }
  }

  // Header: first line is usually the name; contact details are
  // pulled out wherever they appear in the header block.
  const headerText = headerLines.join("\n");
  const email = headerText.match(EMAIL_PATTERN)?.[0] ?? "";
  const phone = headerText.match(PHONE_PATTERN)?.[0] ?? "";
  const website = headerText.match(URL_PATTERN)?.[0] ?? "";
  sections.personal = {
    email,
    fullName: headerLines[0] ?? "",
    headline: headerLines[1] && !EMAIL_PATTERN.test(headerLines[1]) ? headerLines[1] : "",
    location: "",
    phone,
    website,
  };
  // Header lines beyond name/headline/contact go to review, so the
  // user can place them by hand.
  for (const line of headerLines.slice(2)) {
    if (line === email || line === phone || line === website) continue;
    if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) continue;
    unplaced.push(line);
  }

  const filled: SectionId[] = ["personal"];

  for (const [sectionId, blockLines] of blocks) {
    const text = blockLines.join("\n").trim();
    if (!text) continue;
    filled.push(sectionId);
    switch (sectionId) {
      case "summary":
        sections.summary = text;
        break;
      case "technicalSkills":
        sections.technicalSkills = splitList(text);
        break;
      case "softSkills":
        sections.softSkills = splitList(text);
        break;
      case "achievements":
        sections.achievements = splitBullets(text);
        break;
      case "experience":
        // One entry per block is a guess too far; keep the text as
        // bullets on a single entry the user can split in the editor.
        sections.experience = [
          {
            bullets: splitBullets(text),
            company: "",
            current: false,
            endDate: "",
            location: "",
            startDate: "",
            title: "",
          },
        ];
        break;
      case "education":
        sections.education = [
          {
            degree: "",
            endDate: "",
            field: "",
            notes: text,
            school: "",
            startDate: "",
          },
        ];
        break;
      case "projects":
        sections.projects = [
          { bullets: [], description: text, link: "", name: "", tech: "" },
        ];
        break;
      case "certifications":
        sections.certifications = splitBullets(text).map((name) => ({
          date: "",
          issuer: "",
          name,
        }));
        break;
      case "languages":
        sections.languages = splitList(text).map((name) => ({ level: "", name }));
        break;
      case "publications":
        sections.publications = splitBullets(text).map((title) => ({
          date: "",
          link: "",
          publisher: "",
          title,
        }));
        break;
      case "volunteer":
        sections.volunteer = [
          {
            bullets: splitBullets(text),
            endDate: "",
            organization: "",
            role: "",
            startDate: "",
          },
        ];
        break;
      case "links":
        sections.links = splitBullets(text).map((line) => ({
          label: "",
          url: line.match(URL_PATTERN)?.[0] ?? line,
        }));
        break;
      default:
        unplaced.push(text);
    }
  }

  return {
    filledSections: filled,
    reviewText: unplaced.join("\n").trim(),
    sections,
  };
}
