import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import { createApplication } from "@/lib/applications";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .nullable()
  .optional();

const createSchema = z.object({
  appliedDate: dateString,
  company: z.string().trim().min(1).max(160),
  coverLetterId: z.string().trim().min(1).max(100).nullable().optional(),
  employmentType: z.string().trim().max(60).optional(),
  interviewDate: dateString,
  interviewNote: z.string().trim().max(500).optional(),
  jobDescriptionId: z.string().trim().min(1).max(100).nullable().optional(),
  jobUrl: z.string().trim().max(500).nullable().optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
  position: z.string().trim().min(1).max(160),
  recruiterEmail: z.string().trim().max(160).optional(),
  recruiterName: z.string().trim().max(160).optional(),
  resumeId: z.string().trim().min(1).max(100).nullable().optional(),
  salaryRange: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Create a tracked application. The status is validated in the
 * data layer and the first history row is written with it. */
export async function POST(req: NextRequest) {
  if (isRateLimited(`application-create:${clientIp(req)}`, 60, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return formError("Some fields are invalid. Company and position are required.", 400);
  }
  const data = parsed.data;

  const result = await createApplication(user.id, {
    appliedDate: toDate(data.appliedDate),
    company: data.company,
    coverLetterId: data.coverLetterId ?? null,
    employmentType: data.employmentType,
    interviewDate: toDate(data.interviewDate),
    interviewNote: data.interviewNote,
    jobDescriptionId: data.jobDescriptionId ?? null,
    jobUrl: data.jobUrl ?? null,
    location: data.location,
    notes: data.notes,
    position: data.position,
    recruiterEmail: data.recruiterEmail,
    recruiterName: data.recruiterName,
    resumeId: data.resumeId ?? null,
    salaryRange: data.salaryRange,
    status: data.status,
  });
  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return formError(result.error, status);
  }
  return NextResponse.json({ application: result.value }, { status: 201 });
}
