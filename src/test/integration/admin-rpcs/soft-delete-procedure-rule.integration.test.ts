import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient, testUserId } from "../setup";
import { buildTestProcedurePayload, testAuditParams } from "../helpers";

describe("admin_soft_delete_procedure_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_procedure").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("soft-deletes a procedure rule and creates audit entry", async () => {
    // Insert
    const payload = buildTestProcedurePayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      { p_payload: payload, ...testAuditParams("Insert for soft-delete test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Soft-delete
    const { error } = await authenticatedClient.rpc(
      "admin_soft_delete_procedure_rule",
      {
        p_rule_id: ruleId,
        ...testAuditParams("Integration test: soft-delete procedure"),
      }
    );

    expect(error).toBeNull();

    // Verify deleted_at is set
    const { data: rule } = await serviceClient
      .from("payer_rules_procedure")
      .select("deleted_at, deleted_by")
      .eq("id", ruleId)
      .single();

    expect(rule!.deleted_at).not.toBeNull();
    expect(rule!.deleted_by).toBe(testUserId);

    // Verify audit log
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action")
      .eq("procedure_rule_id", ruleId)
      .order("created_at", { ascending: true });

    expect(auditEntries!.map((e) => e.action)).toEqual([
      "insert",
      "soft_delete",
    ]);
  });
});
