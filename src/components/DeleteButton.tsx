"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Small delete button for detail pages. Asks for confirmation
 * first, deletes through the given API endpoint, then returns to
 * the list page.
 */
export function DeleteButton({
  endpoint,
  label,
  redirectTo,
}: {
  endpoint: string;
  label: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this permanently?")) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          errors?: { form?: string };
        } | null;
        setError(data?.errors?.form ?? "Could not delete. Try again.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Could not delete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        className="btn-ghost"
        disabled={busy}
        onClick={remove}
        type="button"
      >
        {busy ? "Deleting…" : label}
      </button>
      {error && <span className="error-text ml-2">{error}</span>}
    </span>
  );
}
