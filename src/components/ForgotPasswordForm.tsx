"use client";

import { useState } from "react";

/** Request a password-reset link. The server always answers the
 * same way, so the message here never reveals whether the email
 * has an account. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          errors?: Record<string, string>;
        };
        setError(data.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        If that email has an account, a reset link is on its way. It works
        for one hour. In local development (no email configured), the link
        is printed to the server console.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="field"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : "Send reset link"}
      </button>
    </form>
  );
}
