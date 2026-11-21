import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { createJobDescription, listJobDescriptions } from "@/lib/jobs";
import { fetchJobTextFromUrl, JobImportError } from "@/lib/jobParse";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

/** List the signed-in user's saved job descriptions. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const jobs = await listJobDescriptions(user.id);
  return NextResponse.json({ jobs });
}

const createSchema = z.object({
  company: z.string().trim().max(160).default(""),
  location: z.string().trim().max(160).default(""),
  // Paste is the reliable path; url is best-effort import.
  text: z.string().trim().max(30_000).optional(),
  title: z.string().trim().max(160).default(""),
  url: z.string().trim().max(2000).optional(),
});

/**
 * Save a job description from pasted text or a posting URL. URL
 * import is best-effort: when the page cannot be read, the error
 * says so plainly and points at the paste option — a failed
 * import is never dressed up as success. In live mode, a parse
 * failure returns 502 and nothing is saved.
 */
export async function POST(req: NextRequest) {
  if (isRateLimited(`jobs:${clientIp(req)}`, 30, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Send a title, company, and the job description text (or a URL).", 400);
  }

  let rawText = parsed.data.text ?? "";
  let title = parsed.data.title;
  let sourceUrl: string | null = null;

  if (!rawText && parsed.data.url) {
    try {
      const imported = await fetchJobTextFromUrl(parsed.data.url);
      rawText = imported.text;
      sourceUrl = parsed.data.url;
      if (!title && imported.title) title = imported.title.slice(0, 160);
    } catch (error) {
      if (error instanceof JobImportError) {
        return formError(error.message, 400);
      }
      console.error("Job URL import failed:", error);
      return formError(
        "We could not import that page. Paste the job description text instead.",
        400,
      );
    }
  }
  if (!rawText) {
    return formError("Paste the job description text, or give a posting URL to import.", 400);
  }

  try {
    const result = await createJobDescription(user.id, {
      company: parsed.data.company,
      location: parsed.data.location,
      rawText,
      sourceUrl,
      title,
    });
    if (!result.ok) return formError(result.error, 400);
    return NextResponse.json({ job: result.value }, { status: 201 });
  } catch (error) {
    // Live-mode parse failure: loud, nothing saved.
    console.error("Job description parse failed:", error);
    return formError(
      "The AI service could not parse that job description. Nothing was saved — try again shortly.",
      502,
    );
  }
}
