/**
 * Supabase-backed CircuitBreakerStore.
 *
 * Persists circuit breaker state in the `practice_sync_state` table
 * so it survives Vercel serverless cold starts.
 *
 * Uses the service role client (bypasses RLS) since the sync
 * orchestrator runs server-side.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CircuitBreakerStore } from "./circuit-breaker";
import type { CircuitBreakerState } from "./types";
import { DEFAULT_CIRCUIT_BREAKER_STATE } from "./types";

export class SupabaseCircuitBreakerStore implements CircuitBreakerStore {
  private readonly supabase: SupabaseClient;
  private readonly practiceId: string;

  constructor(supabase: SupabaseClient, practiceId: string) {
    this.supabase = supabase;
    this.practiceId = practiceId;
  }

  async getState(): Promise<CircuitBreakerState> {
    const { data, error } = await this.supabase
      .from("practice_sync_state")
      .select(
        "breaker_status, breaker_failure_count, breaker_last_failure_at, breaker_last_failure_error, breaker_opened_at"
      )
      .eq("practice_id", this.practiceId)
      .single();

    if (error || !data) {
      // No row yet — return default closed state
      return { ...DEFAULT_CIRCUIT_BREAKER_STATE };
    }

    return {
      status: data.breaker_status as CircuitBreakerState["status"],
      failure_count: data.breaker_failure_count,
      last_failure_at: data.breaker_last_failure_at,
      last_failure_error: data.breaker_last_failure_error,
      opened_at: data.breaker_opened_at,
    };
  }

  async setState(state: CircuitBreakerState): Promise<void> {
    const { error } = await this.supabase
      .from("practice_sync_state")
      .upsert(
        {
          practice_id: this.practiceId,
          breaker_status: state.status,
          breaker_failure_count: state.failure_count,
          breaker_last_failure_at: state.last_failure_at,
          breaker_last_failure_error: state.last_failure_error,
          breaker_opened_at: state.opened_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "practice_id" }
      );

    if (error) {
      // Log but don't throw — breaker state is best-effort
      // If the DB is down, the breaker should still work in-memory
      console.error("Failed to persist circuit breaker state:", error.message);
    }
  }
}
