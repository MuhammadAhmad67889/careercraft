import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { buildCoverLetterPdf } from "@/lib/coverLetterPdf";
import { getCoverLetterForUser, snapshotCoverLetter } from "@/lib/coverLetters";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Download the cover letter as a PDF with selectable text.
 * Exporting stores a version snapshot first, so the exported
 * state can be recovered later. */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json(
      { errors: { form: "Not signed in." } },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const coverLetter = await getCoverLetterForUser(user.id, id);
  if (!coverLetter) {
    return NextResponse.json(
      { errors: { form: "Cover letter not found." } },
      { status: 404 },
    );
  }

  const db = getPrisma();
  const row = await db.coverLetter.findFirst({ where: { id, userId: user.id } });
  if (row) await snapshotCoverLetter(row, "export", db);

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const pdf = await buildCoverLetterPdf(coverLetter.title, coverLetter.bodyText, dateLabel);
  const fileName = `${coverLetter.title.replace(/[^\w\- ]+/g, "").trim() || "cover-letter"}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
