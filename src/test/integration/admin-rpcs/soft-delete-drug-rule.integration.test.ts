import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient, testUserId } from "../setup";
import { buildTestDrugPayload, testAuditParams } from "../helpers";

describe("admin_soft_delete_drug_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_drug").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("soft-deletes a rule and creates an audit entry with action=soft_delete", async () => {
    // Insert a rule first
    const payload = buildTestDrugPayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: payload, ...testAuditParams("Insert for soft-delete test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Soft-delete
    const { error } = await authenticatedClient.rpc(
      "admin_soft_delete_drug_rule",
      {
        p_rule_id: ruleId,
        ...testAuditParams("Integration test: soft-delete drug"),
      }
    );

    expect(error).toBeNull();

    // Verify deleted_at is set
    const { data: rule } = await serviceClient
      .from("payer_rules_drug")
      .select("deleted_at, deleted_by")
      .eq("id", ruleId)
      .single();

    expect(rule!.deleted_at).not.toBeNull();
    expect(rule!.deleted_by).toBe(testUserId);

    // Verify audit log
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action, change_reason")
      .eq("drug_rule_id", ruleId)
      .order("created_at", { ascending: false });

    const softDeleteEntry = auditEntries!.find(
      (e) => e.action === "soft_delete"
    );
    expect(softDeleteEntry).toBeDefined();
    expect(softDeleteEntry!.change_reason).toBe(
      "Integration test: soft-delete drug"
    );
  });

  it("rejects soft-delete with empty change_reason", async () => {
    const payload = buildTestDrugPayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: payload, ...testAuditParams("Insert for empty-reason test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    const { error } = await authenticatedClient.rpc(
      "admin_soft_delete_drug_rule",
      {
        p_rule_id: ruleId,
        p_actor_user_id: testUserId,
        p_change_reason: "",
        p_audit_source: "manual",
      }
    );

    expect(error).not.toBeNull();
    expect(error!.message).toContain("change_reason");
  });
});
