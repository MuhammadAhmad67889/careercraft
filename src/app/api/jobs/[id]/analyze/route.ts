import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { runJobAnalysis } from "@/lib/jobs";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

const analyzeSchema = z.object({
  resumeId: z.string().trim().min(1).max(100),
});

/**
 * Run the matching engine for one of the user's resumes against
 * this job description. The monthly plan limit is enforced in
 * the data layer (403 with a clear message). In live mode, an AI
 * recommendation failure returns 502 and nothing is saved —
 * rule-based text is never silently substituted.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`job-analyze:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many analyses. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Choose a resume to analyze.", 400);
  }

  try {
    const result = await runJobAnalysis(user.id, parsed.data.resumeId, id);
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 403;
      return formError(result.error, status);
    }
    return NextResponse.json({ analysis: result.value }, { status: 201 });
  } catch (error) {
    console.error("Job analysis failed:", error);
    return formError(
      "The AI service could not be reached, so no analysis was saved. Try again shortly.",
      502,
    );
  }
}
