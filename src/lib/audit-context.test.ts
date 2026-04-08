import { describe, it, expect } from "vitest";
import {
  manualAuditContext,
  seedAuditContext,
  policyWatchAuditContext,
  toRpcAuditParams,
  type AuditContext,
} from "./audit-context";

describe("manualAuditContext", () => {
  it("builds a manual context with the actor and trimmed reason", () => {
    const ctx = manualAuditContext("user-123", "  fixed turnaround days  ");
    expect(ctx).toEqual({
      actorUserId: "user-123",
      changeReason: "fixed turnaround days",
      source: "manual",
    });
  });

  it("rejects empty change reasons", () => {
    expect(() => manualAuditContext("user-123", "")).toThrow(
      /changeReason is required/
    );
    expect(() => manualAuditContext("user-123", "   ")).toThrow(
      /changeReason is required/
    );
  });
});

describe("seedAuditContext", () => {
  it("builds a seed context with null actor", () => {
    const ctx = seedAuditContext("Initial v2 migration");
    expect(ctx.actorUserId).toBeNull();
    expect(ctx.source).toBe("seed");
    expect(ctx.changeReason).toBe("Initial v2 migration");
  });
});

describe("policyWatchAuditContext", () => {
  it("builds a policy_watch context with null actor", () => {
    const ctx = policyWatchAuditContext("UHC Dupixent policy updated 2026-Q2");
    expect(ctx.actorUserId).toBeNull();
    expect(ctx.source).toBe("policy_watch");
  });
});

describe("toRpcAuditParams", () => {
  it("serializes to the snake_case shape RPC functions expect", () => {
    const ctx: AuditContext = {
      actorUserId: "user-1",
      changeReason: "test",
      source: "manual",
    };
    expect(toRpcAuditParams(ctx)).toEqual({
      p_actor_user_id: "user-1",
      p_change_reason: "test",
      p_audit_source: "manual",
    });
  });

  it("preserves null actor for non-manual sources", () => {
    const ctx = seedAuditContext("seed run");
    const params = toRpcAuditParams(ctx);
    expect(params.p_actor_user_id).toBeNull();
    expect(params.p_audit_source).toBe("seed");
  });
});
