import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { setMilestoneDone } from "@/lib/roadmaps";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = {
  params: Promise<{ id: string; milestoneId: string }>;
};

const toggleSchema = z.object({ done: z.boolean() });

/** Mark one roadmap milestone done or not done. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`milestone-toggle:${clientIp(req)}`, 120, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id, milestoneId } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return formError("Invalid request.", 400);

  const result = await setMilestoneDone(user.id, id, milestoneId, parsed.data.done);
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ roadmap: result.value });
}
