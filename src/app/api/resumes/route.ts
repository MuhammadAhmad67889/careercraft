import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { createResume, listResumes } from "@/lib/resumes";
import { isTemplateId } from "@/lib/resumeTemplates";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

/** List the signed-in user's resumes. The user id comes from the
 * session cookie, never from the request. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const resumes = await listResumes(user.id);
  return NextResponse.json({ resumes });
}

const createSchema = z.object({
  template: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1).max(120),
});

/** Create a blank resume. The plan limit is enforced in the data
 * layer; hitting it returns 403 with a clear message. */
export async function POST(req: NextRequest) {
  if (isRateLimited(`resumes:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Give the resume a title (up to 120 characters).", 400);
  }
  const template =
    parsed.data.template && isTemplateId(parsed.data.template)
      ? parsed.data.template
      : "modern";

  const result = await createResume(user.id, {
    template,
    title: parsed.data.title,
  });
  if (!result.ok) return formError(result.error, 403);
  return NextResponse.json({ resume: result.value }, { status: 201 });
}
