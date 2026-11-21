import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { duplicateResume } from "@/lib/resumes";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Duplicate a resume. A copy counts as a new resume, so the plan
 * limit applies (enforced in the data layer). */
export async function POST(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`resumes:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json(
      { errors: { form: "Too many attempts. Try again in a minute." } },
      { status: 429 },
    );
  }
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json(
      { errors: { form: "Not signed in." } },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const result = await duplicateResume(user.id, id);
  if (!result.ok) {
    const status = result.error === "Resume not found." ? 404 : 403;
    return NextResponse.json({ errors: { form: result.error } }, { status });
  }
  return NextResponse.json({ resume: result.value }, { status: 201 });
}
