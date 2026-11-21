import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { createLinkedInAnalysis } from "@/lib/linkedin";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const analyzeSchema = z.object({
  inputText: z.string().trim().min(1).max(20000),
  targetRole: z.string().trim().max(120).optional(),
});

/**
 * Analyse pasted LinkedIn profile text. Paste-in only — the app
 * never scrapes LinkedIn. The monthly plan limit is enforced in
 * the data layer (403 with a clear message). In live mode, an AI
 * failure returns 502 and nothing is saved.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`linkedin-analyze:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Paste your LinkedIn headline and About text first.", 400);
  }

  try {
    const result = await createLinkedInAnalysis(
      user.id,
      parsed.data.inputText,
      parsed.data.targetRole ?? "",
    );
    if (!result.ok) return formError(result.error, 403);
    return NextResponse.json({ analysis: result.value }, { status: 201 });
  } catch (error) {
    console.error("LinkedIn analysis failed:", error);
    return formError(
      "The AI service could not be reached, so no analysis was saved. Try again shortly.",
      502,
    );
  }
}
