import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { roadmapInputsSchema, toRoadmapInputs } from "@/lib/roadmapData";
import { regenerateRoadmap } from "@/lib/roadmaps";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Regenerate a roadmap from fresh inputs (for example after the
 * user's skills change). The old milestones are replaced. In live
 * mode, an AI failure returns 502 and the stored roadmap is left
 * untouched.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`roadmap-regenerate:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = roadmapInputsSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Enter the role you are aiming for.", 400);
  }

  try {
    const result = await regenerateRoadmap(user.id, id, toRoadmapInputs(parsed.data));
    if (!result.ok) return formError(result.error, 404);
    return NextResponse.json({ roadmap: result.value });
  } catch (error) {
    console.error("Roadmap regeneration failed:", error);
    return formError(
      "The AI service could not be reached, so your roadmap was left unchanged. Try again shortly.",
      502,
    );
  }
}
