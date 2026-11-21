import type { PrismaClient, Resume } from "@prisma/client";
import { planOf, resumeLimitMessage } from "./plans";
import { getPrisma } from "./prisma";
import {
  DEFAULT_ENABLED_SECTIONS,
  emptyResumeSections,
  enabledToString,
  parseSections,
  serializeSections,
  stringToEnabled,
  type ResumeSections,
  type SectionId,
} from "./resumeData";
import { isTemplateId, type TemplateId } from "./resumeTemplates";

/**
 * Resume persistence. Every function takes the user id and scopes
 * its queries by it — a resume id alone is never enough to reach a
 * row, so one user cannot read, edit, or delete another's resume.
 * The isolation tests prove this against a real database.
 */

export type ResumeResult<T> = { ok: true; value: T } | { error: string; ok: false };

/** A resume with its sections parsed and validated, ready for the
 * editor, templates, and the PDF exporter. */
export interface ResumeView {
  createdAt: Date;
  enabledSections: SectionId[];
  id: string;
  reviewText: string | null;
  sections: ResumeSections;
  sourceFileName: string | null;
  template: TemplateId;
  title: string;
  updatedAt: Date;
}

export function toResumeView(resume: Resume): ResumeView {
  return {
    createdAt: resume.createdAt,
    enabledSections: stringToEnabled(resume.enabledSections),
    id: resume.id,
    reviewText: resume.reviewText,
    sections: parseSections(resume.sectionsJson),
    sourceFileName: resume.sourceFileName,
    template: isTemplateId(resume.template) ? resume.template : "modern",
    title: resume.title,
    updatedAt: resume.updatedAt,
  };
}

