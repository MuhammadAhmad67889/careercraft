# CareerCraft

An AI career platform for job seekers: build a resume, match it against a job
description with a transparent score breakdown, check ATS compatibility, generate
cover letters, track applications, search your saved jobs, practise interviews,
plan a roadmap, and improve a LinkedIn profile.

Live demo: link will be added here once deployed.

## Demo login

After seeding (see below), sign in with the demo account:

- Email: `demo@example.com`
- Password: `demo-password-123`

The demo profile is a clearly fictional sample person. This is a published demo
credential for the seeded account only — never reuse it anywhere else.

## What it does

- **Resume builder** — section editor, 5 templates, PDF/DOCX upload with
  extraction, per-field AI improve, PDF export, version snapshots. AI never
  invents experience; missing info is flagged, not filled in.
- **Job matching** — paste a job description (or import from a URL, best
  effort), get a labelled match *estimate* with a full breakdown (skills,
  experience, responsibilities, education). Never presented as a real ATS
  ranking or hire probability.
- **ATS analyzer** — structure, formatting, keyword and content checks with
  prioritized fixes. Scores are estimates, never a pass guarantee.
- **Cover letters** — 5 tones, written only from your real resume facts, with
  an editor, version snapshots, and PDF export.
- **Application tracker** — Kanban board with status history and analytics
  computed from your own records.
- **Job search** — search and filter the jobs you saved (by text, company,
  location, and match score), with duplicate detection that flags likely
  duplicate postings and lets you merge or dismiss them. No scraping — only
  jobs you saved yourself.
- **Mock interviews** — five practice types with per-answer feedback. Practice
  guidance only; it never claims to measure personality or employability.
- **Career roadmaps** — a study plan from your current role toward a target
  role, with week-by-week steps you can tick off. A study plan only — it never
  promises employment.
- **LinkedIn optimizer** — paste in your own profile text and get checks and
  suggestions built only from what you pasted. No scraping, no account access.

## Honest status

AI features run in a clearly labelled **Demo AI** mode until a free Groq key is
added (`LLM_API_KEY`). In demo mode, AI-labelled features use built-in rules and
templates built from your own data — the UI says so wherever it applies. With a
key set, live model failures are shown as errors; the app never silently falls
back to demo text. Billing is demo-only: plan limits are enforced server-side,
but no real charges happen.

## Stack

Next.js 16 + TypeScript (strict), Prisma 6 + Postgres (Neon in production,
SQLite for local dev and tests), own auth (scrypt password hashing + signed
session cookie), Tailwind CSS v4, Vitest (148 tests), GitHub Actions CI.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in AUTH_SECRET (openssl rand -hex 32)
```

The committed Prisma schema targets Postgres. For local dev with a SQLite
file, change the `provider` line in `prisma/schema.prisma` from
`"postgresql"` to `"sqlite"` (the test suite does the same swap in CI), then:

```bash
npm run db:push
npm run db:seed
npm run dev
```

## Tests

```bash
npm test        # Vitest — DB tests use throwaway SQLite files
npm run lint
npm run typecheck
```

In CI the Prisma provider is swapped to SQLite before tests run, since the
test suite pushes the schema into temporary SQLite files. Production keeps
the committed `postgresql` provider.
