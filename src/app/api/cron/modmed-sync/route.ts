/**
 * Vercel Cron route for ModMed sync.
 *
 * Triggered every 15 minutes via vercel.json cron configuration.
 * Syncs all practices that have ModMed credentials configured.
 *
 * Security: Gated by CRON_SECRET header to prevent random internet
 * traffic from triggering syncs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSync } from "@/lib/modmed/sync";
import { runPADetection } from "@/lib/modmed/pa-detection";
import { logger } from "@/lib/logger";

export const maxDuration = 60; // Vercel Pro: up to 300s
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error("CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create service role client (bypasses RLS for sync operations)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("Supabase credentials not configured for cron");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find all practices with ModMed credentials
  const { data: practices, error } = await supabase
    .from("practices")
    .select("id, name")
    .not("modmed_url_prefix", "is", null)
    .not("modmed_credentials", "is", null);

  if (error || !practices) {
    logger.error("Failed to fetch practices for cron sync", {
      error: error?.message,
    });
    return NextResponse.json(
      { error: "Failed to fetch practices" },
      { status: 500 }
    );
  }

  if (practices.length === 0) {
    return NextResponse.json({ message: "No practices to sync" });
  }

  const results = [];

  for (const practice of practices) {
    logger.info("Cron sync starting", {
      practice_id: practice.id,
      practice_name: practice.name,
    });

    const syncResult = await runSync(
      supabase,
      practice.id,
      "incremental",
      "cron"
    );

    // Run PA detection after sync
    let paResult = null;
    if (syncResult.status !== "failed") {
      paResult = await runPADetection(supabase, practice.id);
    }

    results.push({
      practice_id: practice.id,
      sync: {
        status: syncResult.status,
        records_created: syncResult.recordsCreated,
        records_updated: syncResult.recordsUpdated,
        errors: syncResult.errors.length,
        duration_ms: syncResult.durationMs,
      },
      pa_detection: paResult
        ? {
            checked: paResult.appointmentsChecked,
            pa_required: paResult.paRequired,
            prior_auths_created: paResult.priorAuthsCreated,
          }
        : null,
    });
  }

  return NextResponse.json({
    message: `Synced ${practices.length} practice(s)`,
    results,
  });
}
