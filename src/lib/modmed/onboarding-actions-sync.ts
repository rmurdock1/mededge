"use server";

import { createClient } from "@/lib/supabase/server";

export interface OnboardingSyncResult {
  error?: string;
  patientsCount?: number;
  appointmentsCount?: number;
  pasDetected?: number;
}

export async function runOnboardingSync(): Promise<OnboardingSyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to sync." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("practice_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "User profile not found." };
  }

  // Check if practice has ModMed credentials
  const { data: practice } = await supabase
    .from("practices")
    .select("modmed_url_prefix, modmed_credentials")
    .eq("id", profile.practice_id)
    .single();

  if (!practice?.modmed_url_prefix || !practice?.modmed_credentials) {
    return {
      error:
        "ModMed credentials not configured. Go back and connect your practice management system.",
    };
  }

  // For the demo/sandbox, simulate a sync by counting existing data
  // In production, this would call runSync() from the sync orchestrator
  // with the practice's credentials.
  //
  // The demo seed script pre-populates patients, appointments, and PAs
  // so this page shows realistic numbers without requiring a real ModMed
  // sandbox connection.

  const [patients, appointments, pas] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", profile.practice_id),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", profile.practice_id),
    supabase
      .from("prior_auths")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", profile.practice_id),
  ]);

  return {
    patientsCount: patients.count ?? 0,
    appointmentsCount: appointments.count ?? 0,
    pasDetected: pas.count ?? 0,
  };
}
