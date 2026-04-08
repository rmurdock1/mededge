import { describe, it, expect } from "vitest";
import {
  generateChecklist,
  isChecklistReady,
  getChecklistProgress,
} from "./checklist";
import type { PARequirement } from "./types";

const mockRequirements: PARequirement[] = [
  {
    cpt_code: "J7500",
    pa_required: true,
    confidence: 0.85,
    documentation_requirements: [
      { item: "BSA assessment", required: true, description: "Body surface area" },
      { item: "Prior treatment history", required: true, description: "Failed treatments" },
      { item: "Photographs", required: false, description: "Clinical photos" },
    ],
    submission_method: "portal",
    typical_turnaround_days: 10,
    step_therapy_required: true,
    step_therapy_details: "Must have tried topicals",
    payer_name: "UnitedHealthcare",
    plan_type: "Commercial",
    source_url: "https://example.com",
    last_verified_date: "2026-03-15",
    rule_id: "test-rule-1",
  },
];

const mockUnknown: PARequirement[] = [
  {
    cpt_code: "99999",
    pa_required: "unknown",
    confidence: 0,
    documentation_requirements: [],
    submission_method: null,
    typical_turnaround_days: null,
    step_therapy_required: false,
    step_therapy_details: null,
    payer_name: "UnknownPayer",
    plan_type: "Commercial",
    source_url: null,
    last_verified_date: null,
    rule_id: null,
  },
];

describe("generateChecklist", () => {
  it("generates checklist from PA requirements", () => {
    const checklist = generateChecklist(mockRequirements);
    expect(checklist).toHaveLength(3);
    expect(checklist.every((item) => item.completed === false)).toBe(true);
  });

  it("sorts required items before optional items", () => {
    const checklist = generateChecklist(mockRequirements);
    const requiredItems = checklist.filter((i) => i.required);
    const optionalItems = checklist.filter((i) => !i.required);
    // All required should come before optional
    const lastRequiredIdx = checklist.findLastIndex((i) => i.required);
    const firstOptionalIdx = checklist.findIndex((i) => !i.required);
    if (requiredItems.length > 0 && optionalItems.length > 0) {
      expect(lastRequiredIdx).toBeLessThan(firstOptionalIdx);
    }
  });

  it("deduplicates items across multiple requirements", () => {
    const dupeRequirements: PARequirement[] = [
      ...mockRequirements,
      {
        ...mockRequirements[0]!,
        cpt_code: "J0135",
        documentation_requirements: [
          { item: "BSA assessment", required: true, description: "Dupe" },
          { item: "Lab results", required: true, description: "New item" },
        ],
      },
    ];
    const checklist = generateChecklist(dupeRequirements);
    const bsaItems = checklist.filter((i) => i.item === "BSA assessment");
    expect(bsaItems).toHaveLength(1);
    expect(checklist).toHaveLength(4); // 3 original + 1 new (Lab results)
  });

  it("returns empty checklist for unknown requirements", () => {
    const checklist = generateChecklist(mockUnknown);
    expect(checklist).toHaveLength(0);
  });

  it("skips requirements where PA is not required", () => {
    const noPA: PARequirement[] = [
      { ...mockRequirements[0]!, pa_required: false },
    ];
    const checklist = generateChecklist(noPA);
    expect(checklist).toHaveLength(0);
  });
});

describe("isChecklistReady", () => {
  it("returns false when required items are incomplete", () => {
    const checklist = generateChecklist(mockRequirements);
    expect(isChecklistReady(checklist)).toBe(false);
  });

  it("returns true when all required items are completed", () => {
    const checklist = generateChecklist(mockRequirements).map((item) => ({
      ...item,
      completed: item.required ? true : item.completed,
    }));
    expect(isChecklistReady(checklist)).toBe(true);
  });

  it("returns true for empty checklist", () => {
    expect(isChecklistReady([])).toBe(true);
  });
});

describe("getChecklistProgress", () => {
  it("returns correct progress for partially completed checklist", () => {
    const checklist = generateChecklist(mockRequirements);
    checklist[0]!.completed = true; // complete first required item

    const progress = getChecklistProgress(checklist);
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.requiredCompleted).toBe(1);
    expect(progress.requiredTotal).toBe(2);
    expect(progress.percentage).toBe(33);
  });

  it("returns 100% for empty checklist", () => {
    const progress = getChecklistProgress([]);
    expect(progress.percentage).toBe(100);
  });
});
