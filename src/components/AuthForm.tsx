"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Errors = Record<string, string>;

/** Shared sign-in / sign-up form. Posts JSON to the auth API and
 * shows the server's field errors next to the fields. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        body: JSON.stringify(
          mode === "signup" ? { email, name, password } : { email, password },
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { errors?: Errors };
      if (!res.ok) {
        setErrors(data.errors ?? { form: "Something went wrong. Try again." });
        return;
      }
      // New accounts go to onboarding; returning users to the
      // dashboard (which itself redirects to onboarding if unfinished).
      router.push(mode === "signup" ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch {
      setErrors({ form: "Could not reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === "signup" && (
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Your name (optional)
          </label>
          <input
            id="name"
            className="field"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      )}
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
        {errors.email && <p className="error-text mt-1">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="field"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {errors.password && <p className="error-text mt-1">{errors.password}</p>}
      </div>
      {errors.form && <p className="error-text">{errors.form}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
