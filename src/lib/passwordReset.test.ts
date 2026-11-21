import { describe, expect, it } from "vitest";
import {
  buildResetToken,
  hashResetToken,
  isResetTokenUsable,
  RESET_TOKEN_TTL_MS,
} from "./passwordReset";

describe("password reset tokens", () => {
  it("builds a token whose hash matches hashResetToken", () => {
    const { token, tokenHash } = buildResetToken();
    expect(token.length).toBe(64);
    expect(hashResetToken(token)).toBe(tokenHash);
  });

  it("expires exactly one hour after creation", () => {
    const now = Date.parse("2026-11-20T00:00:00Z");
    const { expiresAt } = buildResetToken(now);
    expect(expiresAt.getTime() - now).toBe(RESET_TOKEN_TTL_MS);
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("is usable while unused and unexpired", () => {
    const now = Date.now();
    const record = { expiresAt: new Date(now + 60_000), usedAt: null };
    expect(isResetTokenUsable(record, now)).toBe(true);
  });

  it("is not usable after it has been used (single use)", () => {
    const now = Date.now();
    const record = { expiresAt: new Date(now + 60_000), usedAt: new Date(now) };
    expect(isResetTokenUsable(record, now)).toBe(false);
  });

  it("is not usable after expiry", () => {
    const now = Date.now();
    const record = { expiresAt: new Date(now - 1), usedAt: null };
    expect(isResetTokenUsable(record, now)).toBe(false);
  });

  it("different tokens hash differently", () => {
    expect(buildResetToken().tokenHash).not.toBe(buildResetToken().tokenHash);
  });
});
