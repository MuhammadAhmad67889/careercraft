import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { runAtsCheck } from "@/lib/jobs";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const atsSchema = z.object({
  jobDescriptionId: z.string().trim().min(1).max(100).optional(),
  resumeId: z.string().trim().min(1).max(100),
});

/**
 * Run the ATS checks for one of the user's resumes, optionally
 * against one of their job descriptions for keyword coverage.
 * The checks are deterministic and need no AI key.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`ats:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many checks. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = atsSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Choose a resume to check.", 400);
  }

  const result = await runAtsCheck(
    user.id,
    parsed.data.resumeId,
    parsed.data.jobDescriptionId ?? null,
  );
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ report: result.value }, { status: 201 });
}
