import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <Link href="/" className="text-sm text-[var(--color-muted)]">
        CareerCraft
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
      <div className="card mt-6">
        <ResetPasswordForm token={token ?? ""} />
      </div>
    </main>
  );
}
