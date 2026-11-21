import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { DemoLoginButton } from "@/components/DemoLoginButton";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <Link href="/" className="text-sm text-[var(--color-muted)]">
        CareerCraft
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Sign in</h1>
      <div className="card mt-6">
        <AuthForm mode="login" />
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <DemoLoginButton />
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Demo account: demo@example.com / demo-password-123
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        <Link href="/forgot-password" className="text-[var(--color-accent)]">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        New to CareerCraft?{" "}
        <Link href="/signup" className="text-[var(--color-accent)]">
          Create an account
        </Link>
      </p>
    </main>
  );
}