export async function listResumes(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<ResumeView[]> {
  const rows = await db.resume.findMany({
    orderBy: { updatedAt: "desc" },
    where: { userId },
  });
  return rows.map(toResumeView);
}

export async function countResumes(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<number> {
  return db.resume.count({ where: { userId } });
}

/** Fetch one resume owned by this user, or null. The userId filter
 * is part of the query, so another user's id simply finds nothing. */
export async function getResumeForUser(
  userId: string,
  resumeId: string,
  db: PrismaClient = getPrisma(),
): Promise<ResumeView | null> {
  const row = await db.resume.findFirst({ where: { id: resumeId, userId } });
  return row ? toResumeView(row) : null;
}

async function recordUsage(
  userId: string,
  kind: string,
  detail: string,
  db: PrismaClient,
): Promise<void> {
  await db.usageRecord.create({ data: { detail, kind, userId } });
}

/** Check the plan limit before creating another resume. Returns an
 * error message when the user is at their limit, else null. */
async function resumeLimitError(
  userId: string,
  db: PrismaClient,
): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return "User not found.";
  const plan = planOf(user.plan);
  const count = await db.resume.count({ where: { userId } });
  if (count >= plan.maxResumes) return resumeLimitMessage(user.plan);
  return null;
}

export interface CreateResumeInput {
  enabledSections?: SectionId[];
  reviewText?: string | null;
  sections?: ResumeSections;
  sourceFileName?: string | null;
  template?: TemplateId;
  title: string;
}

export async function createResume(
  userId: string,
  input: CreateResumeInput,
  db: PrismaClient = getPrisma(),
): Promise<ResumeResult<ResumeView>> {
  const limitError = await resumeLimitError(userId, db);
  if (limitError) return { error: limitError, ok: false };

  const title = input.title.trim() || "Untitled resume";
  const row = await db.resume.create({
    data: {
      enabledSections: enabledToString(
        input.enabledSections ?? DEFAULT_ENABLED_SECTIONS,
      ),
      reviewText: input.reviewText ?? null,
      sectionsJson: serializeSections(input.sections ?? emptyResumeSections()),
      sourceFileName: input.sourceFileName ?? null,
      template: input.template ?? "modern",
      title,
      userId,
    },
  });
  await recordUsage(userId, "resume_create", row.id, db);
  return { ok: true, value: toResumeView(row) };
}

export interface UpdateResumeInput {
  enabledSections?: SectionId[];
  sections?: ResumeSections;
  template?: TemplateId;
  title?: string;
}

/** Save edits. Every save stores a version snapshot first, so the
 * previous state can be recovered. */
export async function updateResume(
  userId: string,
  resumeId: string,
  input: UpdateResumeInput,
  db: PrismaClient = getPrisma(),
): Promise<ResumeResult<ResumeView>> {
  const existing = await db.resume.findFirst({ where: { id: resumeId, userId } });
  if (!existing) return { error: "Resume not found.", ok: false };

  await snapshotResume(existing, "save", db);

  const row = await db.resume.update({
    data: {
      ...(input.enabledSections !== undefined
        ? { enabledSections: enabledToString(input.enabledSections) }
        : {}),
      ...(input.sections !== undefined
        ? { sectionsJson: serializeSections(input.sections) }
        : {}),
      ...(input.template !== undefined ? { template: input.template } : {}),
      ...(input.title !== undefined
        ? { title: input.title.trim() || existing.title }
        : {}),
    },
    where: { id: existing.id },
  });
  return { ok: true, value: toResumeView(row) };
}

/** Rename only — no snapshot needed for a title change. */
export async function renameResume(
  userId: string,
  resumeId: string,
  title: string,
  db: PrismaClient = getPrisma(),
): Promise<ResumeResult<ResumeView>> {
  const existing = await db.resume.findFirst({ where: { id: resumeId, userId } });
  if (!existing) return { error: "Resume not found.", ok: false };
  const row = await db.resume.update({
    data: { title: title.trim() || existing.title },
    where: { id: existing.id },
  });
  return { ok: true, value: toResumeView(row) };
}

/** Duplicate counts as a new resume, so the plan limit applies. */
export async function duplicateResume(
  userId: string,
  resumeId: string,
  db: PrismaClient = getPrisma(),
): Promise<ResumeResult<ResumeView>> {
  const existing = await db.resume.findFirst({ where: { id: resumeId, userId } });
  if (!existing) return { error: "Resume not found.", ok: false };

  const limitError = await resumeLimitError(userId, db);
  if (limitError) return { error: limitError, ok: false };

  const row = await db.resume.create({
    data: {
      enabledSections: existing.enabledSections,
      reviewText: existing.reviewText,
      sectionsJson: existing.sectionsJson,
      sourceFileName: existing.sourceFileName,
      template: existing.template,
      title: `${existing.title} (copy)`,
      userId,
    },
  });
  await recordUsage(userId, "resume_duplicate", row.id, db);
  return { ok: true, value: toResumeView(row) };
}

export async function deleteResume(
  userId: string,
  resumeId: string,
  db: PrismaClient = getPrisma(),
): Promise<ResumeResult<true>> {
  const result = await db.resume.deleteMany({ where: { id: resumeId, userId } });
  if (result.count === 0) return { error: "Resume not found.", ok: false };
  await recordUsage(userId, "resume_delete", resumeId, db);
  return { ok: true, value: true };
}

/** Store a full snapshot of a resume row. Called on save and on
 * PDF export. */
export async function snapshotResume(
  resume: Resume,
  reason: "save" | "export",
  db: PrismaClient = getPrisma(),
): Promise<void> {
  await db.resumeVersion.create({
    data: {
      reason,
      resumeId: resume.id,
      snapshotJson: JSON.stringify({
        enabledSections: resume.enabledSections,
        sectionsJson: resume.sectionsJson,
        template: resume.template,
        title: resume.title,
      }),
      userId: resume.userId,
    },
  });
}

/** Snapshot by id (used by the export route after ownership check). */
export async function snapshotResumeById(
  userId: string,
  resumeId: string,
  reason: "save" | "export",
  db: PrismaClient = getPrisma(),
): Promise<boolean> {
  const row = await db.resume.findFirst({ where: { id: resumeId, userId } });
  if (!row) return false;
  await snapshotResume(row, reason, db);
  return true;
}
