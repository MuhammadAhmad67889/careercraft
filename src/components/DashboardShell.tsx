"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

/** Modules that exist in later phases. They render as disabled
 * items with a "coming soon" label — never as links to pages that
 * do not exist yet. Empty for now: every module has a real page. */
const COMING_SOON: string[] = [];

function NavContent({ email }: { email: string }) {
  const pathname = usePathname();
  const linkClass = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)
      ? "block rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 font-medium text-[var(--color-accent-deep)]"
      : "block rounded-lg px-3 py-2 font-medium hover:bg-[var(--color-accent-soft)]";
  return (
    <div className="flex h-full flex-col">
      <p className="text-lg font-bold text-[var(--color-accent)]">CareerCraft</p>
      <nav className="mt-6 space-y-1 text-sm">
        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Dashboard
        </Link>
        <Link href="/resumes" className={linkClass("/resumes")}>
          Resumes
        </Link>
        <Link href="/jobs" className={linkClass("/jobs")}>
          Job matching
        </Link>
        <Link href="/ats" className={linkClass("/ats")}>
          ATS analyzer
        </Link>
        <Link href="/cover-letters" className={linkClass("/cover-letters")}>
          Cover letters
        </Link>
        <Link href="/applications" className={linkClass("/applications")}>
          Applications
        </Link>
        <Link href="/interviews" className={linkClass("/interviews")}>
          Interviews
        </Link>
        <Link href="/roadmaps" className={linkClass("/roadmaps")}>
          Roadmaps
        </Link>
        <Link href="/linkedin" className={linkClass("/linkedin")}>
          LinkedIn optimizer
        </Link>
        <Link href="/job-search" className={linkClass("/job-search")}>
          Job search
        </Link>
        {COMING_SOON.map((item) => (
          <span
            key={item}
            aria-disabled="true"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[var(--color-muted)]"
          >
            {item}
            <span className="soon-badge">soon</span>
          </span>
        ))}
      </nav>
      <div className="mt-auto pt-6">
        <p className="mb-3 truncate text-sm text-[var(--color-muted)]">{email}</p>
        <SignOutButton />
      </div>
    </div>
  );
}

/** App shell: fixed left sidebar on desktop, slide-in drawer on
 * mobile. Page content is server-rendered and passed as children. */
export function DashboardShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--color-line)] bg-[var(--color-card)] p-5 md:block">
        <NavContent email={email} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[var(--color-card)] p-5 shadow-xl">
            <NavContent email={email} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 md:hidden">
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "6px 12px" }}
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            Menu
          </button>
          <span className="font-bold text-[var(--color-accent)]">CareerCraft</span>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
