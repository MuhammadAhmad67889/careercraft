import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { hashPassword, normalizeEmail, validateCredentials } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/profile";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  if (isRateLimited(`signup:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json(
      { errors: { form: "Too many attempts. Try again in a minute." } },
      { status: 429 },
    );
  }
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    name?: unknown;
    password?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  const errors = validateCredentials({ email, password });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const db = getPrisma();
  const normalized = normalizeEmail(email);
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json(
      { errors: { email: "Could not create an account with that email." } },
      { status: 400 },
    );
  }

  let userId: string | null = null;
  try {
    const user = await db.user.create({
      data: {
        email: normalized,
        name: name || null,
        passwordHash: hashPassword(password),
      },
    });
    userId = user.id;
    // Every account starts with an empty profile; onboarding fills it.
    await getOrCreateProfile(user.id, db);
    const { cookieValue } = await createSession(user.id, db);
    await logAudit("signup", user.id, undefined, db);
    const res = NextResponse.json({ email: user.email, ok: true }, { status: 201 });
    setSessionCookie(res, cookieValue);
    return res;
  } catch (err) {
    // If setup failed after the user row was created, remove it again
    // so a retry can succeed instead of hitting "email already taken"
    // for an account that never got set up.
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { errors: { email: "Could not create an account with that email." } },
        { status: 400 },
      );
    }
    console.error("signup failed", err);
    return NextResponse.json(
      { errors: { form: "Something went wrong. Try again." } },
      { status: 500 },
    );
  }
}
