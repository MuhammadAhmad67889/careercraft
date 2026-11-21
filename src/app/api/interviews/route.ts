import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { INTERVIEW_TYPES } from "@/lib/interviewData";
import { createInterviewSession } from "@/lib/interviews";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const createSchema = z.object({
  interviewType: z.enum(INTERVIEW_TYPES),
  jobDescriptionId: z.string().trim().min(1).max(100).nullable().optional(),
  resumeId: z.string().trim().min(1).max(100).nullable().optional(),
});

/**
 * Start a mock interview session. The monthly plan limit is
 * enforced in the data layer (403 with a clear message). In live
 * mode, an AI failure returns 502 and nothing is saved — demo
 * questions are never silently substituted as if they were AI.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`interview-start:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Choose an interview type.", 400);
  }

  try {
    const result = await createInterviewSession(user.id, {
      interviewType: parsed.data.interviewType,
      jobDescriptionId: parsed.data.jobDescriptionId ?? null,
      resumeId: parsed.data.resumeId ?? null,
    });
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 403;
      return formError(result.error, status);
    }
    return NextResponse.json({ session: result.value }, { status: 201 });
  } catch (error) {
    console.error("Interview session creation failed:", error);
    return formError(
      "The AI service could not be reached, so no interview was started. Try again shortly.",
      502,
    );
  }
}
