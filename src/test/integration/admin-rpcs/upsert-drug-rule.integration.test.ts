import { describe, it, expect, afterEach } from "vitest";
import { authenticatedClient, serviceClient, testUserId } from "../setup";
import { buildTestDrugPayload, testAuditParams } from "../helpers";

describe("admin_upsert_drug_rule (integration)", () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await serviceClient.from("payer_rules_drug").delete().eq("id", id);
    }
    createdIds.length = 0;
  });

  it("inserts a new drug rule and creates an audit log entry", async () => {
    const payload = buildTestDrugPayload();
    const { data, error } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: payload, ...testAuditParams("Integration test: insert drug") }
    );

    expect(error).toBeNull();
    expect(data).toBeDefined();
    const ruleId = data.id;
    createdIds.push(ruleId);

    // Verify the rule exists with correct data
    const { data: rule } = await serviceClient
      .from("payer_rules_drug")
      .select("*")
      .eq("id", ruleId)
      .single();

    expect(rule).not.toBeNull();
    expect(rule!.drug_name).toBe(payload.drug_name);
    expect(rule!.payer_name).toBe("TestPayer");
    expect(rule!.pa_required).toBe(true);
    expect(rule!.confidence_score).toBe(0.7);
    expect(rule!.deleted_at).toBeNull();

    // Verify audit log entry
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("*")
      .eq("drug_rule_id", ruleId)
      .order("created_at", { ascending: false });

    expect(auditEntries).not.toBeNull();
    expect(auditEntries!.length).toBeGreaterThanOrEqual(1);
    const latest = auditEntries![0];
    expect(latest.action).toBe("insert");
    expect(latest.source).toBe("manual");
    expect(latest.actor_user_id).toBe(testUserId);
    expect(latest.change_reason).toBe("Integration test: insert drug");
  });

  it("updates an existing drug rule and records changed_fields", async () => {
    // Insert first
    const payload = buildTestDrugPayload();
    const { data: inserted } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: payload, ...testAuditParams("Integration test: insert for update") }
    );
    const ruleId = inserted.id;
    createdIds.push(ruleId);

    // Update
    const updatePayload = { ...payload, id: ruleId, drug_name: "UPDATED_DRUG", confidence_score: 0.9 };
    const { data: updated, error } = await authenticatedClient.rpc(
      "admin_upsert_drug_rule",
      { p_payload: updatePayload, ...testAuditParams("Integration test: update drug") }
    );

    expect(error).toBeNull();
    expect(updated.id).toBe(ruleId);

    // Verify update persisted
    const { data: rule } = await serviceClient
      .from("payer_rules_drug")
      .select("drug_name, confidence_score")
      .eq("id", ruleId)
      .single();

    expect(rule!.drug_name).toBe("UPDATED_DRUG");
    expect(rule!.confidence_score).toBe(0.9);

    // Verify audit log has both insert and update entries
    const { data: auditEntries } = await serviceClient
      .from("rule_audit_log")
      .select("action, change_reason, changed_fields")
      .eq("drug_rule_id", ruleId)
      .order("created_at", { ascending: true });

    expect(auditEntries!.length).toBe(2);
    expect(auditEntries![0].action).toBe("insert");
    expect(auditEntries![1].action).toBe("update");
    expect(auditEntries![1].changed_fields).toContain("drug_name");
    expect(auditEntries![1].changed_fields).toContain("confidence_score");
  });

  it("rejects calls from non-super_admin users", async () => {
    // Create a regular user (not super_admin)
    const { data: regularUser } = await serviceClient.auth.admin.createUser({
      email: `regular-${Date.now()}@mededge-test.local`,
      password: "RegularUser2026#",
      email_confirm: true,
    });

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient } = await import("@supabase/supabase-js");

    const regularAnonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: signIn } = await regularAnonClient.auth.signInWithPassword({
      email: regularUser!.user.email!,
      password: "RegularUser2026#",
    });

    const regularClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey,
      {
        global: { headers: { Authorization: `Bearer ${signIn!.session!.access_token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const payload = buildTestDrugPayload();
    const { error } = await regularClient.rpc("admin_upsert_drug_rule", {
      p_payload: payload,
      p_actor_user_id: regularUser!.user.id,
      p_change_reason: "Should fail",
      p_audit_source: "manual",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("super_admin");

    // Clean up regular user
    await serviceClient.auth.admin.deleteUser(regularUser!.user.id);
  });

  it("rejects empty change_reason", async () => {
    const payload = buildTestDrugPayload();
    const { error } = await authenticatedClient.rpc("admin_upsert_drug_rule", {
      p_payload: payload,
      p_actor_user_id: testUserId,
      p_change_reason: "",
      p_audit_source: "manual",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("change_reason");
  });
});
