"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TEMPLATES, templateLabel, type TemplateId } from "@/lib/resumeTemplates";

export interface ResumeListItem {
  id: string;
  sourceFileName: string | null;
  template: string;
  title: string;
  updatedAt: string;
}

/**
 * Resume list with create / upload / rename / duplicate / delete.
 * Plan-limit errors from the server are shown as-is — they already
 * explain the limit and how to get past it.
 */
export function ResumeList({
  atLimit,
  planLabel,
  resumes,
}: {
  atLimit: boolean;
  planLabel: string;
  resumes: ResumeListItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState<TemplateId>("modern");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function callApi(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        resume?: { id: string };
      } | null;
      if (!response.ok) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return false;
      }
      if (data?.resume?.id && init.method === "POST") {
        router.push(`/resumes/${data.resume.id}`);
      } else {
        router.refresh();
      }
      return true;
    } catch {
      setError("Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createResume() {
    if (!newTitle.trim()) {
      setError("Give the resume a title first.");
      return;
    }
    await callApi("/api/resumes", {
      body: JSON.stringify({ template: newTemplate, title: newTitle }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  async function uploadResume(file: File) {
    const form = new FormData();
    form.set("file", file);
    await callApi("/api/resumes/upload", { body: form, method: "POST" });
  }

  async function renameResume(id: string) {
    const ok = await callApi(`/api/resumes/${id}`, {
      body: JSON.stringify({ title: renameValue }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (ok) setRenamingId(null);
  }

  async function deleteResume(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    await callApi(`/api/resumes/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      {error && <p className="error-text mb-4">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Create from scratch</h2>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input
                className="field"
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g. Frontend Developer CV"
                value={newTitle}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Template</span>
              <select
                className="field"
                onChange={(event) =>
                  setNewTemplate(event.target.value as TemplateId)
                }
                value={newTemplate}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-primary"
              disabled={busy || atLimit}
              onClick={createResume}
              type="button"
            >
              Create resume
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Upload an existing resume</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            PDF or DOCX, up to 5 MB. We extract the text into the editor on a
            best-effort basis. Anything we cannot place is kept for your
            review, never deleted.
          </p>
          <input
            accept=".pdf,.docx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadResume(file);
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="btn-ghost mt-3"
            disabled={busy || atLimit}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {busy ? "Working…" : "Choose file"}
          </button>
        </section>
      </div>

      {atLimit && (
        <p className="note-box mt-4">
          You are at your {planLabel} plan limit. Delete a resume below to
          create another, or upgrade your plan.
        </p>
      )}

      <section className="mt-6 space-y-3">
        {resumes.length === 0 ? (
          <div className="card">
            <p className="text-sm text-[var(--color-muted)]">
              No resumes yet. Create one from scratch or upload a PDF/DOCX to
              get started.
            </p>
          </div>
        ) : (
          resumes.map((resume) => (
            <div
              className="card flex flex-wrap items-center gap-3"
              key={resume.id}
            >
              <div className="min-w-0 flex-1">
                {renamingId === resume.id ? (
                  <span className="flex items-center gap-2">
                    <input
                      aria-label="New title"
                      className="field"
                      onChange={(event) => setRenameValue(event.target.value)}
                      value={renameValue}
                    />
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => renameResume(resume.id)}
                      style={{ padding: "6px 12px" }}
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setRenamingId(null)}
                      style={{ padding: "6px 12px" }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <p className="font-semibold">{resume.title}</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {templateLabel(resume.template)} template · Updated{" "}
                      {new Date(resume.updatedAt).toLocaleDateString()}
                      {resume.sourceFileName
                        ? ` · Imported from ${resume.sourceFileName}`
                        : ""}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn-primary" href={`/resumes/${resume.id}`} style={{ padding: "8px 16px" }}>
                  Open editor
                </Link>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setRenamingId(resume.id);
                    setRenameValue(resume.title);
                  }}
                  type="button"
                >
                  Rename
                </button>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    callApi(`/api/resumes/${resume.id}/duplicate`, {
                      method: "POST",
                    })
                  }
                  type="button"
                >
                  Duplicate
                </button>
                <a
                  className="btn-ghost"
                  href={`/api/resumes/${resume.id}/export`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Export PDF
                </a>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => deleteResume(resume.id, resume.title)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
