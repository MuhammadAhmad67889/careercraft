import type { UserProfile } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  listToString,
  onboardingFieldsSchema,
  profileCompletion,
  stringToList,
} from "./profile";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    fullName: "",
    country: "",
    city: "",
    headline: "",
    employmentStatus: "",
    currentPosition: "",
    experienceLevel: "",
    yearsExperience: 0,
    targetPosition: "",
    preferredIndustries: "",
    preferredCountries: "",
    workMode: "",
    employmentType: "",
    salaryRange: "",
    jobCategories: "",
    technicalSkills: "",
    softSkills: "",
    languages: "",
    certifications: "",
    onboardingStep: 0,
    onboardingDone: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("list helpers", () => {
  it("joins trimmed items and drops empties", () => {
    expect(listToString([" React ", "", "TypeScript", "  "])).toBe("React, TypeScript");
  });

  it("splits stored strings back into items", () => {
    expect(stringToList("React, TypeScript , Node.js")).toEqual([
      "React",
      "TypeScript",
      "Node.js",
    ]);
  });

  it("handles empty strings", () => {
    expect(stringToList("")).toEqual([]);
    expect(listToString([])).toBe("");
  });
});

describe("profile completion", () => {
  it("is 0 for a missing or empty profile", () => {
    expect(profileCompletion(null)).toBe(0);
    expect(profileCompletion(makeProfile())).toBe(0);
  });

  it("is 100 when every tracked field is filled", () => {
    const full = makeProfile({
      fullName: "A",
      country: "Pakistan",
      city: "Lahore",
      headline: "Dev",
      employmentStatus: "Employed",
      currentPosition: "Dev",
      experienceLevel: "Junior",
      yearsExperience: 2,
      targetPosition: "Senior dev",
      preferredIndustries: "SaaS",
      preferredCountries: "Pakistan",
      workMode: "Remote",
      employmentType: "Full-time",
      salaryRange: "PKR 200k",
      jobCategories: "Web",
      technicalSkills: "React",
      softSkills: "Teamwork",
      languages: "English",
      certifications: "AWS",
    });
    expect(profileCompletion(full)).toBe(100);
  });

  it("counts partially filled profiles proportionally", () => {
    // 19 tracked items total (18 strings + yearsExperience).
    const partial = makeProfile({ fullName: "A", country: "Pakistan" });
    expect(profileCompletion(partial)).toBe(Math.round((2 / 19) * 100));
  });

  it("treats whitespace-only values as empty", () => {
    expect(profileCompletion(makeProfile({ fullName: "   " }))).toBe(0);
  });
});

describe("onboarding field validation", () => {
  it("accepts a valid subset of fields", () => {
    const parsed = onboardingFieldsSchema.safeParse({
      fullName: "Ayesha Khan",
      yearsExperience: 3,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range years of experience", () => {
    expect(onboardingFieldsSchema.safeParse({ yearsExperience: -1 }).success).toBe(false);
    expect(onboardingFieldsSchema.safeParse({ yearsExperience: 61 }).success).toBe(false);
    expect(onboardingFieldsSchema.safeParse({ yearsExperience: 2.5 }).success).toBe(false);
  });

  it("rejects over-long text", () => {
    expect(
      onboardingFieldsSchema.safeParse({ fullName: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("drops unknown keys instead of failing", () => {
    const parsed = onboardingFieldsSchema.safeParse({
      fullName: "A",
      isAdmin: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("isAdmin" in parsed.data).toBe(false);
    }
  });
});
