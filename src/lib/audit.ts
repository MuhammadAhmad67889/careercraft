import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma";

/** Record a security-relevant event. Failures here must never break
 * the request that triggered them, so errors are swallowed after a
 * console note. Details must never contain passwords or tokens. */
export async function logAudit(
  action: string,
  userId: string | null,
  detail?: string,
  db: PrismaClient = getPrisma(),
): Promise<void> {
  try {
    await db.auditLog.create({
      data: { action, detail: detail ?? null, userId },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
