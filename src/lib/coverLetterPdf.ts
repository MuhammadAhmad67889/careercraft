import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { splitParagraphs } from "./coverLetters";

/**
 * Server-side cover letter PDF export with pdf-lib. Real,
 * selectable text in a plain single-column letter layout — the
 * same approach as the resume exporter, minus the templates.
 */

const PAGE_WIDTH = 595; // A4
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;

const INK = rgb(0.12, 0.14, 0.2);
const MUTED = rgb(0.36, 0.4, 0.47);

class LetterWriter {
  private page: PDFPage;
  private y: number;

  constructor(
    private doc: PDFDocument,
    private bodyFont: PDFFont,
    private boldFont: PDFFont,
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

  private wrap(text: string, font: PDFFont, size: number): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= CONTENT_WIDTH || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  line(text: string, options: { bold?: boolean; muted?: boolean } = {}) {
    const font = options.bold ? this.boldFont : this.bodyFont;
    this.ensureSpace(LINE_HEIGHT);
    this.page.drawText(text, {
      color: options.muted ? MUTED : INK,
      font,
      size: FONT_SIZE,
      x: MARGIN,
      y: this.y - FONT_SIZE,
    });
    this.y -= LINE_HEIGHT;
  }

  paragraph(text: string) {
    // A paragraph may contain single newlines (e.g. the sign-off);
    // each physical line is wrapped on its own.
    for (const physicalLine of text.split("\n")) {
      for (const wrapped of this.wrap(physicalLine, this.bodyFont, FONT_SIZE)) {
        this.line(wrapped);
      }
    }
    this.y -= 6;
  }
}

/** Render a cover letter to a PDF buffer with selectable text. */
export async function buildCoverLetterPdf(
  title: string,
  bodyText: string,
  dateLabel: string,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const bodyFont = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const writer = new LetterWriter(doc, bodyFont, boldFont);

  writer.line(title, { bold: true });
  writer.line(dateLabel, { muted: true });
  writer.line("");

  for (const paragraph of splitParagraphs(bodyText)) {
    writer.paragraph(paragraph);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
