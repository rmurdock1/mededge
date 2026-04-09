/**
 * ModMed Sync Orchestrator
 *
 * Pure function that syncs data from ModMed FHIR API into Supabase.
 * Decoupled from the trigger mechanism — called by:
 * - Vercel Cron route (/api/cron/modmed-sync)
 * - Admin dashboard manual trigger
 * - CLI script (scripts/sync-modmed.ts)
 *
 * Supports two sync modes:
 * - "full": initial onboarding sync — all patients, all appointments (next 30 days),
 *   all coverage, all practitioners
 * - "incremental": ongoing sync — only appointments changed since last sync
 *
 * HIPAA: Never log patient names, DOBs, or insurance member IDs.
 * Only log: resource counts, status codes, sync timing, error categories.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ModMedClient } from "./client";
import type { ModMedClientConfig } from "./types";
import type { SyncType, SyncTrigger } from "./types";
import { FHIRFetcher } from "./fetchers";
import { mapPatient } from "./mappers/patient";
import { mapAppointment } from "./mappers/appointment";
import { mapCoverage, pickPrimaryCoverage } from "./mappers/coverage";
import { mapPractitioner } from "./mappers/practitioner";
import { SupabaseCircuitBreakerStore } from "./circuit-breaker-db-store";
import { CircuitOpenError } from "./client";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  syncLogId: string;
  status: "completed" | "failed" | "partial";
  recordsFetched: Record<string, number>;
  recordsCreated: number;
  recordsUpdated: number;
  errors: SyncError[];
  durationMs: number;
}

export interface SyncError {
  resource: string;
  id?: string;
  error: string;
}

interface SyncContext {
  supabase: SupabaseClient;
  practiceId: string;
  fetcher: FHIRFetcher;
  syncLogId: string;
  errors: SyncError[];
  recordsFetched: Record<string, number>;
  recordsCreated: number;
  recordsUpdated: number;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a sync for a single practice.
 *
 * @param supabase - Service role client (bypasses RLS for upserts)
 * @param practiceId - The practice to sync
 * @param syncType - "full" or "incremental"
 * @param triggeredBy - What triggered this sync
 * @param modmedConfig - Optional override (if not provided, reads from practices table)
 */
