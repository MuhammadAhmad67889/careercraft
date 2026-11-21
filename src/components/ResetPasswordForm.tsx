"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Set a new password using the token from the reset email link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/auth/reset-password", {
        body: JSON.stringify({ password, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        errors?: Record<string, string>;
      };
      if (!res.ok) {
        setErrors(data.errors ?? { form: "Something went wrong. Try again." });
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch {
      setErrors({ form: "Could not reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        This page needs the reset link from your email.{" "}
        <Link href="/forgot-password" className="text-[var(--color-accent)]">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Password updated. Taking you to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          type="password"
          className="field"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {errors.password && <p className="error-text mt-1">{errors.password}</p>}
      </div>
      {errors.form && <p className="error-text">{errors.form}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : "Set new password"}
      </button>
    </form>
  );
}
