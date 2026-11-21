"use client";

import { useEffect, useState } from "react";
import {
  SECTION_IDS,
  SECTION_LABELS,
  type ResumeSections,
  type SectionId,
} from "@/lib/resumeData";
import { TEMPLATES, type TemplateId } from "@/lib/resumeTemplates";
import { ResumePreview } from "./ResumePreview";

/**
 * The resume editor: section navigation and forms on the left,
 * live preview on the right (tabs on mobile). Edits stay local
 * until Save is pressed; leaving with unsaved changes triggers the
 * browser's warning. "Improve with AI" buttons rewrite wording
 * only and always show which mode produced the text.
 */

export interface EditorResume {
  enabledSections: SectionId[];
  id: string;
  reviewText: string | null;
  sections: ResumeSections;
  sourceFileName: string | null;
  template: TemplateId;
  title: string;
}

type ImproveKind = "summary" | "experienceBullet" | "projectDescription" | "achievement";

function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        className="field"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  onChange,
  rows = 4,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea
        className="field"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

/** One "Improve with AI" button. Shows the mode label returned by
 * the server (live AI or Demo AI) so demo text is never mistaken
 * for a real model rewrite. */
function ImproveButton({
  kind,
  onImproved,
  resumeId,
  text,
}: {
  kind: ImproveKind;
  onImproved: (text: string) => void;
  resumeId: string;
  text: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`/api/resumes/${resumeId}/improve`, {
        body: JSON.stringify({ kind, text }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        modeLabel?: string;
        text?: string;
      } | null;
      if (!response.ok || !data?.text) {
        setNote(data?.errors?.form ?? "Improve failed. Your text is unchanged.");
        return;
      }
      onImproved(data.text);
      setNote(`Improved by ${data.modeLabel ?? "AI"}. Review before saving.`);
    } catch {
      setNote("Improve failed. Your text is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        className="btn-ghost"
        disabled={busy || !text.trim()}
        onClick={run}
        style={{ padding: "4px 10px", fontSize: 13 }}
        type="button"
      >
        {busy ? "Improving…" : "Improve with AI"}
      </button>
      {note && <span className="text-xs text-[var(--color-muted)]">{note}</span>}
    </span>
  );
}

/** Editable list of bullet lines, each with its own improve button. */
function BulletList({
  bullets,
  kind,
  onChange,
  resumeId,
}: {
  bullets: string[];
  kind: ImproveKind;
  onChange: (bullets: string[]) => void;
  resumeId: string;
}) {
  function updateBullet(index: number, value: string) {
    onChange(bullets.map((b, i) => (i === index ? value : b)));
  }
  return (
    <div className="space-y-2">
      {bullets.map((bullet, index) => (
        <div key={index} className="flex items-start gap-2">
          <input
            aria-label={`Bullet ${index + 1}`}
            className="field"
            onChange={(event) => updateBullet(index, event.target.value)}
            value={bullet}
          />
          <ImproveButton
            kind={kind}
            onImproved={(text) => updateBullet(index, text)}
            resumeId={resumeId}
            text={bullet}
          />
          <button
            aria-label={`Remove bullet ${index + 1}`}
            className="btn-ghost"
            onClick={() => onChange(bullets.filter((_, i) => i !== index))}
            style={{ padding: "4px 10px" }}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="btn-ghost"
        onClick={() => onChange([...bullets, ""])}
        style={{ padding: "4px 10px", fontSize: 13 }}
        type="button"
      >
        Add bullet
      </button>
    </div>
  );
}

function ListField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  return (
    <TextAreaField
      label={`${label} (one per line, or comma-separated)`}
      onChange={(text) =>
        onChange(
          text
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        )
      }
      rows={4}
      value={value.join("\n")}
    />
  );
}

export function ResumeEditor({ initial }: { initial: EditorResume }) {
  const [title, setTitle] = useState(initial.title);
  const [template, setTemplate] = useState<TemplateId>(initial.template);
  const [sections, setSections] = useState<ResumeSections>(initial.sections);
  const [enabled, setEnabled] = useState<SectionId[]>(initial.enabledSections);
  const [activeSection, setActiveSection] = useState<SectionId>("personal");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function markDirty() {
    setDirty(true);
    setSavedNote(null);
  }

  function updateSections(next: ResumeSections) {
    setSections(next);
    markDirty();
  }

  function toggleSection(sectionId: SectionId, on: boolean) {
    setEnabled((current) =>
      on
        ? [...current, sectionId]
        : current.filter((id) => id !== sectionId),
    );
    markDirty();
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/resumes/${initial.id}`, {
        body: JSON.stringify({
          enabledSections: enabled,
          sections,
          template,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
      } | null;
      if (!response.ok) {
        setError(data?.errors?.form ?? "Saving failed. Try again.");
        return false;
      }
      setDirty(false);
      setSavedNote("Saved.");
      return true;
    } catch {
      setError("Saving failed. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (dirty) {
      const ok = await save();
      if (!ok) return;
    }
    window.open(`/api/resumes/${initial.id}/export`, "_blank");
  }

  const personal = sections.personal;

  function sectionForm() {
    switch (activeSection) {
      case "personal":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, fullName: v } })
              }
              value={personal.fullName}
            />
            <Field
              label="Headline"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, headline: v } })
              }
              value={personal.headline}
            />
            <Field
              label="Email"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, email: v } })
              }
              value={personal.email}
            />
            <Field
              label="Phone"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, phone: v } })
              }
              value={personal.phone}
            />
            <Field
              label="Location"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, location: v } })
              }
              value={personal.location}
            />
            <Field
              label="Website"
              onChange={(v) =>
                updateSections({ ...sections, personal: { ...personal, website: v } })
              }
              value={personal.website}
            />
          </div>
        );
      case "summary":
        return (
          <div className="space-y-3">
            <TextAreaField
              label="Professional summary"
              onChange={(v) => updateSections({ ...sections, summary: v })}
              rows={6}
              value={sections.summary}
            />
            <ImproveButton
              kind="summary"
              onImproved={(text) => updateSections({ ...sections, summary: text })}
              resumeId={initial.id}
              text={sections.summary}
            />
          </div>
        );
      case "experience":
        return (
          <div className="space-y-6">
            {sections.experience.map((job, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Job title"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        experience: sections.experience.map((j, i) =>
                          i === index ? { ...j, title: v } : j,
                        ),
                      })
                    }
                    value={job.title}
                  />
                  <Field
                    label="Company"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        experience: sections.experience.map((j, i) =>
                          i === index ? { ...j, company: v } : j,
                        ),
                      })
                    }
                    value={job.company}
                  />
                  <Field
                    label="Start date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        experience: sections.experience.map((j, i) =>
                          i === index ? { ...j, startDate: v } : j,
                        ),
                      })
                    }
                    value={job.startDate}
                  />
                  <Field
                    label="End date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        experience: sections.experience.map((j, i) =>
                          i === index ? { ...j, endDate: v } : j,
                        ),
                      })
                    }
                    value={job.endDate}
                  />
                  <Field
                    label="Location"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        experience: sections.experience.map((j, i) =>
                          i === index ? { ...j, location: v } : j,
                        ),
                      })
                    }
                    value={job.location}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={job.current}
                      onChange={(event) =>
                        updateSections({
                          ...sections,
                          experience: sections.experience.map((j, i) =>
                            i === index ? { ...j, current: event.target.checked } : j,
                          ),
                        })
                      }
                      type="checkbox"
                    />
                    I currently work here
                  </label>
                </div>
                <span className="block text-sm font-medium">Bullet points</span>
                <BulletList
                  bullets={job.bullets}
                  kind="experienceBullet"
                  onChange={(bullets) =>
                    updateSections({
                      ...sections,
                      experience: sections.experience.map((j, i) =>
                        i === index ? { ...j, bullets } : j,
                      ),
                    })
                  }
                  resumeId={initial.id}
                />
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      experience: sections.experience.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove this job
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  experience: [
                    ...sections.experience,
                    {
                      bullets: [],
                      company: "",
                      current: false,
                      endDate: "",
                      location: "",
                      startDate: "",
                      title: "",
                    },
                  ],
                })
              }
              type="button"
            >
              Add job
            </button>
          </div>
        );
      case "education":
        return (
          <div className="space-y-6">
            {sections.education.map((edu, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="School / university"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        education: sections.education.map((e, i) =>
                          i === index ? { ...e, school: v } : e,
                        ),
                      })
                    }
                    value={edu.school}
                  />
                  <Field
                    label="Degree"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        education: sections.education.map((e, i) =>
                          i === index ? { ...e, degree: v } : e,
                        ),
                      })
                    }
                    value={edu.degree}
                  />
                  <Field
                    label="Field of study"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        education: sections.education.map((e, i) =>
                          i === index ? { ...e, field: v } : e,
                        ),
                      })
                    }
                    value={edu.field}
                  />
                  <Field
                    label="Start date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        education: sections.education.map((e, i) =>
                          i === index ? { ...e, startDate: v } : e,
                        ),
                      })
                    }
                    value={edu.startDate}
                  />
                  <Field
                    label="End date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        education: sections.education.map((e, i) =>
                          i === index ? { ...e, endDate: v } : e,
                        ),
                      })
                    }
                    value={edu.endDate}
                  />
                </div>
                <TextAreaField
                  label="Notes"
                  onChange={(v) =>
                    updateSections({
                      ...sections,
                      education: sections.education.map((e, i) =>
                        i === index ? { ...e, notes: v } : e,
                      ),
                    })
                  }
                  rows={3}
                  value={edu.notes}
                />
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      education: sections.education.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove this entry
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  education: [
                    ...sections.education,
                    {
                      degree: "",
                      endDate: "",
                      field: "",
                      notes: "",
                      school: "",
                      startDate: "",
                    },
                  ],
                })
              }
              type="button"
            >
              Add education
            </button>
          </div>
        );
      case "technicalSkills":
        return (
          <ListField
            label="Technical skills"
            onChange={(v) => updateSections({ ...sections, technicalSkills: v })}
            value={sections.technicalSkills}
          />
        );
      case "softSkills":
        return (
          <ListField
            label="Soft skills"
            onChange={(v) => updateSections({ ...sections, softSkills: v })}
            value={sections.softSkills}
          />
        );
      case "projects":
        return (
          <div className="space-y-6">
            {sections.projects.map((project, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Project name"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        projects: sections.projects.map((p, i) =>
                          i === index ? { ...p, name: v } : p,
                        ),
                      })
                    }
                    value={project.name}
                  />
                  <Field
                    label="Tech used"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        projects: sections.projects.map((p, i) =>
                          i === index ? { ...p, tech: v } : p,
                        ),
                      })
                    }
                    value={project.tech}
                  />
                  <Field
                    label="Link"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        projects: sections.projects.map((p, i) =>
                          i === index ? { ...p, link: v } : p,
                        ),
                      })
                    }
                    value={project.link}
                  />
                </div>
                <TextAreaField
                  label="Description"
                  onChange={(v) =>
                    updateSections({
                      ...sections,
                      projects: sections.projects.map((p, i) =>
                        i === index ? { ...p, description: v } : p,
                      ),
                    })
                  }
                  rows={4}
                  value={project.description}
                />
                <ImproveButton
                  kind="projectDescription"
                  onImproved={(text) =>
                    updateSections({
                      ...sections,
                      projects: sections.projects.map((p, i) =>
                        i === index ? { ...p, description: text } : p,
                      ),
                    })
                  }
                  resumeId={initial.id}
                  text={project.description}
                />
                <span className="block text-sm font-medium">Bullet points</span>
                <BulletList
                  bullets={project.bullets}
                  kind="projectDescription"
                  onChange={(bullets) =>
                    updateSections({
                      ...sections,
                      projects: sections.projects.map((p, i) =>
                        i === index ? { ...p, bullets } : p,
                      ),
                    })
                  }
                  resumeId={initial.id}
                />
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      projects: sections.projects.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove this project
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  projects: [
                    ...sections.projects,
                    { bullets: [], description: "", link: "", name: "", tech: "" },
                  ],
                })
              }
              type="button"
            >
              Add project
            </button>
          </div>
        );
      case "certifications":
        return (
          <div className="space-y-6">
            {sections.certifications.map((cert, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Name"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        certifications: sections.certifications.map((c, i) =>
                          i === index ? { ...c, name: v } : c,
                        ),
                      })
                    }
                    value={cert.name}
                  />
                  <Field
                    label="Issuer"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        certifications: sections.certifications.map((c, i) =>
                          i === index ? { ...c, issuer: v } : c,
                        ),
                      })
                    }
                    value={cert.issuer}
                  />
                  <Field
                    label="Date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        certifications: sections.certifications.map((c, i) =>
                          i === index ? { ...c, date: v } : c,
                        ),
                      })
                    }
                    value={cert.date}
                  />
                </div>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      certifications: sections.certifications.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  certifications: [
                    ...sections.certifications,
                    { date: "", issuer: "", name: "" },
                  ],
                })
              }
              type="button"
            >
              Add certification
            </button>
          </div>
        );
      case "languages":
        return (
          <div className="space-y-6">
            {sections.languages.map((lang, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Language"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        languages: sections.languages.map((l, i) =>
                          i === index ? { ...l, name: v } : l,
                        ),
                      })
                    }
                    value={lang.name}
                  />
                  <Field
                    label="Level (e.g. Fluent, B2)"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        languages: sections.languages.map((l, i) =>
                          i === index ? { ...l, level: v } : l,
                        ),
                      })
                    }
                    value={lang.level}
                  />
                </div>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      languages: sections.languages.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  languages: [...sections.languages, { level: "", name: "" }],
                })
              }
              type="button"
            >
              Add language
            </button>
          </div>
        );
      case "achievements":
        return (
          <BulletList
            bullets={sections.achievements}
            kind="achievement"
            onChange={(achievements) =>
              updateSections({ ...sections, achievements })
            }
            resumeId={initial.id}
          />
        );
      case "publications":
        return (
          <div className="space-y-6">
            {sections.publications.map((pub, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Title"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        publications: sections.publications.map((p, i) =>
                          i === index ? { ...p, title: v } : p,
                        ),
                      })
                    }
                    value={pub.title}
                  />
                  <Field
                    label="Publisher"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        publications: sections.publications.map((p, i) =>
                          i === index ? { ...p, publisher: v } : p,
                        ),
                      })
                    }
                    value={pub.publisher}
                  />
                  <Field
                    label="Date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        publications: sections.publications.map((p, i) =>
                          i === index ? { ...p, date: v } : p,
                        ),
                      })
                    }
                    value={pub.date}
                  />
                  <Field
                    label="Link"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        publications: sections.publications.map((p, i) =>
                          i === index ? { ...p, link: v } : p,
                        ),
                      })
                    }
                    value={pub.link}
                  />
                </div>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      publications: sections.publications.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  publications: [
                    ...sections.publications,
                    { date: "", link: "", publisher: "", title: "" },
                  ],
                })
              }
              type="button"
            >
              Add publication
            </button>
          </div>
        );
      case "volunteer":
        return (
          <div className="space-y-6">
            {sections.volunteer.map((item, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Role"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        volunteer: sections.volunteer.map((vol, i) =>
                          i === index ? { ...vol, role: v } : vol,
                        ),
                      })
                    }
                    value={item.role}
                  />
                  <Field
                    label="Organization"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        volunteer: sections.volunteer.map((vol, i) =>
                          i === index ? { ...vol, organization: v } : vol,
                        ),
                      })
                    }
                    value={item.organization}
                  />
                  <Field
                    label="Start date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        volunteer: sections.volunteer.map((vol, i) =>
                          i === index ? { ...vol, startDate: v } : vol,
                        ),
                      })
                    }
                    value={item.startDate}
                  />
                  <Field
                    label="End date"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        volunteer: sections.volunteer.map((vol, i) =>
                          i === index ? { ...vol, endDate: v } : vol,
                        ),
                      })
                    }
                    value={item.endDate}
                  />
                </div>
                <span className="block text-sm font-medium">Bullet points</span>
                <BulletList
                  bullets={item.bullets}
                  kind="experienceBullet"
                  onChange={(bullets) =>
                    updateSections({
                      ...sections,
                      volunteer: sections.volunteer.map((vol, i) =>
                        i === index ? { ...vol, bullets } : vol,
                      ),
                    })
                  }
                  resumeId={initial.id}
                />
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      volunteer: sections.volunteer.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove this entry
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  volunteer: [
                    ...sections.volunteer,
                    {
                      bullets: [],
                      endDate: "",
                      organization: "",
                      role: "",
                      startDate: "",
                    },
                  ],
                })
              }
              type="button"
            >
              Add volunteer experience
            </button>
          </div>
        );
      case "links":
        return (
          <div className="space-y-6">
            {sections.links.map((link, index) => (
              <div className="card space-y-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Label (e.g. GitHub, LinkedIn)"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        links: sections.links.map((l, i) =>
                          i === index ? { ...l, label: v } : l,
                        ),
                      })
                    }
                    value={link.label}
                  />
                  <Field
                    label="URL"
                    onChange={(v) =>
                      updateSections({
                        ...sections,
                        links: sections.links.map((l, i) =>
                          i === index ? { ...l, url: v } : l,
                        ),
                      })
                    }
                    value={link.url}
                  />
                </div>
                <button
                  className="btn-ghost"
                  onClick={() =>
                    updateSections({
                      ...sections,
                      links: sections.links.filter((_, i) => i !== index),
                    })
                  }
                  style={{ padding: "4px 10px", fontSize: 13 }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                updateSections({
                  ...sections,
                  links: [...sections.links, { label: "", url: "" }],
                })
              }
              type="button"
            >
              Add link
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  const formPane = (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Resume sections">
        {SECTION_IDS.map((sectionId) => (
          <button
            aria-selected={activeSection === sectionId}
            className={
              activeSection === sectionId ? "btn-primary" : "btn-ghost"
            }
            key={sectionId}
            onClick={() => setActiveSection(sectionId)}
            role="tab"
            style={{ padding: "6px 12px", fontSize: 13 }}
            type="button"
          >
            {SECTION_LABELS[sectionId]}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          checked={enabled.includes(activeSection)}
          disabled={activeSection === "personal"}
          onChange={(event) => toggleSection(activeSection, event.target.checked)}
          type="checkbox"
        />
        Show “{SECTION_LABELS[activeSection]}” on the resume
        {activeSection === "personal" && " (always shown)"}
      </label>

      <div className="mt-4">{sectionForm()}</div>
    </div>
  );

  const previewPane = (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] shadow-sm">
      <ResumePreview
        enabledSections={enabled}
        sections={sections}
        template={template}
      />
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-52 flex-1">
          <span className="mb-1 block text-sm font-medium">Resume title</span>
          <input
            className="field"
            onChange={(event) => {
              setTitle(event.target.value);
              markDirty();
            }}
            value={title}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Template</span>
          <select
            className="field"
            onChange={(event) => {
              setTemplate(event.target.value as TemplateId);
              markDirty();
            }}
            value={template}
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
          disabled={saving || !dirty}
          onClick={save}
          type="button"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn-ghost" onClick={exportPdf} type="button">
          Export PDF
        </button>
      </div>

      <p className="mt-2 text-sm text-[var(--color-muted)]">
        {TEMPLATES.find((t) => t.id === template)?.description}
      </p>
      {dirty && (
        <p className="mt-1 text-sm font-medium text-[var(--color-note-line)]">
          Unsaved changes
        </p>
      )}
      {savedNote && !dirty && (
        <p className="mt-1 text-sm text-[var(--color-success)]">{savedNote}</p>
      )}
      {error && <p className="error-text mt-2">{error}</p>}
      {initial.sourceFileName && (
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Imported from {initial.sourceFileName}. Check every field before
          using this resume: extraction is best effort.
        </p>
      )}
      {initial.reviewText && (
        <div className="note-box mt-4">
          <p className="font-medium">Text we could not place automatically</p>
          <p className="mt-1 whitespace-pre-wrap">{initial.reviewText}</p>
          <p className="mt-1">
            Copy anything useful into the sections above. Nothing from your
            upload was deleted.
          </p>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="mt-6 flex gap-2 lg:hidden">
        <button
          className={mobileTab === "edit" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMobileTab("edit")}
          style={{ padding: "8px 16px" }}
          type="button"
        >
          Edit
        </button>
        <button
          className={mobileTab === "preview" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMobileTab("preview")}
          style={{ padding: "8px 16px" }}
          type="button"
        >
          Preview
        </button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className={mobileTab === "edit" ? "" : "hidden lg:block"}>{formPane}</div>
        <div className={mobileTab === "preview" ? "" : "hidden lg:block"}>
          {previewPane}
        </div>
      </div>
    </div>
  );
}
