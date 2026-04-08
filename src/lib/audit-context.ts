import type { AuditSource } from "./types";

/**
 * Audit context that accompanies every rule mutation.
 *
 * The Postgres triggers on payer_rules_drug and payer_rules_procedure
 * read this context from session GUCs (`app.current_user_id`,
 * `app.change_reason`, `app.audit_source`) and write it into rule_audit_log.
 *
 * App code never sets the GUCs directly. Instead, every rule mutation goes
 * through a Supabase RPC function that takes an AuditContext as parameters
 * and sets the GUCs locally inside the same transaction as the mutation.
 * This guarantees the audit row and the rule change are atomic, even though
 * PostgREST runs each request in a fresh connection.
 *
 * The Sprint 4 admin dashboard will add typed RPCs like
 * `admin_upsert_drug_rule(p_payload, p_audit_context)` that internally call
 * the same `set_config(... , true)` pattern as `bootstrap_super_admin`.
 * This module exists now so those callers have a single canonical type to
 * import and so the test suite can validate the shape.
 */
export interface AuditContext {
  /** auth.users.id of the user performing the change. NULL only for bootstrap. */
  actorUserId: string | null;
  /** Short human explanation. Required for non-bootstrap sources. */
  changeReason: string;
  /** Where the change came from. Determines audit_source enum value. */
  source: AuditSource;
}

/**
 * Build an AuditContext for a manual edit by a super_admin via the admin
 * dashboard. The most common case once Sprint 4 lands.
 */
export function manualAuditContext(
  actorUserId: string,
  changeReason: string
): AuditContext {
  if (!changeReason.trim()) {
    throw new Error("changeReason is required for manual rule edits");
  }
  return {
    actorUserId,
    changeReason: changeReason.trim(),
    source: "manual",
  };
}

/**
 * Build an AuditContext for a bulk seed import (e.g. JSON files in
 * data/payer-rules/). Actor is null because seeds run unattended.
 */
export function seedAuditContext(changeReason: string): AuditContext {
  return {
    actorUserId: null,
    changeReason,
    source: "seed",
  };
}

/**
 * Build an AuditContext for the future Policy Watch automated scraper.
 * Sprint 7+. Defined now so the type contract is stable.
 */
export function policyWatchAuditContext(changeReason: string): AuditContext {
  return {
    actorUserId: null,
    changeReason,
    source: "policy_watch",
  };
}

/**
 * Serialize an AuditContext into the parameter shape that Sprint 4 admin
 * RPCs will accept. Centralized so the parameter names stay in sync with
 * the SQL function signatures.
 */
export function toRpcAuditParams(ctx: AuditContext): {
  p_actor_user_id: string | null;
  p_change_reason: string;
  p_audit_source: AuditSource;
} {
  return {
    p_actor_user_id: ctx.actorUserId,
    p_change_reason: ctx.changeReason,
    p_audit_source: ctx.source,
  };
}
