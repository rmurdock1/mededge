import { describe, it, expect } from "vitest";
import type {
  UserRole,
  PAStatus,
  PriorAuthStatus,
  DocumentationItem,
} from "./types";

describe("Type definitions", () => {
  it("UserRole accepts valid roles", () => {
    const roles: UserRole[] = ["practice_admin", "staff", "billing_manager"];
    expect(roles).toHaveLength(3);
  });

  it("PAStatus accepts all valid statuses", () => {
    const statuses: PAStatus[] = [
      "not_needed",
      "needed",
      "in_progress",
      "submitted",
      "approved",
      "denied",
      "appeal_submitted",
      "appeal_approved",
    ];
    expect(statuses).toHaveLength(8);
  });

  it("PriorAuthStatus accepts all valid statuses", () => {
    const statuses: PriorAuthStatus[] = [
      "draft",
      "ready",
      "submitted",
      "pending",
      "approved",
      "denied",
      "appeal_draft",
      "appeal_submitted",
      "appeal_approved",
      "appeal_denied",
      "expired",
    ];
    expect(statuses).toHaveLength(11);
  });

  it("DocumentationItem has correct shape", () => {
    const item: DocumentationItem = {
      item: "BSA assessment",
      required: true,
      description: "Body surface area measurement",
      completed: false,
    };
    expect(item.item).toBe("BSA assessment");
    expect(item.required).toBe(true);
    expect(item.completed).toBe(false);
  });
});
