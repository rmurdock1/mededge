"use server";

import { createClient } from "@supabase/supabase-js";
import { runSync } from "./sync";
import { runPADetection } from "./pa-detection";

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SyncActionResult {
  status: string;
  recordsCreated: number;
  recordsUpdated: number;
  errors: number;
  paDetection: {
    checked: number;
    paRequired: number;
    priorAuthsCreated: number;
  } | null;
}

/**
 * Manual sync trigger — called from the admin dashboard.
 * Requires super_admin role (enforced via server action context).
 */
export async function triggerManualSync(
  practiceId: string
): Promise<ActionResult<SyncActionResult>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: "Server configuration error" };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const syncResult = await runSync(
      supabase,
      practiceId,
      "incremental",
      "manual"
    );

    let paDetection = null;
    if (syncResult.status !== "failed") {
      const paResult = await runPADetection(supabase, practiceId);
      paDetection = {
        checked: paResult.appointmentsChecked,
        paRequired: paResult.paRequired,
        priorAuthsCreated: paResult.priorAuthsCreated,
      };
    }

    return {
      success: true,
      data: {
        status: syncResult.status,
        recordsCreated: syncResult.recordsCreated,
        recordsUpdated: syncResult.recordsUpdated,
        errors: syncResult.errors.length,
        paDetection,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
