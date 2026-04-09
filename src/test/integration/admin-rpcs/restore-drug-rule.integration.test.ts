import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient } from "../setup";
import { buildTestDrugPayload, testAuditParams } from "../helpers";

describe("admin_restore_drug_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_drug").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("restores a soft-deleted rule and creates audit entry with action=restore", async () => {
    // Insert
    const payload = buildTestDrugPayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: payload, ...testAuditParams("Insert for restore test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Soft-delete
    await authenticatedClient.rpc("admin_soft_delete_drug_rule", {
      p_rule_id: ruleId,
      ...testAuditParams("Soft-delete for restore test"),
    });

    // Restore
    const { error } = await authenticatedClient.rpc(
      "admin_restore_drug_rule",
      {
        p_rule_id: ruleId,
        ...testAuditParams("Integration test: restore drug"),
      }
    );

    expect(error).toBeNull();

    // Verify deleted_at is cleared
    const { data: rule } = await serviceClient
      .from("payer_rules_drug")
      .select("deleted_at, deleted_by")
      .eq("id", ruleId)
      .single();

    expect(rule!.deleted_at).toBeNull();
    expect(rule!.deleted_by).toBeNull();

    // Verify audit log has the full lifecycle: insert → soft_delete → restore
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action")
      .eq("drug_rule_id", ruleId)
      .order("created_at", { ascending: true });

    expect(auditEntries!.map((e) => e.action)).toEqual([
      "insert",
      "soft_delete",
      "restore",
    ]);
  });
});
