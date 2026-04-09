"use server";

import { createClient } from "@/lib/supabase/server";
import { manualAuditContext, toRpcAuditParams } from "@/lib/audit-context";
import {
  drugRuleFormSchema,
  procedureRuleFormSchema,
  type DrugRuleFormData,
  type ProcedureRuleFormData,
} from "./schemas";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase: null, userId: null, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    return { supabase: null, userId: null, error: "Not found" };
  }

  return { supabase, userId: user.id, error: null };
}

// ---- Drug Rule Actions ----

export async function upsertDrugRule(
  formData: DrugRuleFormData & { id?: string }
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  const parsed = drugRuleFormSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const { change_reason, ...ruleData } = parsed.data;
  const auditCtx = manualAuditContext(auth.userId!, change_reason);
  const auditParams = toRpcAuditParams(auditCtx);

  const payload = {
    ...ruleData,
    ...(formData.id ? { id: formData.id } : {}),
  };

  const { data, error } = await auth.supabase!.rpc("admin_upsert_drug_rule", {
    p_payload: payload,
    ...auditParams,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function softDeleteDrugRule(
  ruleId: string,
  changeReason: string
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  if (!changeReason.trim()) {
    return { success: false, error: "Change reason is required" };
  }

  const auditCtx = manualAuditContext(auth.userId!, changeReason);
  const auditParams = toRpcAuditParams(auditCtx);

  const { error } = await auth.supabase!.rpc("admin_soft_delete_drug_rule", {
    p_rule_id: ruleId,
    ...auditParams,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function restoreDrugRule(
  ruleId: string,
  changeReason: string
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  if (!changeReason.trim()) {
    return { success: false, error: "Change reason is required" };
  }

  const auditCtx = manualAuditContext(auth.userId!, changeReason);
  const auditParams = toRpcAuditParams(auditCtx);

  const { error } = await auth.supabase!.rpc("admin_restore_drug_rule", {
    p_rule_id: ruleId,
    ...auditParams,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---- Procedure Rule Actions ----

export async function upsertProcedureRule(
  formData: ProcedureRuleFormData & { id?: string }
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  const parsed = procedureRuleFormSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  const { change_reason, ...ruleData } = parsed.data;
  const auditCtx = manualAuditContext(auth.userId!, change_reason);
  const auditParams = toRpcAuditParams(auditCtx);

  const payload = {
    ...ruleData,
    ...(formData.id ? { id: formData.id } : {}),
  };

  const { data, error } = await auth.supabase!.rpc(
    "admin_upsert_procedure_rule",
    {
      p_payload: payload,
      ...auditParams,
    }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function softDeleteProcedureRule(
  ruleId: string,
  changeReason: string
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  if (!changeReason.trim()) {
    return { success: false, error: "Change reason is required" };
  }

  const auditCtx = manualAuditContext(auth.userId!, changeReason);
  const auditParams = toRpcAuditParams(auditCtx);

  const { error } = await auth.supabase!.rpc(
    "admin_soft_delete_procedure_rule",
    {
      p_rule_id: ruleId,
      ...auditParams,
    }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function restoreProcedureRule(
  ruleId: string,
  changeReason: string
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  if (!changeReason.trim()) {
    return { success: false, error: "Change reason is required" };
  }

  const auditCtx = manualAuditContext(auth.userId!, changeReason);
  const auditParams = toRpcAuditParams(auditCtx);

  const { error } = await auth.supabase!.rpc(
    "admin_restore_procedure_rule",
    {
      p_rule_id: ruleId,
      ...auditParams,
    }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
