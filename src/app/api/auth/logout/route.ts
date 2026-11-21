import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { SESSION_COOKIE } from "@/lib/auth";
import { clearSessionCookie, destroySession, userFromCookieValue } from "@/lib/session";

export async function POST(req: NextRequest) {
  const cookieValue = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await userFromCookieValue(cookieValue);
  await destroySession(cookieValue);
  if (user) await logAudit("logout", user.id);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
