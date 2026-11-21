import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { regenerateCoverLetterParagraph } from "@/lib/coverLetters";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

const regenerateSchema = z.object({
  paragraphIndex: z.number().int().min(0).max(50),
});

/**
 * Regenerate one paragraph of a saved cover letter. In live mode
 * an AI failure returns 502 and the stored letter is left
 * untouched; in demo mode the paragraph is rebuilt from the
 * template against the current resume.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`cover-letter-regen:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many regenerations. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = regenerateSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Choose a paragraph to regenerate.", 400);
  }

  try {
    const result = await regenerateCoverLetterParagraph(
      user.id,
      id,
      parsed.data.paragraphIndex,
    );
    if (!result.ok) return formError(result.error, 404);
    return NextResponse.json({ coverLetter: result.value });
  } catch (error) {
    console.error("Cover letter regeneration failed:", error);
    return formError(
      "The AI service could not be reached, so the letter was left unchanged. Try again shortly.",
      502,
    );
  }
}
