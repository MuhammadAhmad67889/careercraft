import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import {
  COVER_LETTER_TONES,
  generateCoverLetterForUser,
} from "@/lib/coverLetters";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const generateSchema = z.object({
  companyName: z.string().trim().max(160).optional(),
  jobDescriptionId: z.string().trim().min(1).max(100).optional(),
  positionTitle: z.string().trim().max(160).optional(),
  resumeId: z.string().trim().min(1).max(100),
  tone: z.enum(COVER_LETTER_TONES),
});

/**
 * Generate a cover letter from one of the user's resumes,
 * optionally aimed at a saved job description. The monthly plan
 * limit is enforced in the data layer (403 with a clear message).
 * In live mode, an AI failure returns 502 and nothing is saved —
 * template text is never silently substituted as if it were AI.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`cover-letter:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many generations. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Choose a resume and a tone.", 400);
  }

  try {
    const result = await generateCoverLetterForUser(user.id, {
      companyName: parsed.data.companyName,
      jobDescriptionId: parsed.data.jobDescriptionId ?? null,
      positionTitle: parsed.data.positionTitle,
      resumeId: parsed.data.resumeId,
      tone: parsed.data.tone,
    });
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 403;
      return formError(result.error, status);
    }
    return NextResponse.json({ coverLetter: result.value }, { status: 201 });
  } catch (error) {
    console.error("Cover letter generation failed:", error);
    return formError(
      "The AI service could not be reached, so no cover letter was saved. Try again shortly.",
      502,
    );
  }
}
