import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { buildResumePdf } from "@/lib/resumePdf";
import { getResumeForUser, snapshotResumeById } from "@/lib/resumes";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Download the resume as a PDF with selectable text. Exporting
 * stores a version snapshot first, so the exported state can be
 * recovered later. */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json(
      { errors: { form: "Not signed in." } },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const resume = await getResumeForUser(user.id, id);
  if (!resume) {
    return NextResponse.json(
      { errors: { form: "Resume not found." } },
      { status: 404 },
    );
  }

  await snapshotResumeById(user.id, id, "export");
  const pdf = await buildResumePdf(
    resume.sections,
    resume.template,
    resume.enabledSections,
  );
  const fileName = `${resume.title.replace(/[^\w\- ]+/g, "").trim() || "resume"}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
