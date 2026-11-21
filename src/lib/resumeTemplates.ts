/**
 * The five resume templates. All five render the same section data
 * in a single column with standard headings and a logical reading
 * order, so they stay friendly to applicant tracking systems — only
 * typography, colour, and spacing change between them.
 */

export const TEMPLATE_IDS = [
  "modern",
  "professional",
  "minimal",
  "academic",
  "technical",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface TemplateInfo {
  description: string;
  id: TemplateId;
  label: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    description: "Clean sans-serif with an indigo accent. Good all-rounder.",
    id: "modern",
    label: "Modern",
  },
  {
    description: "Classic serif, centred header. Suits corporate roles.",
    id: "professional",
    label: "Professional",
  },
  {
    description: "Maximum whitespace, quiet headings. Lets content lead.",
    id: "minimal",
    label: "Minimal",
  },
  {
    description: "Serif with ruled headings. Built for education-first CVs.",
    id: "academic",
    label: "Academic",
  },
  {
    description: "Monospace headings, skills up front. For engineering roles.",
    id: "technical",
    label: "Technical",
  },
];

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function templateLabel(templateId: string): string {
  return TEMPLATES.find((t) => t.id === templateId)?.label ?? "Modern";
}
