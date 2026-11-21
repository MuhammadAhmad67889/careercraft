import type { User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "./auth";
import { userFromCookieValue } from "./session";

/** Resolve the signed-in user for an API route, or null. Routes
 * return 401 on null — the check lives here so every route does
 * it the same way. */
export async function requireUser(req: NextRequest): Promise<User | null> {
  return userFromCookieValue(req.cookies.get(SESSION_COOKIE)?.value);
}
