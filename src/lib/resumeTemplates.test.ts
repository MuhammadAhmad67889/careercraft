import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResumePreview } from "@/components/ResumePreview";
import { emptyResumeSections, type ResumeSections } from "./resumeData";
import { TEMPLATE_IDS } from "./resumeTemplates";

function sampleSections(): ResumeSections {
  const sections = emptyResumeSections();
  sections.personal.fullName = "Sara Khan";
  sections.personal.headline = "Frontend Developer";
  sections.personal.email = "sara@example.com";
  sections.summary = "Frontend developer who builds React apps.";
  sections.experience = [
    {
      bullets: ["Built dashboards with React"],
      company: "Example Co",
      current: true,
      endDate: "",
      location: "Remote",
      startDate: "2024",
      title: "Frontend Developer",
    },
  ];
  sections.technicalSkills = ["React", "TypeScript"];
  return sections;
}

const ENABLED = ["personal", "summary", "experience", "technicalSkills"] as const;

describe("template rendering", () => {
  it("every template renders the same resume data", () => {
    for (const template of TEMPLATE_IDS) {
      const html = renderToStaticMarkup(
        createElement(ResumePreview, {
          enabledSections: [...ENABLED],
          sections: sampleSections(),
          template,
        }),
      );
      expect(html).toContain("Sara Khan");
      expect(html).toContain("Frontend Developer");
      expect(html).toContain("Example Co");
      expect(html).toContain("Built dashboards with React");
      expect(html).toContain("TypeScript");
      // Standard ATS-friendly headings.
      expect(html).toContain("Work Experience");
      expect(html).toContain("Technical Skills");
    }
  });

  it("disabled and empty sections do not render headings", () => {
    const html = renderToStaticMarkup(
      createElement(ResumePreview, {
        enabledSections: ["personal", "summary"],
        sections: sampleSections(),
        template: "modern",
      }),
    );
    expect(html).toContain("Professional Summary");
    expect(html).not.toContain("Work Experience");
    expect(html).not.toContain("Education");
  });

  it("templates differ visually (fonts/colours), data stays identical", () => {
    const modern = renderToStaticMarkup(
      createElement(ResumePreview, {
        enabledSections: [...ENABLED],
        sections: sampleSections(),
        template: "modern",
      }),
    );
    const professional = renderToStaticMarkup(
      createElement(ResumePreview, {
        enabledSections: [...ENABLED],
        sections: sampleSections(),
        template: "professional",
      }),
    );
    expect(modern).not.toBe(professional);
    expect(modern).toContain("#4f46e5"); // indigo accent
    expect(professional).toContain("Georgia"); // serif
  });
});
