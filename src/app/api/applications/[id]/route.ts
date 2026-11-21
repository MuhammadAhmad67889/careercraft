import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/apiAuth";
import {
  deleteApplication,
  getApplicationForUser,
  updateApplication,
} from "@/lib/applications";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function formError(message: string, status: number) {
  return NextResponse.json({ errors: { form: message } }, { status });
}

type RouteContext = { params: Promise<{ id: string }> };

/** One application owned by the signed-in user, with its status
 * history. Another user's id simply finds nothing (404). */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const application = await getApplicationForUser(user.id, id);
  if (!application) return formError("Application not found.", 404);
  return NextResponse.json({ application });
}

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .nullable()
  .optional();

const updateSchema = z.object({
  appliedDate: dateString,
  company: z.string().trim().min(1).max(160).optional(),
  coverLetterId: z.string().trim().min(1).max(100).nullable().optional(),
  employmentType: z.string().trim().max(60).optional(),
  interviewDate: dateString,
  interviewNote: z.string().trim().max(500).optional(),
  jobDescriptionId: z.string().trim().min(1).max(100).nullable().optional(),
  jobUrl: z.string().trim().max(500).nullable().optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional(),
  position: z.string().trim().min(1).max(160).optional(),
  recruiterEmail: z.string().trim().max(160).optional(),
  recruiterName: z.string().trim().max(160).optional(),
  resumeId: z.string().trim().min(1).max(100).nullable().optional(),
  salaryRange: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Update an application — field edits from the detail form, or a
 * status-only change from the Kanban board. A status change
 * writes a history row in the data layer; an unknown status is
 * rejected before anything is stored.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (isRateLimited(`application-save:${clientIp(req)}`, 120, 60_000)) {
    return formError("Too many attempts. Try again in a minute.", 429);
  }
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return formError("Some fields are invalid.", 400);
  const data = parsed.data;

  const result = await updateApplication(user.id, id, {
    appliedDate: toDate(data.appliedDate),
    company: data.company,
    coverLetterId: data.coverLetterId,
    employmentType: data.employmentType,
    interviewDate: toDate(data.interviewDate),
    interviewNote: data.interviewNote,
    jobDescriptionId: data.jobDescriptionId,
    jobUrl: data.jobUrl,
    location: data.location,
    notes: data.notes,
    position: data.position,
    recruiterEmail: data.recruiterEmail,
    recruiterName: data.recruiterName,
    resumeId: data.resumeId,
    salaryRange: data.salaryRange,
    status: data.status,
  });
  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return formError(result.error, status);
  }
  return NextResponse.json({ application: result.value });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireUser(req);
  if (!user) return formError("Not signed in.", 401);
  const { id } = await context.params;
  const result = await deleteApplication(user.id, id);
  if (!result.ok) return formError(result.error, 404);
  return NextResponse.json({ ok: true });
}
