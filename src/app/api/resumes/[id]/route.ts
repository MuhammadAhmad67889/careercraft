import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import {
  validateEnabledSections,
  validateSections,
} from "@/lib/resumeData";
import { isTemplateId } from "@/lib/resumeTemplates";
import { deleteResume, getResumeForUser, updateResume } from "@/lib/resumes";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/** One resume owned by the signed-in user. Another user's id
 * simply finds nothing (404) — ownership is part of the query. */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const resume = await getResumeForUser(user.id, id);
  if (!resume) return formError("Resume not found.", 404);
  return NextResponse.json({ resume });
}

const updateSchema = z.object({
  enabledSections: z.unknown().optional(),
  sections: z.unknown().optional(),
  template: z.string().trim().max(40).optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

/** Save editor changes. Sections and the enabled list are
 * validated with Zod before anything is written; every save
 * stores a version snapshot in the data layer. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`resume-save:${clientIp(req)}`, 120, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return formError("Some fields are invalid.", 400);

  let sections;
  if (parsed.data.sections !== undefined) {
    sections = validateSections(parsed.data.sections);
    if (!sections) return formError("Resume content is invalid.", 400);
  }
  let enabledSections;
  if (parsed.data.enabledSections !== undefined) {
    enabledSections = validateEnabledSections(parsed.data.enabledSections);
    if (!enabledSections) return formError("Section list is invalid.", 400);
  }
  const template =
    parsed.data.template !== undefined
      ? isTemplateId(parsed.data.template)
        ? parsed.data.template
        : undefined
      : undefined;
  if (parsed.data.template !== undefined && template === undefined) {
    return formError("Unknown template.", 400);
  }

  const result = await updateResume(user.id, id, {
    enabledSections,
    sections,
    template,
    title: parsed.data.title,
  });
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ resume: result.value });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const result = await deleteResume(user.id, id);
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ ok: true });
}
