import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

/** The nine product modules, in build order. Status labels are
 * honest: only the foundation (accounts, onboarding, dashboard)
 * exists today; the rest are labelled with the phase that builds
 * them. No invented metrics, testimonials, or logos anywhere. */
const MODULES = [
  {
    name: "AI Resume Builder",
    text: "Section editor, five templates, PDF export, and AI writing help that improves your words without inventing experience.",
    status: "Phase 2",
  },
  {
    name: "Job Matching",
    text: "Paste a job description and see a transparent compatibility score with matched and missing skills.",
    status: "Phase 3",
  },
  {
    name: "ATS Analyzer",
    text: "Structure, formatting, keyword, and readability checks with prioritized fixes. An estimate, never a pass guarantee.",
    status: "Phase 3",
  },
  {
    name: "Cover Letters",
    text: "Personalized letters from your resume and the job description, in five tones, fully editable.",
    status: "Phase 4",
  },
  {
    name: "Application Tracker",
    text: "A Kanban board from Saved to Offer, with status history and analytics from your real records.",
    status: "Phase 4",
  },
  {
    name: "Interview Prep",
    text: "Mock interviews one question at a time, with feedback on relevance, clarity, and completeness.",
    status: "Phase 5",
  },
  {
    name: "Career Roadmaps",
    text: "Skill gaps, a learning order, and weekly milestones toward your target role.",
    status: "Phase 5",
  },
  {
    name: "LinkedIn Optimizer",
    text: "Paste your profile text and get headline and About-section rewrite suggestions. No scraping, ever.",
    status: "Phase 5",
  },
  {
    name: "Job Search Assistant",
    text: "Save jobs you find, filter by country and work mode, and catch duplicates. No fabricated listings.",
    status: "Phase 5",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    features: [
      "1 active resume",
      "3 job-match analyses / month",
      "2 cover letters / month",
      "Basic ATS checks",
      "Basic application tracking",
    ],
  },
  {
    name: "Pro",
    price: "$9.99 / month",
    features: [
      "Multiple resumes",
      "Higher AI limits",
      "Advanced job analysis",
      "Detailed ATS reports",
      "Interview preparation and roadmaps",
    ],
  },
  {
    name: "Premium",
    price: "$19.99 / month",
    features: [
      "Everything in Pro",
      "Highest AI limits",
      "Advanced mock interviews",
      "Enhanced analytics",
      "Priority processing",
    ],
  },
];

const FAQS = [
  {
    q: "Will the AI invent experience on my resume?",
    a: "No. The AI only rewrites what you provide. If something is missing, it asks or marks it for you to verify, it never fabricates jobs, titles, or metrics.",
  },
  {
    q: "Does a high match score mean I will pass the ATS?",
    a: "No. Scores are transparent estimates based on skills, experience, and keywords. Every employer's ATS behaves differently, so no tool can guarantee a pass.",
  },
  {
    q: "Is billing real yet?",
    a: "Not yet. Plans and limits are enforced in the app, but checkout is in demo mode, no card is charged. Real payments come later, as a separate decision.",
  },
  {
    q: "Who is CareerCraft for?",
    a: "Students, fresh graduates, developers, and remote job seekers, starting with Pakistan and international remote roles. Country-specific CV conventions are respected.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-bold text-[var(--color-accent)]">CareerCraft</span>
        <nav className="flex items-center gap-3 text-sm">
          <a href="#features" className="hidden sm:inline">Features</a>
          <a href="#pricing" className="hidden sm:inline">Pricing</a>
          <a href="#faq" className="hidden sm:inline">FAQ</a>
          {user ? (
            <Link href="/dashboard" className="btn-primary" style={{ padding: "8px 16px" }}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="btn-primary" style={{ padding: "8px 16px" }}>
                Get started free
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="py-14 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Your Entire Career Journey, Powered by AI
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[var(--color-muted)]">
            Build stronger resumes, discover your job compatibility, optimize
            applications, and prepare for interviews, all from one intelligent
            career platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
            ) : (
              <Link href="/signup" className="btn-primary">Get Started Free</Link>
            )}
            <a href="#features" className="btn-ghost">Explore Features</a>
          </div>
          <p className="note-box mt-8 max-w-2xl">
            CareerCraft is in early development. Accounts, onboarding, and the
            dashboard work today; the resume builder and AI tools are being
            built phase by phase. Everything on this page says plainly what
            exists and what is coming.
          </p>
        </section>

        <section id="features" className="py-12">
          <h2 className="text-2xl font-bold">What CareerCraft will do</h2>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Nine modules, built in order. Each one ships when it works end to
            end, not before.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((mod) => (
              <div key={mod.name} className="card">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{mod.name}</h3>
                  <span className="soon-badge">{mod.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{mod.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            <li className="card">
              <p className="font-semibold">1. Tell us where you are</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                A short onboarding captures your experience, target role, and
                preferences. Skip anything, you can finish later.
              </p>
            </li>
            <li className="card">
              <p className="font-semibold">2. Build and check your resume</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Write or upload a resume, then match it against real job
                descriptions and see exactly what to improve.
              </p>
            </li>
            <li className="card">
              <p className="font-semibold">3. Apply and track everything</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Generate cover letters, track each application on a board,
                and prepare for interviews with mock practice.
              </p>
            </li>
          </ol>
        </section>

        <section id="pricing" className="py-12">
          <h2 className="text-2xl font-bold">Pricing</h2>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Plan limits are enforced in the app. Checkout is in demo mode,
            so no real charges until billing launches.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.name} className="card">
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-1 text-2xl font-bold">{plan.price}</p>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="py-12">
          <h2 className="text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((item) => (
              <div key={item.q} className="card">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-line)] py-8 text-sm text-[var(--color-muted)]">
        <p className="font-semibold text-[var(--color-ink)]">CareerCraft</p>
        <p className="mt-1">Build Your Career. One Application at a Time.</p>
        <p className="mt-3">
          Early development build. Scores shown in the app are estimates, not
          guarantees. Demo billing, no real charges.
        </p>
      </footer>
    </div>
  );
}
