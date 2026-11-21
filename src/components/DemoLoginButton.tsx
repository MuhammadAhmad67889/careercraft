"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Signs in with the seeded demo account so visitors can look
 * around without creating an account. The demo account is created
 * by `npm run db:seed`; if it is missing, the normal login error
 * is shown. */
export function DemoLoginButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email: "demo@example.com",
          password: "demo-password-123",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        setError("Demo login is not available right now.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn-ghost w-full" onClick={onClick} disabled={busy}>
        {busy ? "Please wait…" : "Try the demo"}
      </button>
      {error && <p className="error-text mt-2">{error}</p>}
    </div>
  );
}
