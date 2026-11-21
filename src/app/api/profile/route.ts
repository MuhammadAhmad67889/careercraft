import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import {
  getOrCreateProfile,
  LAST_STEP,
  onboardingFieldsSchema,
  saveOnboardingStep,
  skipOnboardingStep,
} from "@/lib/profile";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** The signed-in user's own profile. The user id comes from the
 * session cookie, never from the request, so there is no way to
 * ask for someone else's profile. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json(
      { errors: { form: "Not signed in." } },
      { status: 401 },
    );
  }
  const profile = await getOrCreateProfile(user.id);
  return NextResponse.json({ profile });
}

/** Save or skip one onboarding step.
 * Body: { step: number, fields?: {...} } — omit fields (or send
 * skip: true) to skip the step without writing anything. */
export async function PATCH(req: NextRequest) {
  if (isRateLimited(`profile:${clientIp(req)}`, 60, 60_000)) {
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

  const body = (await req.json().catch(() => null)) as {
    fields?: unknown;
    skip?: unknown;
    step?: unknown;
  } | null;
  const step = typeof body?.step === "number" ? body.step : -1;
  if (!Number.isInteger(step) || step < 0 || step > LAST_STEP) {
    return NextResponse.json(
      { errors: { form: "Invalid onboarding step." } },
      { status: 400 },
    );
  }

  if (body?.skip === true) {
    const profile = await skipOnboardingStep(user.id, step);
    return NextResponse.json({ profile });
  }

  const parsed = onboardingFieldsSchema.safeParse(body?.fields ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { form: "Some fields are invalid. Check and try again." } },
      { status: 400 },
    );
  }
  const profile = await saveOnboardingStep(user.id, step, parsed.data);
  return NextResponse.json({ profile });
}
