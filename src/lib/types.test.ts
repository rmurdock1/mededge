import { describe, it, expect } from "vitest";
import type {
  UserRole,
  PAStatus,
  PriorAuthStatus,
  DocumentationItem,
  PayerRuleDrug,
  PayerRuleProcedure,
  RuleAuditLogEntry,
  AuditAction,
  AuditSource,
  BcbsLicensee,
} from "./types";

describe("Type definitions", () => {
  it("UserRole accepts valid roles", () => {
    const roles: UserRole[] = [
      "practice_admin",
      "staff",
      "billing_manager",
      "super_admin",
    ];
    expect(roles).toHaveLength(4);
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

describe("v2 rule schema types", () => {
  it("PayerRuleDrug has all required fields", () => {
    const drug: PayerRuleDrug = {
      id: "rule-1",
      payer_name: "UnitedHealthcare",
      plan_type: "Commercial",
      bcbs_licensee: null,
      hcpcs_code: "J7500",
      ndc_code: null,
      drug_name: "Dupixent",
      icd10_codes: ["L20.9"],
      pa_required: true,
      documentation_requirements: [],
      step_therapy_required: true,
      step_therapy_details: {
        required_drugs: ["Triamcinolone", "Methotrexate"],
        duration_days: 90,
      },
      appeals_pathway: null,
      lab_requirements: { tb_test: true },
      submission_method: "portal",
      typical_turnaround_days: 10,
      source_url: "https://example.com",
      source_document_excerpt: null,
      last_verified_date: "2026-04-08",
      last_verified_by: null,
      confidence_score: 0.85,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
      deleted_at: null,
      deleted_by: null,
    };
    expect(drug.hcpcs_code).toBe("J7500");
    expect(drug.icd10_codes).toHaveLength(1);
    expect(drug.step_therapy_details?.duration_days).toBe(90);
  });

  it("PayerRuleProcedure has all required fields", () => {
    const proc: PayerRuleProcedure = {
      id: "rule-2",
      payer_name: "Aetna",
      plan_type: "Commercial",
      bcbs_licensee: null,
      cpt_code: "17311",
      procedure_name: "Mohs surgery",
      icd10_codes: [],
      pa_required: false,
      documentation_requirements: [],
      site_of_service_restrictions: { allowed: ["office", "asc"] },
      modifier_requirements: null,
      units_or_frequency_limits: null,
      appeals_pathway: null,
      submission_method: null,
      typical_turnaround_days: null,
      source_url: "https://example.com",
      source_document_excerpt: null,
      last_verified_date: "2026-04-08",
      last_verified_by: null,
      confidence_score: 0.8,
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
      deleted_at: null,
      deleted_by: null,
    };
    expect(proc.cpt_code).toBe("17311");
    expect(proc.site_of_service_restrictions?.allowed).toContain("office");
  });

  it("RuleAuditLogEntry constrains drug XOR procedure rule", () => {
    const entry: RuleAuditLogEntry = {
      id: "audit-1",
      drug_rule_id: "rule-1",
      procedure_rule_id: null,
      action: "update",
      source: "manual",
      actor_user_id: "user-1",
      change_reason: "fixed step therapy duration",
      row_before: { step_therapy_required: false },
      row_after: { step_therapy_required: true },
      changed_fields: ["step_therapy_required"],
      created_at: "2026-04-08T00:00:00Z",
    };
    expect(entry.action).toBe("update");
    expect(entry.changed_fields).toContain("step_therapy_required");
  });

  it("AuditAction enum covers all action types", () => {
    const actions: AuditAction[] = [
      "insert",
      "update",
      "delete",
      "soft_delete",
      "restore",
    ];
    expect(actions).toHaveLength(5);
  });

  it("AuditSource enum covers all source types", () => {
    const sources: AuditSource[] = [
      "manual",
      "bootstrap",
      "seed",
      "policy_watch",
      "api",
    ];
    expect(sources).toHaveLength(5);
  });

  it("BcbsLicensee enum includes the major BCBS plans", () => {
    const licensees: BcbsLicensee[] = ["anthem", "highmark", "carefirst", "other"];
    expect(licensees).toContain("anthem");
    expect(licensees).toContain("other");
  });
});
