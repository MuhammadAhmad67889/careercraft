import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import {
  checkUpload,
  extractUploadText,
  parseResumeText,
} from "@/lib/resumeExtract";
import { createResume } from "@/lib/resumes";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

/** Upload a PDF or DOCX resume: validate the file, extract its
 * text, parse it into sections (best effort), and create a resume
 * from the result. Text the parser cannot place is stored as
 * reviewText so nothing is silently dropped. Counts against the
 * plan limit like any other resume. */
export async function POST(req: NextRequest) {
  if (isRateLimited(`resume-upload:${clientIp(req)}`, 10, 60_000)) {
    return formError("Too many uploads. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return formError("Choose a PDF or DOCX file to upload.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = checkUpload(file.name, buffer);
  if (!check.ok) return formError(check.error, 400);

  let text: string;
  try {
    text = await extractUploadText(check.kind, buffer);
  } catch (error) {
    console.error("Resume text extraction failed:", error);
    return formError(
      "We could not read text from that file. Try a different PDF or DOCX.",
      422,
    );
  }
  if (!text) {
    return formError(
      "No readable text found in that file (scanned images are not supported).",
      422,
    );
  }

  const parsed = parseResumeText(text);
  const title =
    parsed.sections.personal.fullName.trim() ||
    file.name.replace(/\.(pdf|docx)$/i, "");
  const result = await createResume(user.id, {
    enabledSections: parsed.filledSections,
    reviewText: parsed.reviewText || null,
    sections: parsed.sections,
    sourceFileName: file.name,
    title: `${title} (imported)`,
  });
  if (!result.ok) return formError(result.error, 403);
  return NextResponse.json({ resume: result.value }, { status: 201 });
}
