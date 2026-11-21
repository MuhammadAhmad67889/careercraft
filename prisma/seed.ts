import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { serializeParsedJob } from "../src/lib/jobData";
import { parseJobWithHeuristics } from "../src/lib/jobParse";
import {
  DEFAULT_ENABLED_SECTIONS,
  emptyResumeSections,
  enabledToString,
  serializeSections,
} from "../src/lib/resumeData";

/**
 * Creates a demo account so anyone can sign in and see the app:
 *   email:    demo@example.com
 *   password: demo-password-123
 * The demo profile is a clearly fictional sample person.
 * Idempotent — safe to run repeatedly.
 */
async function main() {
  const db = new PrismaClient();
  try {
    const email = "demo@example.com";
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: "Demo User",
          passwordHash: hashPassword("demo-password-123"),
        },
      });
      console.log("Created demo user", email);
    }

    const sampleProfile = {
      fullName: "Demo User",
      country: "Pakistan",
      city: "Lahore",
      headline: "Frontend developer — React and TypeScript",
      employmentStatus: "Self-employed / Freelance",
      currentPosition: "Freelance web developer",
      experienceLevel: "Junior",
      yearsExperience: 2,
      targetPosition: "Frontend developer",
      preferredIndustries: "SaaS, e-commerce",
      preferredCountries: "Pakistan, Remote worldwide",
      workMode: "Remote",
      employmentType: "Full-time",
      salaryRange: "PKR 150k–250k / month",
      jobCategories: "Web development, UI engineering",
      technicalSkills: "React, TypeScript, Next.js, Node.js, PostgreSQL",
      softSkills: "Communication, teamwork",
      languages: "English, Urdu",
      certifications: "",
      onboardingStep: 3,
      onboardingDone: true,
    };

    await db.userProfile.upsert({
      create: { userId: user.id, ...sampleProfile },
      update: sampleProfile,
      where: { userId: user.id },
    });
    console.log("Demo profile ready. Sign in with demo@example.com / demo-password-123");

    // A sample resume for the demo account so job matching and the
    // ATS analyzer have something real to work with. Clearly
    // fictional, like the profile above.
    const existingResume = await db.resume.findFirst({
      where: { title: "Frontend Developer CV", userId: user.id },
    });
    if (!existingResume) {
      const sections = emptyResumeSections();
      sections.personal.fullName = "Demo User";
      sections.personal.headline = "Frontend Developer";
      sections.personal.email = "demo@example.com";
      sections.personal.location = "Lahore, Pakistan";
      sections.summary =
        "Frontend developer with 2 years of experience building React and TypeScript web apps for small businesses.";
      sections.experience = [
        {
          bullets: [
            "Built client dashboards with React and TypeScript",
            "Shipped a Next.js invoicing app used by local freelancers",
            "Wrote unit tests with Jest for shared components",
          ],
          company: "Example Studio",
          current: true,
          endDate: "",
          location: "Remote",
          startDate: "2024",
          title: "Frontend Developer",
        },
      ];
      sections.education = [
        {
          degree: "BS Computer Science",
          endDate: "2024",
          field: "Computer Science",
          notes: "",
          school: "Example University",
          startDate: "2020",
        },
      ];
      sections.technicalSkills = [
        "React",
        "TypeScript",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "Git",
      ];
      sections.projects = [
        {
          bullets: ["Real-time sync with WebSockets"],
          description: "A collaborative whiteboard built with React and Node.js.",
          link: "",
          name: "SyncBoard",
          tech: "React, TypeScript, Node.js",
        },
      ];
      await db.resume.create({
        data: {
          enabledSections: enabledToString(DEFAULT_ENABLED_SECTIONS),
          sectionsJson: serializeSections(sections),
          template: "modern",
          title: "Frontend Developer CV",
          userId: user.id,
        },
      });
      console.log("Sample resume ready for the demo account.");
    }

    // A sample job description so the demo account can run a match
    // immediately. Fictional posting, parsed with the same
    // heuristics a pasted posting would get in demo mode.
    const sampleJobText = [
      "Frontend Developer at Example Co",
      "",
      "What you'll do",
      "- Build and maintain React dashboards for our clients",
      "- Work with designers to ship accessible, responsive interfaces",
      "- Write tests and review pull requests",
      "",
      "Requirements",
      "- 2+ years of experience with React and TypeScript",
      "- Strong HTML and CSS skills",
      "- Experience with Git and REST APIs",
      "- Bachelor's degree in Computer Science or a related field",
      "",
      "Nice to have",
      "- Next.js or Node.js experience",
      "- Familiarity with Tailwind CSS",
    ].join("\n");
    const existingJob = await db.jobDescription.findFirst({
      where: { title: "Frontend Developer", userId: user.id },
    });
    if (!existingJob) {
      await db.jobDescription.create({
        data: {
          company: "Example Co",
          location: "Remote",
          parseMode: "heuristics",
          parsedJson: serializeParsedJob(parseJobWithHeuristics(sampleJobText)),
          rawText: sampleJobText,
          title: "Frontend Developer",
          userId: user.id,
        },
      });
      console.log("Sample job description ready for the demo account.");
    }

    // More sample jobs so Job Search has something to filter, and
    // one deliberate near-duplicate of the posting above (same
    // title and company, lightly reworded) so the duplicate
    // detection has something real to show. All fictional.
    const extraJobs: {
      company: string;
      location: string;
      sourceUrl: string | null;
      text: string;
      title: string;
    }[] = [
      {
        company: "Example Co",
        location: "Remote",
        sourceUrl: "https://example.com/jobs/frontend-developer",
        text: [
          "Frontend Developer — Example Co",
          "",
          "What you'll do",
          "- Build and maintain React dashboards for our clients",
          "- Work with designers to ship accessible, responsive interfaces",
          "- Write tests and review pull requests",
          "",
          "Requirements",
          "- 2+ years of experience with React and TypeScript",
          "- Strong HTML and CSS skills",
          "- Experience with Git and REST APIs",
          "- Bachelor's degree in Computer Science or a related field",
          "",
          "Nice to have",
          "- Next.js or Node.js experience",
          "- Familiarity with Tailwind CSS",
          "",
          "Apply with your CV and a link to your work.",
        ].join("\n"),
        title: "Frontend Developer",
      },
      {
        company: "Example Co",
        location: "Lahore",
        sourceUrl: null,
        text: [
          "Backend Developer at Example Co",
          "",
          "What you'll do",
          "- Design and build REST APIs with Node.js and PostgreSQL",
          "- Own database schema design and migrations",
          "- Write integration tests for critical endpoints",
          "",
          "Requirements",
          "- 3+ years of experience with Node.js and TypeScript",
          "- Strong PostgreSQL and SQL skills",
          "- Experience with Docker and CI pipelines",
          "",
          "Nice to have",
          "- Redis or queue experience",
          "- Familiarity with AWS",
        ].join("\n"),
        title: "Backend Developer",
      },
      {
        company: "Sample Studio",
        location: "Remote",
        sourceUrl: null,
        text: [
          "Product Designer at Sample Studio",
          "",
          "What you'll do",
          "- Design web and mobile interfaces in Figma",
          "- Run usability tests with real users",
          "- Maintain our design system",
          "",
          "Requirements",
          "- 2+ years of product design experience",
          "- A portfolio showing shipped work",
          "- Strong Figma skills",
          "",
          "Nice to have",
          "- Basic HTML and CSS",
          "- Motion design experience",
        ].join("\n"),
        title: "Product Designer",
      },
    ];
    for (const extra of extraJobs) {
      const alreadyThere = await db.jobDescription.findFirst({
        where: {
          company: extra.company,
          sourceUrl: extra.sourceUrl,
          title: extra.title,
          userId: user.id,
        },
      });
      if (alreadyThere) continue;
      await db.jobDescription.create({
        data: {
          company: extra.company,
          location: extra.location,
          parseMode: "heuristics",
          parsedJson: serializeParsedJob(parseJobWithHeuristics(extra.text)),
          rawText: extra.text,
          sourceUrl: extra.sourceUrl,
          title: extra.title,
          userId: user.id,
        },
      });
    }
    console.log("Sample Job Search jobs ready for the demo account.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
