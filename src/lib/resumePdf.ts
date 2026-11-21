import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  SECTION_IDS,
  SECTION_LABELS,
  sectionHasContent,
  type ResumeSections,
  type SectionId,
} from "./resumeData";
import type { TemplateId } from "./resumeTemplates";

/**
 * Server-side PDF export with pdf-lib. The output uses real,
 * selectable text (standard PDF fonts, no images of text) in a
 * single column with standard headings, so applicant tracking
 * systems can read it. Templates change typography and colour
 * only — content and order stay the same.
 */

const PAGE_WIDTH = 595; // A4
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface TemplateStyle {
  accent: { b: number; g: number; r: number };
  bodyFont: StandardFonts;
  centeredHeader: boolean;
  headingFont: StandardFonts;
  headingSize: number;
  nameSize: number;
  ruleUnderHeadings: boolean;
}

const INK = rgb(0.12, 0.14, 0.2);
const MUTED = rgb(0.36, 0.4, 0.47);

function styleFor(template: TemplateId): TemplateStyle {
  switch (template) {
    case "professional":
      return {
        accent: { b: 0.2, g: 0.2, r: 0.2 },
        bodyFont: StandardFonts.TimesRoman,
        centeredHeader: true,
        headingFont: StandardFonts.TimesRomanBold,
        headingSize: 12,
        nameSize: 22,
        ruleUnderHeadings: false,
      };
    case "minimal":
      return {
        accent: { b: 0.4, g: 0.42, r: 0.45 },
        bodyFont: StandardFonts.Helvetica,
        centeredHeader: false,
        headingFont: StandardFonts.HelveticaBold,
        headingSize: 10,
        nameSize: 20,
        ruleUnderHeadings: false,
      };
    case "academic":
      return {
        accent: { b: 0.15, g: 0.15, r: 0.15 },
        bodyFont: StandardFonts.TimesRoman,
        centeredHeader: true,
        headingFont: StandardFonts.TimesRomanBold,
        headingSize: 12,
        nameSize: 20,
        ruleUnderHeadings: true,
      };
    case "technical":
      return {
        accent: { b: 0.55, g: 0.3, r: 0.1 },
        bodyFont: StandardFonts.Helvetica,
        centeredHeader: false,
        headingFont: StandardFonts.CourierBold,
        headingSize: 11,
        nameSize: 20,
        ruleUnderHeadings: false,
      };
    case "modern":
    default:
      return {
        accent: { b: 0.9, g: 0.27, r: 0.31 },
        bodyFont: StandardFonts.Helvetica,
        centeredHeader: false,
        headingFont: StandardFonts.HelveticaBold,
        headingSize: 11,
        nameSize: 22,
        ruleUnderHeadings: false,
      };
  }
}

/** A tiny text writer that tracks the cursor and breaks pages. */
class PdfWriter {
  private page: PDFPage;
  private y: number;

  constructor(
    private doc: PDFDocument,
    private bodyFont: PDFFont,
    private boldFont: PDFFont,
    private headingFont: PDFFont,
    private style: TemplateStyle,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  }

