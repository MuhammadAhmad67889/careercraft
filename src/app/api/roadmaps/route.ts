import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { roadmapInputsSchema, toRoadmapInputs } from "@/lib/roadmapData";
import { createRoadmap } from "@/lib/roadmaps";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

/**
 * Create a career roadmap (study plan). The active-roadmap plan
 * limit is enforced in the data layer (403 with a clear message).
 * In live mode, an AI failure returns 502 and nothing is saved.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`roadmap-create:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = roadmapInputsSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Enter the role you are aiming for.", 400);
  }

  try {
    const result = await createRoadmap(user.id, toRoadmapInputs(parsed.data));
    if (!result.ok) return formError(result.error, 403);
    return NextResponse.json({ roadmap: result.value }, { status: 201 });
  } catch (error) {
    console.error("Roadmap creation failed:", error);
    return formError(
      "The AI service could not be reached, so no roadmap was saved. Try again shortly.",
      502,
    );
  }
}
