import type { CSSProperties } from "react";
import {
  SECTION_IDS,
  SECTION_LABELS,
  sectionHasContent,
  type ResumeSections,
  type SectionId,
} from "@/lib/resumeData";
import type { TemplateId } from "@/lib/resumeTemplates";

/**
 * Renders resume data in one of the five templates. Every template
 * is a single column with standard headings in the same order —
 * only typography, colour, and spacing change — so the result
 * stays readable by applicant tracking systems. The same component
 * drives the editor's live preview and the template tests.
 */

/** Document palette. A resume is a printed page, not app chrome,
 * so it carries its own paper/ink tokens instead of the app theme. */
const DOC = {
  ink: "#1f2433",
  muted: "#5d6678",
  paper: "#ffffff",
  rule: "#9ca3af",
} as const;

interface PreviewStyle {
  accent: string;
  bodyFont: string;
  centeredHeader: boolean;
  headingFont: string;
  headingLetterSpacing: string;
  headingSize: number;
  nameSize: number;
  ruleUnderHeadings: boolean;
  sectionGap: number;
}

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function styleFor(template: TemplateId): PreviewStyle {
  switch (template) {
    case "professional":
      return {
        accent: "#333333",
        bodyFont: SERIF,
        centeredHeader: true,
        headingFont: SERIF,
        headingLetterSpacing: "0.04em",
        headingSize: 13,
        nameSize: 24,
        ruleUnderHeadings: false,
        sectionGap: 18,
      };
    case "minimal":
      return {
        accent: "#6b7280",
        bodyFont: SANS,
        centeredHeader: false,
        headingFont: SANS,
        headingLetterSpacing: "0.12em",
        headingSize: 11,
        nameSize: 22,
        ruleUnderHeadings: false,
        sectionGap: 24,
      };
    case "academic":
      return {
        accent: "#262626",
        bodyFont: SERIF,
        centeredHeader: true,
        headingFont: SERIF,
        headingLetterSpacing: "0.03em",
        headingSize: 13,
        nameSize: 22,
        ruleUnderHeadings: true,
        sectionGap: 18,
      };
    case "technical":
      return {
        accent: "#1a5276",
        bodyFont: SANS,
        centeredHeader: false,
        headingFont: MONO,
        headingLetterSpacing: "0.02em",
        headingSize: 12,
        nameSize: 22,
        ruleUnderHeadings: false,
        sectionGap: 16,
      };
    case "modern":
    default:
      return {
        accent: "#4f46e5",
        bodyFont: SANS,
        centeredHeader: false,
        headingFont: SANS,
        headingLetterSpacing: "0.06em",
        headingSize: 12,
        nameSize: 24,
        ruleUnderHeadings: false,
        sectionGap: 18,
      };
  }
}

function dateRange(start: string, end: string, current = false): string {
  const endLabel = current ? "Present" : end;
  if (start && endLabel) return `${start} – ${endLabel}`;
  return start || endLabel;
}

