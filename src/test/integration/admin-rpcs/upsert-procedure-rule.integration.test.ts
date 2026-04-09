import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient, testUserId } from "../setup";
import { buildTestProcedurePayload, testAuditParams } from "../helpers";

describe("admin_upsert_procedure_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_procedure").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("inserts a new procedure rule and creates an audit log entry", async () => {
    const payload = buildTestProcedurePayload();
    const { data, error } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      { p_payload: payload, ...testAuditParams("Integration test: insert procedure") }
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();
    const ruleId = data.id;
    createdIds.push(ruleId);

    // Verify the rule exists
    const { data: rule } = await serviceClient
      .from("payer_rules_procedure")
      .select("*")
      .eq("id", ruleId)
      .single();

    expect(rule).not.toBeNull();
    expect(rule!.procedure_name).toBe(payload.procedure_name);
    expect(rule!.payer_name).toBe("TestPayer");
    expect(rule!.submission_method).toBe("fax");
    expect(rule!.deleted_at).toBeNull();

    // Verify audit log entry
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("*")
      .eq("procedure_rule_id", ruleId)
      .order("created_at", { ascending: false });

    expect(auditEntries!.length).toBeGreaterThanOrEqual(1);
    const latest = auditEntries![0];
    expect(latest.action).toBe("insert");
    expect(latest.source).toBe("manual");
    expect(latest.actor_user_id).toBe(testUserId);
  });

  it("updates an existing procedure rule and records changed_fields", async () => {
    // Insert first
    const payload = buildTestProcedurePayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      { p_payload: payload, ...testAuditParams("Insert for update test") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Update
    const updatePayload = {
      ...payload,
      id: ruleId,
      procedure_name: "UPDATED_PROC",
      submission_method: "portal",
    };
    const { error } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      { p_payload: updatePayload, ...testAuditParams("Integration test: update procedure") }
    );

    expect(error).toBeNull();

    // Verify update persisted
    const { data: rule } = await serviceClient
      .from("payer_rules_procedure")
      .select("procedure_name, submission_method")
      .eq("id", ruleId)
      .single();

    expect(rule!.procedure_name).toBe("UPDATED_PROC");
    expect(rule!.submission_method).toBe("portal");

    // Verify audit log
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action, changed_fields")
      .eq("procedure_rule_id", ruleId)
      .order("created_at", { ascending: true });

    expect(auditEntries!.length).toBe(2);
    expect(auditEntries![1].action).toBe("update");
    expect(auditEntries![1].changed_fields).toContain("procedure_name");
  });

  it("rejects empty change_reason", async () => {
    const payload = buildTestProcedurePayload();
    const { error } = await authenticatedClient.rpc(
      "admin_upsert_procedure_rule",
      {
        p_payload: payload,
        p_actor_user_id: testUserId,
        p_change_reason: "",
        p_audit_source: "manual",
      }
    );

    expect(error).not.toBeNull();
    expect(error!.message).toContain("change_reason");
  });
});