export async function runSync(
  supabase: SupabaseClient,
  practiceId: string,
  syncType: SyncType,
  triggeredBy: SyncTrigger,
  modmedConfig?: ModMedClientConfig
): Promise<SyncResult> {
  const startTime = Date.now();

  // 1. Resolve ModMed config
  const config = modmedConfig ?? (await loadModMedConfig(supabase, practiceId));
  if (!config) {
    return {
      syncLogId: "",
      status: "failed",
      recordsFetched: {},
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [{ resource: "config", error: "No ModMed credentials configured for this practice" }],
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Set up circuit breaker with DB persistence
  const breakerStore = new SupabaseCircuitBreakerStore(supabase, practiceId);
  const client = new ModMedClient(config, {
    circuitBreakerStore: breakerStore,
    circuitBreakerThreshold: 5,
  });

  // 3. Check circuit breaker — if open, try half-open recovery
  const breakerState = await client.getCircuitBreakerState();
  if (breakerState.status === "open") {
    await client.tryRecovery();
    logger.info("Circuit breaker half-open recovery attempt", {
      practice_id: practiceId,
    });
  }

  // 4. Create sync log entry
  const syncLogId = await createSyncLogEntry(
    supabase,
    practiceId,
    syncType,
    triggeredBy,
    breakerState.status
  );

  const ctx: SyncContext = {
    supabase,
    practiceId,
    fetcher: new FHIRFetcher(client),
    syncLogId,
    errors: [],
    recordsFetched: {},
    recordsCreated: 0,
    recordsUpdated: 0,
  };

  try {
    if (syncType === "full") {
      await runFullSync(ctx);
    } else {
      await runIncrementalSync(ctx, supabase, practiceId);
    }

    const status = ctx.errors.length > 0 ? "partial" : "completed";

    // Update sync log
    await completeSyncLog(supabase, syncLogId, status, ctx);

    // Update last successful sync timestamp
    if (status === "completed") {
      await updateLastSuccessfulSync(supabase, practiceId);
    }

    return {
      syncLogId,
      status,
      recordsFetched: ctx.recordsFetched,
      recordsCreated: ctx.recordsCreated,
      recordsUpdated: ctx.recordsUpdated,
      errors: ctx.errors,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg =
      error instanceof CircuitOpenError
        ? "Circuit breaker is open"
        : error instanceof Error
          ? error.message
          : "Unknown sync error";

    ctx.errors.push({ resource: "sync", error: errorMsg });
    await completeSyncLog(supabase, syncLogId, "failed", ctx);

    logger.error("Sync failed", {
      practice_id: practiceId,
      sync_type: syncType,
      error: errorMsg,
    });

    return {
      syncLogId,
      status: "failed",
      recordsFetched: ctx.recordsFetched,
      recordsCreated: ctx.recordsCreated,
      recordsUpdated: ctx.recordsUpdated,
      errors: ctx.errors,
      durationMs: Date.now() - startTime,
    };
  }
}

// ---------------------------------------------------------------------------
// Full sync — onboarding, fetches everything
// ---------------------------------------------------------------------------

async function runFullSync(ctx: SyncContext): Promise<void> {
  logger.info("Starting full sync", { practice_id: ctx.practiceId });

  // 1. Fetch and upsert practitioners
  await syncPractitioners(ctx);

  // 2. Fetch and upsert patients
  await syncPatients(ctx);

  // 3. Fetch and merge coverage into patients
  await syncCoverage(ctx);

  // 4. Fetch and upsert appointments (next 30 days)
  const today = new Date().toISOString().substring(0, 10);
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 10);
  await syncAppointments(ctx, today, thirtyDays);
}

// ---------------------------------------------------------------------------
// Incremental sync — only changed appointments
// ---------------------------------------------------------------------------

async function runIncrementalSync(
  ctx: SyncContext,
  supabase: SupabaseClient,
  practiceId: string
): Promise<void> {
  logger.info("Starting incremental sync", { practice_id: practiceId });

  // Get last successful sync timestamp
  const { data: syncState } = await supabase
    .from("practice_sync_state")
    .select("last_successful_sync_at")
    .eq("practice_id", practiceId)
    .single();

  const lastSync = syncState?.last_successful_sync_at;

  // Fetch appointments from last sync (or last 24 hours if no prior sync)
  const since = lastSync
    ? new Date(lastSync).toISOString().substring(0, 10)
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .substring(0, 10);

  await syncAppointments(ctx, since, thirtyDays);

  // Also refresh coverage for any patients with appointments
  await syncCoverage(ctx);
}

// ---------------------------------------------------------------------------
// Resource sync functions
// ---------------------------------------------------------------------------

async function syncPractitioners(ctx: SyncContext): Promise<void> {
  try {
    const fhirPractitioners = await ctx.fetcher.fetchPractitioners();
    ctx.recordsFetched.practitioners = fhirPractitioners.length;

    // Practitioners aren't stored in a table yet — just log for now.
    // PR 3 will add a practitioners table if needed.
    logger.info("Fetched practitioners", {
      practice_id: ctx.practiceId,
      count: fhirPractitioners.length,
      practitioners: fhirPractitioners.map((p) => mapPractitioner(p)).map((p) => ({
        id: p.modmed_practitioner_id,
        name: p.display_name,
        specialty: p.specialty,
      })),
    });
  } catch (error) {
    ctx.errors.push({
      resource: "Practitioner",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function syncPatients(ctx: SyncContext): Promise<void> {
  try {
    const fhirPatients = await ctx.fetcher.fetchPatients();
    ctx.recordsFetched.patients = fhirPatients.length;

    for (const fhirPatient of fhirPatients) {
      try {
        const mapped = mapPatient(fhirPatient, ctx.practiceId);

        const { data: existing } = await ctx.supabase
          .from("patients")
          .select("id")
          .eq("practice_id", ctx.practiceId)
          .eq("modmed_patient_id", mapped.modmed_patient_id)
          .single();

        if (existing) {
          await ctx.supabase
            .from("patients")
            .update({
              name_encrypted: mapped.name_encrypted,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          ctx.recordsUpdated++;
        } else {
          await ctx.supabase.from("patients").insert({
            ...mapped,
            last_synced_at: new Date().toISOString(),
          });
          ctx.recordsCreated++;
        }
      } catch (error) {
        ctx.errors.push({
          resource: "Patient",
          id: fhirPatient.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    ctx.errors.push({
      resource: "Patient",
      error: error instanceof Error ? error.message : "Fetch failed",
    });
  }
}

async function syncCoverage(ctx: SyncContext): Promise<void> {
  try {
    const fhirCoverages = await ctx.fetcher.fetchAllCoverage();
    ctx.recordsFetched.coverage = fhirCoverages.length;

    // Group coverages by patient
    const coverageByPatient = new Map<string, typeof fhirCoverages>();
    for (const cov of fhirCoverages) {
      const patientRef = cov.beneficiary?.reference;
      if (!patientRef) continue;
      const patientId = patientRef.replace("Patient/", "");
      const existing = coverageByPatient.get(patientId) ?? [];
      existing.push(cov);
      coverageByPatient.set(patientId, existing);
    }

    // Update each patient with their primary coverage
    for (const [modmedPatientId, coverages] of coverageByPatient) {
      const primaryCov = pickPrimaryCoverage(coverages);
      if (!primaryCov) continue;

      const mapped = mapCoverage(primaryCov);

      await ctx.supabase
        .from("patients")
        .update({
          insurance_payer: mapped.insurance_payer,
          plan_id: mapped.plan_id,
          plan_type: mapped.plan_type,
          last_synced_at: new Date().toISOString(),
        })
        .eq("practice_id", ctx.practiceId)
        .eq("modmed_patient_id", modmedPatientId);
    }
  } catch (error) {
    ctx.errors.push({
      resource: "Coverage",
      error: error instanceof Error ? error.message : "Fetch failed",
    });
  }
}

async function syncAppointments(
  ctx: SyncContext,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  try {
    const fhirAppointments = await ctx.fetcher.fetchAppointments(dateFrom, dateTo);
    ctx.recordsFetched.appointments = fhirAppointments.length;

    for (const fhirAppt of fhirAppointments) {
      try {
        const mapped = mapAppointment(fhirAppt, ctx.practiceId);

        // Skip appointments without a patient reference
        if (!mapped.modmed_patient_id) continue;

        // Resolve patient_id from modmed_patient_id
        const { data: patient } = await ctx.supabase
          .from("patients")
          .select("id")
          .eq("practice_id", ctx.practiceId)
          .eq("modmed_patient_id", mapped.modmed_patient_id)
          .single();

        if (!patient) {
          ctx.errors.push({
            resource: "Appointment",
            id: fhirAppt.id,
            error: `Patient not found: modmed_patient_id=${mapped.modmed_patient_id}`,
          });
          continue;
        }

        const { data: existing } = await ctx.supabase
          .from("appointments")
          .select("id")
          .eq("practice_id", ctx.practiceId)
          .eq("modmed_appointment_id", mapped.modmed_appointment_id)
          .single();

        if (existing) {
          await ctx.supabase
            .from("appointments")
            .update({
              provider_id: mapped.provider_id,
              appointment_date: mapped.appointment_date,
              cpt_codes: mapped.cpt_codes,
              icd10_codes: mapped.icd10_codes,
            })
            .eq("id", existing.id);
          ctx.recordsUpdated++;
        } else {
          await ctx.supabase.from("appointments").insert({
            practice_id: ctx.practiceId,
            patient_id: patient.id,
            modmed_appointment_id: mapped.modmed_appointment_id,
            provider_id: mapped.provider_id,
            appointment_date: mapped.appointment_date,
            cpt_codes: mapped.cpt_codes,
            icd10_codes: mapped.icd10_codes,
            pa_status: "not_needed", // Will be updated by PA detection
          });
          ctx.recordsCreated++;
        }
      } catch (error) {
        ctx.errors.push({
          resource: "Appointment",
          id: fhirAppt.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    ctx.errors.push({
      resource: "Appointment",
      error: error instanceof Error ? error.message : "Fetch failed",
    });
  }
}

// ---------------------------------------------------------------------------
// Sync log helpers
// ---------------------------------------------------------------------------

async function createSyncLogEntry(
  supabase: SupabaseClient,
  practiceId: string,
  syncType: SyncType,
  triggeredBy: SyncTrigger,
  breakerState: string
): Promise<string> {
  const { data, error } = await supabase
    .from("modmed_sync_log")
    .insert({
      practice_id: practiceId,
      sync_type: syncType,
      status: "running",
      triggered_by: triggeredBy,
      breaker_state: breakerState,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("Failed to create sync log entry", { error: error?.message });
    return "unknown";
  }

  return data.id;
}

async function completeSyncLog(
  supabase: SupabaseClient,
  syncLogId: string,
  status: "completed" | "failed" | "partial",
  ctx: SyncContext
): Promise<void> {
  if (syncLogId === "unknown") return;

  await supabase
    .from("modmed_sync_log")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_fetched: ctx.recordsFetched,
      records_created: ctx.recordsCreated,
      records_updated: ctx.recordsUpdated,
      errors: ctx.errors.length > 0 ? ctx.errors : null,
    })
    .eq("id", syncLogId);
}

async function updateLastSuccessfulSync(
  supabase: SupabaseClient,
  practiceId: string
): Promise<void> {
  await supabase
    .from("practice_sync_state")
    .upsert(
      {
        practice_id: practiceId,
        last_successful_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "practice_id" }
    );
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

async function loadModMedConfig(
  supabase: SupabaseClient,
  practiceId: string
): Promise<ModMedClientConfig | null> {
  const { data: practice } = await supabase
    .from("practices")
    .select("modmed_url_prefix, modmed_credentials")
    .eq("id", practiceId)
    .single();

  if (!practice?.modmed_url_prefix || !practice?.modmed_credentials) {
    return null;
  }

  const creds = practice.modmed_credentials as Record<string, string>;

  return {
    firmUrlPrefix: practice.modmed_url_prefix,
    username: creds.username ?? "",
    password: creds.password ?? "",
    apiKey: creds.api_key ?? "",
    authBaseUrl: creds.auth_base_url ?? "https://stage.ema-api.com/ema-dev",
  };
}
