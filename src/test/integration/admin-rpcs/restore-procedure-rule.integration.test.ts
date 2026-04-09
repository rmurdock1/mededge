import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient } from "../setup";
import { buildTestProcedurePayload, testAuditParams } from "../helpers";

describe("admin_restore_procedure_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_procedure").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("restores a soft-deleted procedure rule with full audit lifecycle", async () => {
    // Insert
    const payload = buildTestProcedurePayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      { p_payload: payload, ...testAuditParams("Insert for restore test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Soft-delete
    await authenticatedClient.rpc("admin_soft_delete_procedure_rule", {
      p_rule_id: ruleId,
      ...testAuditParams("Soft-delete for restore test"),
    });

    // Restore
    const { error } = await authenticatedClient.rpc(
      "admin_restore_procedure_rule",
      {
        p_rule_id: ruleId,
        ...testAuditParams("Integration test: restore procedure"),
      }
    );

    expect(error).toBeNull();

    // Verify deleted_at is cleared
    const { data: rule } = await serviceClient
      .from("payer_rules_procedure")
      .select("deleted_at, deleted_by")
      .eq("id", ruleId)
      .single();

    expect(rule!.deleted_at).toBeNull();
    expect(rule!.deleted_by).toBeNull();

    // Verify full audit lifecycle
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action")
      .eq("procedure_rule_id", ruleId)
      .order("created_at", { ascending: true });

    expect(auditEntries!.map((e) => e.action)).toEqual([
      "insert",
      "soft_delete",
      "restore",
    ]);
  });
});
