"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DocumentationItem } from "@/lib/types";

export async function toggleChecklistItem(
  paId: string,
  itemIndex: number,
  completed: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: pa } = await supabase
    .from("prior_auths")
    .select("documentation_checklist")
    .eq("id", paId)
    .single();

  if (!pa) return { error: "PA not found" };

  const checklist = (pa.documentation_checklist ?? []) as DocumentationItem[];
  if (itemIndex < 0 || itemIndex >= checklist.length) {
    return { error: "Invalid checklist index" };
  }

  const existing = checklist[itemIndex]!;
  checklist[itemIndex] = {
    item: existing.item,
    required: existing.required,
    description: existing.description,
    completed,
  };

  const { error } = await supabase
    .from("prior_auths")
    .update({ documentation_checklist: checklist })
    .eq("id", paId);

  if (error) return { error: "Failed to update checklist" };

  revalidatePath(`/prior-auths/${paId}`);
  return {};
}

export async function updatePAStatus(
  paId: string,
  newStatus: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = { status: newStatus };

  // Set timestamps based on status transitions
  if (newStatus === "submitted") {
    updates.submitted_date = new Date().toISOString();
  } else if (newStatus === "approved" || newStatus === "denied") {
    updates.decision_date = new Date().toISOString();
  }

  const { error } = await supabase
    .from("prior_auths")
    .update(updates)
    .eq("id", paId);

  if (error) return { error: "Failed to update status" };

  // Log the action
  await supabase.from("pa_activity_log").insert({
    prior_auth_id: paId,
    action: `Status changed to ${newStatus}`,
    details: `Status updated by staff member`,
    user_id: user.id,
  });

  revalidatePath(`/prior-auths/${paId}`);
  revalidatePath("/prior-auths");
  revalidatePath("/dashboard");
  return {};
}

export async function addPANote(
  paId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Append to existing notes
  const { data: pa } = await supabase
    .from("prior_auths")
    .select("notes")
    .eq("id", paId)
    .single();

  if (!pa) return { error: "PA not found" };

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const newNote = `[${timestamp}] ${note}`;
  const updatedNotes = pa.notes ? `${pa.notes}\n${newNote}` : newNote;

  const { error } = await supabase
    .from("prior_auths")
    .update({ notes: updatedNotes })
    .eq("id", paId);

  if (error) return { error: "Failed to add note" };

  // Log
  await supabase.from("pa_activity_log").insert({
    prior_auth_id: paId,
    action: "Note added",
    details: note.length > 80 ? `${note.substring(0, 80)}...` : note,
    user_id: user.id,
  });

  revalidatePath(`/prior-auths/${paId}`);
  return {};
}
