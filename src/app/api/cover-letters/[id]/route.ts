import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import {
  COVER_LETTER_TONES,
  deleteCoverLetter,
  getCoverLetterForUser,
  updateCoverLetter,
} from "@/lib/coverLetters";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/** One cover letter owned by the signed-in user. Another user's
 * id simply finds nothing (404) — ownership is part of the query. */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const coverLetter = await getCoverLetterForUser(user.id, id);
  if (!coverLetter) return formError("Cover letter not found.", 404);
  return NextResponse.json({ coverLetter });
}

const updateSchema = z.object({
  bodyText: z.string().max(20000).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  tone: z.enum(COVER_LETTER_TONES).optional(),
});

/** Save editor changes. Every save stores a version snapshot in
 * the data layer. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`cover-letter-save:${clientIp(req)}`, 120, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return formError("Some fields are invalid.", 400);

  const result = await updateCoverLetter(user.id, id, {
    bodyText: parsed.data.bodyText,
    title: parsed.data.title,
    tone: parsed.data.tone,
  });
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ coverLetter: result.value });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const result = await deleteCoverLetter(user.id, id);
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ ok: true });
}
