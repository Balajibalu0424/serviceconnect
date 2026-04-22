/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  normalizeCustomerQuestioningDraft,
  refineCustomerOnboardingResponse,
  refineProfessionalOnboardingResponse,
  type QuestioningCategoryOption,
} from "./onboardingQuestioning";

const categories: QuestioningCategoryOption[] = [
  { id: "cat-plumbing", name: "Plumbing", slug: "plumbing" },
  { id: "cat-cleaning", name: "Cleaning", slug: "cleaning" },
  { id: "cat-web", name: "Web Design", slug: "web-design" },
];

describe("refineCustomerOnboardingResponse", () => {
  it("asks a plumbing-specific follow-up when the fixture is missing", () => {
    const result = refineCustomerOnboardingResponse({
      description: "I have a leak and need a plumber in Dublin 6.",
      locationText: "Dublin 6",
      categoryLabel: "Plumbing",
    }, categories);

    expect(result.isComplete).toBe(false);
    expect(result.reply).toMatch(/tap|toilet|shower|pipe|radiator|boiler|drain/i);
    expect(result.extractedData.categoryId).toBe("cat-plumbing");
  });

  it("keeps asking for timing even when the core fields are present", () => {
    const result = refineCustomerOnboardingResponse({
      title: "Bathroom leak repair",
      description: "Need a plumber to repair a leaking pipe under the bathroom sink in a flat. It is affecting one bathroom and the floor is getting wet.",
      categoryId: "cat-plumbing",
      categoryLabel: "Plumbing",
      locationText: "Dublin 2",
      urgency: "NORMAL",
    }, categories);

    expect(result.isComplete).toBe(false);
    expect(result.reply).toMatch(/when would you like/i);
  });

  it("marks a detailed brief complete", () => {
    const result = refineCustomerOnboardingResponse({
      title: "Bathroom leak repair in Dublin 2",
      description: "Need a plumber to repair a leaking pipe under the bathroom sink in a second-floor flat in Dublin 2. It is affecting one bathroom, the floor is getting wet, and I need someone this week to diagnose and fix it.",
      categoryId: "cat-plumbing",
      categoryLabel: "Plumbing",
      locationText: "Dublin 2",
      urgency: "HIGH",
    }, categories);

    expect(result.isComplete).toBe(true);
    expect(result.reply).toMatch(/enough/i);
  });
});

describe("normalizeCustomerQuestioningDraft", () => {
  it("infers the category from the description when only free text is given", () => {
    const result = normalizeCustomerQuestioningDraft({
      description: "Need a deep clean for a two bedroom apartment in Galway.",
      locationText: "Galway",
    }, categories);

    expect(result.categorySlug).toBe("cleaning");
    expect(result.draft.categoryId).toBe("cat-cleaning");
  });
});

describe("refineProfessionalOnboardingResponse", () => {
  it("asks for years of experience before completing a profile", () => {
    const result = refineProfessionalOnboardingResponse({
      categoryIds: ["cat-web"],
      bio: "I build brochure and ecommerce websites for local businesses and handle the design, build, and launch process.",
      location: "Dublin",
      serviceAreas: ["Dublin", "Kildare"],
    }, categories);

    expect(result.isComplete).toBe(false);
    expect(result.reply).toMatch(/years of experience/i);
  });
});
