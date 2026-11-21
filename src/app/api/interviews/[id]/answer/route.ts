import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { answerInterviewQuestion } from "@/lib/interviews";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

const answerSchema = z.object({
  answerText: z.string().trim().min(1).max(8000),
  questionId: z.string().trim().min(1).max(100),
});

/**
 * Submit an answer to one question and get its feedback back with
 * the updated session. Answering the last question completes the
 * session. In live mode, an AI failure returns 502 and nothing is
 * saved — the answer can simply be submitted again.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`interview-answer:${clientIp(req)}`, 60, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Write an answer first.", 400);
  }

  try {
    const result = await answerInterviewQuestion(
      user.id,
      id,
      parsed.data.questionId,
      parsed.data.answerText,
    );
    if (!result.ok) {
      const status = result.error.includes("not found") ? 404 : 400;
      return formError(result.error, status);
    }
    return NextResponse.json({ session: result.value });
  } catch (error) {
    console.error("Interview feedback failed:", error);
    return formError(
      "The AI service could not be reached, so your answer was not saved. Try again shortly.",
      502,
    );
  }
}