  text(
    value: string,
    options: {
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      size?: number;
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.bold ? this.boldFont : this.bodyFont;
    const indent = options.indent ?? 0;
    const lines = this.wrap(value, font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensureSpace(size + 4);
      this.page.drawText(line, {
        color: options.color ?? INK,
        font,
        size,
        x: MARGIN + indent,
        y: this.y - size,
      });
      this.y -= size + 4;
    }
  }

  centeredText(value: string, size: number, font: PDFFont, color = INK) {
    const width = font.widthOfTextAtSize(value, size);
    this.ensureSpace(size + 4);
    this.page.drawText(value, {
      color,
      font,
      size,
      x: (PAGE_WIDTH - width) / 2,
      y: this.y - size,
    });
    this.y -= size + 4;
  }

  heading(label: string) {
    this.y -= 8;
    const size = this.style.headingSize;
    this.ensureSpace(size + 8);
    this.page.drawText(label.toUpperCase(), {
      color: rgb(this.style.accent.r, this.style.accent.g, this.style.accent.b),
      font: this.headingFont,
      size,
      x: MARGIN,
      y: this.y - size,
    });
    this.y -= size + 4;
    if (this.style.ruleUnderHeadings) {
      this.page.drawLine({
        color: MUTED,
        end: { x: PAGE_WIDTH - MARGIN, y: this.y + 2 },
        start: { x: MARGIN, y: this.y + 2 },
        thickness: 0.5,
      });
      this.y -= 4;
    }
  }

  bullet(value: string) {
    this.text(`• ${value}`, { indent: 10 });
  }

  gap(height = 6) {
    this.y -= height;
  }

  get fonts() {
    return { body: this.bodyFont, bold: this.boldFont, heading: this.headingFont };
  }
}

function dateRange(start: string, end: string, current = false): string {
  const endLabel = current ? "Present" : end;
  if (start && endLabel) return `${start} – ${endLabel}`;
  return start || endLabel;
}

function writeHeader(writer: PdfWriter, sections: ResumeSections, style: TemplateStyle) {
  const personal = sections.personal;
  const name = personal.fullName || "Your Name";
  if (style.centeredHeader) {
    writer.centeredText(name, style.nameSize, writer.fonts.heading);
    if (personal.headline) {
      writer.centeredText(personal.headline, 11, writer.fonts.body, MUTED);
    }
  } else {
    writer.text(name, { bold: true, size: style.nameSize });
    if (personal.headline) {
      writer.text(personal.headline, { color: MUTED, size: 11 });
    }
  }
  const contact = [personal.email, personal.phone, personal.location, personal.website]
    .filter((part) => part.trim().length > 0)
    .join("  ·  ");
  if (contact) {
    if (style.centeredHeader) {
      writer.centeredText(contact, 9, writer.fonts.body, MUTED);
    } else {
      writer.text(contact, { color: MUTED, size: 9 });
    }
  }
  writer.gap(6);
}

function writeSection(
  writer: PdfWriter,
  sections: ResumeSections,
  sectionId: SectionId,
) {
  writer.heading(SECTION_LABELS[sectionId]);
  switch (sectionId) {
    case "summary":
      writer.text(sections.summary);
      break;
    case "experience":
      for (const job of sections.experience) {
        const titleLine = [job.title, job.company].filter(Boolean).join(" — ");
        if (titleLine) writer.text(titleLine, { bold: true, size: 11 });
        const meta = [dateRange(job.startDate, job.endDate, job.current), job.location]
          .filter(Boolean)
          .join("  ·  ");
        if (meta) writer.text(meta, { color: MUTED, size: 9 });
        for (const bullet of job.bullets) writer.bullet(bullet);
        writer.gap(4);
      }
      break;
    case "education":
      for (const edu of sections.education) {
        const titleLine = [edu.degree, edu.field].filter(Boolean).join(", ");
        if (titleLine) writer.text(titleLine, { bold: true, size: 11 });
        const meta = [edu.school, dateRange(edu.startDate, edu.endDate)]
          .filter(Boolean)
          .join("  ·  ");
        if (meta) writer.text(meta, { color: MUTED, size: 9 });
        if (edu.notes) writer.text(edu.notes);
        writer.gap(4);
      }
      break;
    case "technicalSkills":
      writer.text(sections.technicalSkills.join("  ·  "));
      break;
    case "softSkills":
      writer.text(sections.softSkills.join("  ·  "));
      break;
    case "projects":
      for (const project of sections.projects) {
        const titleLine = [project.name, project.tech].filter(Boolean).join(" — ");
        if (titleLine) writer.text(titleLine, { bold: true, size: 11 });
        if (project.link) writer.text(project.link, { color: MUTED, size: 9 });
        if (project.description) writer.text(project.description);
        for (const bullet of project.bullets) writer.bullet(bullet);
        writer.gap(4);
      }
      break;
    case "certifications":
      for (const cert of sections.certifications) {
        const line = [cert.name, cert.issuer, cert.date].filter(Boolean).join(" — ");
        if (line) writer.bullet(line);
      }
      break;
    case "languages":
      writer.text(
        sections.languages
          .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
          .join("  ·  "),
      );
      break;
    case "achievements":
      for (const item of sections.achievements) writer.bullet(item);
      break;
    case "publications":
      for (const pub of sections.publications) {
        const line = [pub.title, pub.publisher, pub.date].filter(Boolean).join(" — ");
        if (line) writer.bullet(line);
        if (pub.link) writer.text(pub.link, { color: MUTED, indent: 10, size: 9 });
      }
      break;
    case "volunteer":
      for (const item of sections.volunteer) {
        const titleLine = [item.role, item.organization].filter(Boolean).join(" — ");
        if (titleLine) writer.text(titleLine, { bold: true, size: 11 });
        const meta = dateRange(item.startDate, item.endDate);
        if (meta) writer.text(meta, { color: MUTED, size: 9 });
        for (const bullet of item.bullets) writer.bullet(bullet);
        writer.gap(4);
      }
      break;
    case "links":
      for (const link of sections.links) {
        const line = link.label ? `${link.label}: ${link.url}` : link.url;
        if (line.trim()) writer.bullet(line);
      }
      break;
    default:
      break;
  }
}

/** Render a resume to a PDF buffer with selectable text. */
export async function buildResumePdf(
  sections: ResumeSections,
  template: TemplateId,
  enabledSections: SectionId[],
): Promise<Buffer> {
  const style = styleFor(template);
  const doc = await PDFDocument.create();
  const bodyFont = await doc.embedFont(style.bodyFont);
  const boldFont = await doc.embedFont(
    style.bodyFont === StandardFonts.TimesRoman
      ? StandardFonts.TimesRomanBold
      : StandardFonts.HelveticaBold,
  );
  const headingFont = await doc.embedFont(style.headingFont);

  const writer = new PdfWriter(doc, bodyFont, boldFont, headingFont, style);
  writeHeader(writer, sections, style);

  for (const sectionId of SECTION_IDS) {
    if (sectionId === "personal") continue;
    if (!enabledSections.includes(sectionId)) continue;
    if (!sectionHasContent(sections, sectionId)) continue;
    writeSection(writer, sections, sectionId);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
