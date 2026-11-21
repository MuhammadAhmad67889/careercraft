import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <Link href="/" className="text-sm text-[var(--color-muted)]">
        CareerCraft
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Free to start. No card needed, billing is in demo mode.
      </p>
      <div className="card mt-6">
        <AuthForm mode="signup" />
      </div>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-accent)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
