import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";
import { buildResetToken, hashResetToken, isResetTokenUsable } from "./passwordReset";
import {
  getOrCreateProfile,
  getProfileForUser,
  saveOnboardingStep,
  skipOnboardingStep,
} from "./profile";
import { createSession, destroySession, userFromCookieValue } from "./session";

// Real database, same schema as production. Local dev runs SQLite,
// so the test pushes the committed schema into a throwaway SQLite
// file and deletes it afterwards. On Postgres (Neon) the same test
// would point at a throwaway database instead.
const dbFile = join(tmpdir(), `careercraft_test_${randomBytes(6).toString("hex")}.db`);
const dbUrl = `file:${dbFile}`;
let db: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  process.env.AUTH_SECRET = "test-only-secret-for-isolation-test";
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: join(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
}, 120_000);

afterAll(async () => {
  await db.$disconnect().catch(() => undefined);
  try {
    unlinkSync(dbFile);
  } catch {
    // Already gone — nothing to clean up.
  }
});

async function makeUser(email: string) {
  return db.user.create({
    data: { email, passwordHash: hashPassword("password-123") },
  });
}

describe("profile isolation (real database via Prisma)", () => {
  it("user A cannot read or modify user B's profile", async () => {
    const userA = await makeUser("a@example.com");
    const userB = await makeUser("b@example.com");

    await saveOnboardingStep(
      userB.id,
      0,
      { fullName: "Bee Example", country: "Germany" },
      db,
    );

    // A has no profile yet; asking for A's profile never returns B's.
    expect(await getProfileForUser(userA.id, db)).toBeNull();

    // A saving onboarding writes only A's row.
    await saveOnboardingStep(userA.id, 0, { fullName: "Ay Example" }, db);
    const profileA = await getProfileForUser(userA.id, db);
    const profileB = await getProfileForUser(userB.id, db);
    expect(profileA?.fullName).toBe("Ay Example");
    expect(profileA?.country).toBe("");
    expect(profileB?.fullName).toBe("Bee Example");
    expect(profileB?.country).toBe("Germany");

    // Skipping steps as A does not move B's resume pointer.
    await skipOnboardingStep(userA.id, 1, db);
    const profileBAfter = await getProfileForUser(userB.id, db);
    expect(profileBAfter?.onboardingStep).toBe(1); // B saved step 0 → pointer 1
    expect(profileBAfter?.onboardingDone).toBe(false);
  });

  it("a step can only write its own fields", async () => {
    const user = await makeUser("steps@example.com");
    // Step 0 (personal) must not be able to write step-3 fields.
    const profile = await saveOnboardingStep(
      user.id,
      0,
      { fullName: "Step Tester", technicalSkills: "Should not save" },
      db,
    );
    expect(profile.fullName).toBe("Step Tester");
    expect(profile.technicalSkills).toBe("");
  });

  it("onboarding progress persists and resumes where it left off", async () => {
    const user = await makeUser("resume@example.com");

    let profile = await getOrCreateProfile(user.id, db);
    expect(profile.onboardingStep).toBe(0);
    expect(profile.onboardingDone).toBe(false);

    profile = await saveOnboardingStep(user.id, 0, { fullName: "Resumer" }, db);
    expect(profile.onboardingStep).toBe(1);
    expect(profile.onboardingDone).toBe(false);

    // Re-reading (as a fresh page load would) sees the saved pointer.
    const reread = await getProfileForUser(user.id, db);
    expect(reread?.onboardingStep).toBe(1);
    expect(reread?.fullName).toBe("Resumer");

    // Skipping the middle steps and saving the last one finishes.
    await skipOnboardingStep(user.id, 1, db);
    await skipOnboardingStep(user.id, 2, db);
    profile = await saveOnboardingStep(
      user.id,
      3,
      { technicalSkills: "React, TypeScript" },
      db,
    );
    expect(profile.onboardingDone).toBe(true);
    expect(profile.technicalSkills).toBe("React, TypeScript");
    // Earlier fields survive later saves.
    expect(profile.fullName).toBe("Resumer");
  });

  it("getOrCreateProfile is idempotent (one profile per user)", async () => {
    const user = await makeUser("once@example.com");
    const first = await getOrCreateProfile(user.id, db);
    const second = await getOrCreateProfile(user.id, db);
    expect(second.id).toBe(first.id);
    expect(await db.userProfile.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("sessions (real database via Prisma)", () => {
  it("a cookie resolves to its user; tampering, expiry, and logout do not", async () => {
    const user = await makeUser("session@example.com");
    const { cookieValue, sessionId } = await createSession(user.id, db);

    const resolved = await userFromCookieValue(cookieValue, db);
    expect(resolved?.id).toBe(user.id);

    // Tampered signature → null.
    const dot = cookieValue.lastIndexOf(".");
    const tampered = `${cookieValue.slice(0, dot + 1)}${"0".repeat(64)}`;
    expect(await userFromCookieValue(tampered, db)).toBeNull();

    // Expired session → null.
    await db.session.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { id: sessionId },
    });
    expect(await userFromCookieValue(cookieValue, db)).toBeNull();

    // After logout (session destroyed) the cookie is dead.
    const fresh = await createSession(user.id, db);
    await destroySession(fresh.cookieValue, db);
    expect(await userFromCookieValue(fresh.cookieValue, db)).toBeNull();
  });

  it("one user's session cookie never resolves to another user", async () => {
    const userA = await makeUser("cookie-a@example.com");
    const userB = await makeUser("cookie-b@example.com");
    const sessionA = await createSession(userA.id, db);
    const resolved = await userFromCookieValue(sessionA.cookieValue, db);
    expect(resolved?.id).toBe(userA.id);
    expect(resolved?.id).not.toBe(userB.id);
  });
});

describe("password reset flow (real database via Prisma)", () => {
  it("a reset token works once, then cannot be reused", async () => {
    const user = await makeUser("reset@example.com");
    const { expiresAt, token, tokenHash } = buildResetToken();
    await db.passwordResetToken.create({
      data: { expiresAt, tokenHash, userId: user.id },
    });

    // Look the token up the way the route does.
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
    });
    expect(record).not.toBeNull();
    expect(isResetTokenUsable(record!)).toBe(true);

    // Consume it: change the password, mark used, kill sessions.
    await db.user.update({
      data: { passwordHash: hashPassword("new-password-456") },
      where: { id: user.id },
    });
    await db.passwordResetToken.update({
      data: { usedAt: new Date() },
      where: { id: record!.id },
    });

    const after = await db.passwordResetToken.findUnique({
      where: { id: record!.id },
    });
    expect(isResetTokenUsable(after!)).toBe(false);

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(verifyPassword("new-password-456", updated!.passwordHash)).toBe(true);
    expect(verifyPassword("password-123", updated!.passwordHash)).toBe(false);
  });
});
