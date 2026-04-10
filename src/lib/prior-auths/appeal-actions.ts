"use server";

import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/claude/client";
import {
  buildAppealPrompt,
  classifyDenialReason,
} from "@/lib/claude/prompts/appeals/generate-appeal";
import { revalidatePath } from "next/cache";
import type { DocumentationItem } from "@/lib/types";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export async function generateAppealLetter(
  paId: string
): Promise<{ error?: string; letter?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Fetch PA with patient + appointment data
  const { data: pa } = await supabase
    .from("prior_auths")
    .select(
      `
      *,
      patients!inner(insurance_payer, plan_type),
      appointments(cpt_codes, icd10_codes)
    `
    )
    .eq("id", paId)
    .single();

  if (!pa) return { error: "Prior authorization not found" };

  if (!pa.denial_reason) {
    return { error: "No denial reason recorded. Add a denial reason first." };
  }

  // Extract codes from appointment if available
  const appointment = pa.appointments as unknown as {
    cpt_codes: string[];
    icd10_codes: string[];
  } | null;

  const diagnosisCodes = appointment?.icd10_codes ?? [];
  const procedureCodes = appointment?.cpt_codes ?? [];
  const checklist = (pa.documentation_checklist ?? []) as DocumentationItem[];

  // Classify the denial
  const denialCategory = classifyDenialReason(pa.denial_reason);

  // Build prompt (PHI-safe — no patient names, DOBs, or member IDs)
  const { system, user: userMessage } = buildAppealPrompt({
    payerName: pa.payer_name,
    procedureOrMedication: pa.procedure_or_medication,
    denialReason: pa.denial_reason,
    denialCategory,
    diagnosisCodes,
    procedureCodes,
    documentationChecklist: checklist.map((c) => ({
      item: c.item,
      completed: c.completed ?? false,
      required: c.required,
    })),
    priorAuthId: pa.id,
  });

  // Call Claude API
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Claude returned an empty response. Please try again." };
    }

    const letter = textBlock.text;

    // Store the draft letter and update status
    const { error: updateError } = await supabase
      .from("prior_auths")
      .update({
        appeal_letter: letter,
        status: "appeal_draft",
      })
      .eq("id", paId);

    if (updateError) return { error: "Failed to save appeal letter" };

    // Log the action
    await supabase.from("pa_activity_log").insert({
      prior_auth_id: paId,
      action: "Appeal letter generated",
      details: `AI-generated appeal for ${denialCategory.replace(/_/g, " ")} denial (${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens)`,
      user_id: user.id,
    });

    revalidatePath(`/prior-auths/${paId}`);
    revalidatePath("/prior-auths");
    revalidatePath("/dashboard");

    return { letter };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling Claude API";
    return { error: `Appeal generation failed: ${message}` };
  }
}

export async function saveAppealLetter(
  paId: string,
  letter: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("prior_auths")
    .update({ appeal_letter: letter })
    .eq("id", paId);

  if (error) return { error: "Failed to save appeal letter" };

  await supabase.from("pa_activity_log").insert({
    prior_auth_id: paId,
    action: "Appeal letter edited",
    details: "Staff manually edited the appeal letter",
    user_id: user.id,
  });

  revalidatePath(`/prior-auths/${paId}`);
  return {};
}

export async function recordAppealOutcome(
  paId: string,
  outcome: "appeal_approved" | "appeal_denied",
  revenueRecovered?: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Update PA status
  const updates: Record<string, unknown> = {
    status: outcome,
    decision_date: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("prior_auths")
    .update(updates)
    .eq("id", paId);

  if (error) return { error: "Failed to update appeal outcome" };

  // If approved, try to record in pa_outcomes for network intelligence
  if (outcome === "appeal_approved") {
    const { data: pa } = await supabase
      .from("prior_auths")
      .select(
        "practice_id, payer_name, procedure_or_medication, appointments(cpt_codes)"
      )
      .eq("id", paId)
      .single();

    if (pa) {
      const appointment = pa.appointments as unknown as {
        cpt_codes: string[];
      } | null;

      await supabase.from("pa_outcomes").insert({
        practice_id: pa.practice_id,
        payer_name: pa.payer_name,
        plan_type: "Commercial", // Default; will be enriched later
        cpt_code: appointment?.cpt_codes?.[0] ?? "unknown",
        documentation_included: [],
        outcome: "denied", // Original was denied
        appeal_outcome: "approved",
        turnaround_days: null,
      });
    }
  }

  // Log the action
  const actionLabel =
    outcome === "appeal_approved" ? "Appeal approved" : "Appeal denied";
  const revenueNote =
    revenueRecovered != null
      ? ` — $${revenueRecovered.toLocaleString()} recovered`
      : "";

  await supabase.from("pa_activity_log").insert({
    prior_auth_id: paId,
    action: actionLabel,
    details: `${actionLabel}${revenueNote}`,
    user_id: user.id,
  });

  revalidatePath(`/prior-auths/${paId}`);
  revalidatePath("/prior-auths");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {};
}
