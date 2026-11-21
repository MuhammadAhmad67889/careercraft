import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { deleteLinkedInAnalysis } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/** Delete one LinkedIn analysis owned by the signed-in user. */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const result = await deleteLinkedInAnalysis(user.id, id);
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ ok: true });
}
