import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { mergeDuplicateJobs } from "@/lib/jobSearch";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const mergeSchema = z.object({
  keepId: z.string().trim().min(1).max(100),
  removeId: z.string().trim().min(1).max(100),
});

/**
 * Merge two saved jobs into one. Linked records (analyses, ATS
 * reports, cover letters, applications, interview sessions) move
 * to the kept job in the data layer before the other copy is
 * deleted. Both jobs must belong to the user.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`job-search:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) return formError("Send the two job ids.", 400);

  const result = await mergeDuplicateJobs(
    user.id,
    parsed.data.keepId,
    parsed.data.removeId,
  );
  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return formError(result.error, status);
  }
  return NextResponse.json({ job: result.value });
}
