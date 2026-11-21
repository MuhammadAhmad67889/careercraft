import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <Link href="/" className="text-sm text-[var(--color-muted)]">
        CareerCraft
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Enter your account email and we will send a reset link.
      </p>
      <div className="card mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Remembered it?{" "}
        <Link href="/login" className="text-[var(--color-accent)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
