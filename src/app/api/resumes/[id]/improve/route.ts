import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { improveText, type ImproveFieldKind } from "@/lib/aiImprove";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { getResumeForUser } from "@/lib/resumes";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

const improveSchema = z.object({
  kind: z.enum(["summary", "experienceBullet", "projectDescription", "achievement"]),
  text: z.string().trim().min(1).max(4000),
});

/** Improve the wording of one resume field. The resume must belong
 * to the signed-in user (checked before any AI call). Demo mode is
 * labelled in the response; a live provider failure returns 502 —
 * demo text is never silently substituted. */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`ai-improve:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many AI requests. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const resume = await getResumeForUser(user.id, id);
  if (!resume) return formError("Resume not found.", 404);

  const body = await req.json().catch(() => null);
  const parsed = improveSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Send the field kind and the text to improve.", 400);
  }

  try {
    const result = await improveText(
      parsed.data.kind as ImproveFieldKind,
      parsed.data.text,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI improve failed:", error);
    return formError(
      "The AI service could not be reached. Your text is unchanged — try again shortly.",
      502,
    );
  }
}