function SectionBlock({
  children,
  sectionId,
  style,
}: {
  children: React.ReactNode;
  sectionId: SectionId;
  style: PreviewStyle;
}) {
  const headingStyle: CSSProperties = {
    borderBottom: style.ruleUnderHeadings ? `1px solid ${DOC.rule}` : undefined,
    color: style.accent,
    fontFamily: style.headingFont,
    fontSize: style.headingSize,
    fontWeight: 700,
    letterSpacing: style.headingLetterSpacing,
    margin: "0 0 8px",
    paddingBottom: style.ruleUnderHeadings ? 4 : 0,
    textTransform: "uppercase",
  };
  return (
    <section style={{ marginTop: style.sectionGap }}>
      <h2 style={headingStyle}>{SECTION_LABELS[sectionId]}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
      {items.map((item, index) => (
        <li key={index} style={{ marginBottom: 2 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionContent({
  sectionId,
  sections,
}: {
  sectionId: SectionId;
  sections: ResumeSections;
}) {
  const muted: CSSProperties = { color: DOC.muted, fontSize: 12 };
  switch (sectionId) {
    case "summary":
      return <p style={{ margin: 0 }}>{sections.summary}</p>;
    case "experience":
      return (
        <>
          {sections.experience.map((job, index) => (
            <div key={index} style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {[job.title, job.company].filter(Boolean).join(" — ")}
              </p>
              <p style={{ ...muted, margin: "2px 0 0" }}>
                {[dateRange(job.startDate, job.endDate, job.current), job.location]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              <Bullets items={job.bullets} />
            </div>
          ))}
        </>
      );
    case "education":
      return (
        <>
          {sections.education.map((edu, index) => (
            <div key={index} style={{ marginBottom: 10 }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {[edu.degree, edu.field].filter(Boolean).join(", ")}
              </p>
              <p style={{ ...muted, margin: "2px 0 0" }}>
                {[edu.school, dateRange(edu.startDate, edu.endDate)]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
              {edu.notes && <p style={{ margin: "4px 0 0" }}>{edu.notes}</p>}
            </div>
          ))}
        </>
      );
    case "technicalSkills":
      return <p style={{ margin: 0 }}>{sections.technicalSkills.join("  ·  ")}</p>;
    case "softSkills":
      return <p style={{ margin: 0 }}>{sections.softSkills.join("  ·  ")}</p>;
    case "projects":
      return (
        <>
          {sections.projects.map((project, index) => (
            <div key={index} style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {[project.name, project.tech].filter(Boolean).join(" — ")}
              </p>
              {project.link && <p style={{ ...muted, margin: "2px 0 0" }}>{project.link}</p>}
              {project.description && (
                <p style={{ margin: "4px 0 0" }}>{project.description}</p>
              )}
              <Bullets items={project.bullets} />
            </div>
          ))}
        </>
      );
    case "certifications":
      return (
        <Bullets
          items={sections.certifications.map((cert) =>
            [cert.name, cert.issuer, cert.date].filter(Boolean).join(" — "),
          )}
        />
      );
    case "languages":
      return (
        <p style={{ margin: 0 }}>
          {sections.languages
            .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
            .join("  ·  ")}
        </p>
      );
    case "achievements":
      return <Bullets items={sections.achievements} />;
    case "publications":
      return (
        <>
          {sections.publications.map((pub, index) => (
            <div key={index} style={{ marginBottom: 6 }}>
              <p style={{ margin: 0 }}>
                {[pub.title, pub.publisher, pub.date].filter(Boolean).join(" — ")}
              </p>
              {pub.link && <p style={{ ...muted, margin: "2px 0 0" }}>{pub.link}</p>}
            </div>
          ))}
        </>
      );
    case "volunteer":
      return (
        <>
          {sections.volunteer.map((item, index) => (
            <div key={index} style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {[item.role, item.organization].filter(Boolean).join(" — ")}
              </p>
              <p style={{ ...muted, margin: "2px 0 0" }}>
                {dateRange(item.startDate, item.endDate)}
              </p>
              <Bullets items={item.bullets} />
            </div>
          ))}
        </>
      );
    case "links":
      return (
        <Bullets
          items={sections.links.map((link) =>
            link.label ? `${link.label}: ${link.url}` : link.url,
          )}
        />
      );
    default:
      return null;
  }
}

export function ResumePreview({
  enabledSections,
  sections,
  template,
}: {
  enabledSections: SectionId[];
  sections: ResumeSections;
  template: TemplateId;
}) {
  const style = styleFor(template);
  const personal = sections.personal;
  const contact = [personal.email, personal.phone, personal.location, personal.website]
    .filter((part) => part.trim().length > 0)
    .join("  ·  ");
  const headerAlign: CSSProperties = style.centeredHeader
    ? { textAlign: "center" }
    : { textAlign: "left" };

  return (
    <article
      style={{
        background: DOC.paper,
        color: DOC.ink,
        fontFamily: style.bodyFont,
        fontSize: 13,
        lineHeight: 1.5,
        padding: "36px 40px",
      }}
    >
      <header style={headerAlign}>
        <h1
          style={{
            fontFamily: style.headingFont,
            fontSize: style.nameSize,
            margin: 0,
          }}
        >
          {personal.fullName || "Your Name"}
        </h1>
        {personal.headline && (
          <p style={{ color: DOC.muted, fontSize: 13, margin: "4px 0 0" }}>
            {personal.headline}
          </p>
        )}
        {contact && (
          <p style={{ color: DOC.muted, fontSize: 11, margin: "4px 0 0" }}>{contact}</p>
        )}
      </header>

      {SECTION_IDS.filter(
        (sectionId) =>
          sectionId !== "personal" &&
          enabledSections.includes(sectionId) &&
          sectionHasContent(sections, sectionId),
      ).map((sectionId) => (
        <SectionBlock key={sectionId} sectionId={sectionId} style={style}>
          <SectionContent sectionId={sectionId} sections={sections} />
        </SectionBlock>
      ))}
    </article>
  );
}
