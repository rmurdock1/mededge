"use server";

import { createClient } from "@/lib/supabase/server";
import { toRpcAuditParams, type AuditContext } from "@/lib/audit-context";
import { getAnthropicClient } from "@/lib/claude/client";
import {
  buildExtractionPrompt,
  MAX_DOCUMENT_LENGTH,
} from "@/lib/claude/prompts/extract-rules";
import { parseExtractionResponse } from "./extraction";
import {
  drugRuleFormSchema,
  procedureRuleFormSchema,
} from "@/lib/admin/schemas";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/lib/admin/actions";

// ---------------------------------------------------------------------------
// Auth helper (same pattern as admin actions)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Action 1: Ingest a document
// ---------------------------------------------------------------------------

export interface IngestDocumentInput {
  source_url: string;
  source_text: string;
  payer_name_hint?: string;
  plan_type_hint?: string;
}

export async function ingestDocument(
  input: IngestDocumentInput
): Promise<ActionResult<{ document_id: string }>> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  if (!input.source_url.trim()) {
    return { success: false, error: "Source URL is required" };
  }
  if (!input.source_text.trim()) {
    return { success: false, error: "Document text is required" };
  }
  if (input.source_text.length > MAX_DOCUMENT_LENGTH) {
    return {
      success: false,
      error: `Document text exceeds ${MAX_DOCUMENT_LENGTH.toLocaleString()} character limit. Paste only the relevant sections.`,
    };
  }

  const { data, error } = await auth.supabase!
    .from("policy_watch_documents")
    .insert({
      source_url: input.source_url.trim(),
      source_text: input.source_text.trim(),
      payer_name_hint: input.payer_name_hint?.trim() || null,
      plan_type_hint: input.plan_type_hint?.trim() || null,
      uploaded_by: auth.userId!,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to ingest document", { error: error.message });
    return { success: false, error: error.message };
  }

  return { success: true, data: { document_id: data.id } };
}

// ---------------------------------------------------------------------------
// Action 2: Run extraction via Claude
// ---------------------------------------------------------------------------

export async function runExtraction(
  documentId: string
): Promise<
  ActionResult<{
    rules_count: number;
    skipped_count: number;
    payer_name: string | null;
  }>
> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  // Load the document
  const { data: doc, error: docErr } = await auth.supabase!
    .from("policy_watch_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docErr || !doc) {
    return { success: false, error: "Document not found" };
  }

  if (doc.status !== "pending_extraction" && doc.status !== "extraction_failed") {
    return {
      success: false,
      error: `Cannot extract from a document in status "${doc.status}"`,
    };
  }

  // Mark as extracting
  await auth.supabase!
    .from("policy_watch_documents")
    .update({
      status: "extracting",
      extraction_started_at: new Date().toISOString(),
      extraction_error: null,
    })
    .eq("id", documentId);

  try {
    // Build prompt
    const prompt = buildExtractionPrompt({
      documentText: doc.source_text,
      sourceUrl: doc.source_url,
      payerNameHint: doc.payer_name_hint ?? undefined,
      planTypeHint: doc.plan_type_hint ?? undefined,
    });

    // Call Claude
    const client = getAnthropicClient();
    const model = "claude-sonnet-4-20250514";

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const rawText =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "";

    // Parse and validate
    const result = parseExtractionResponse(rawText);

    // Store raw response and token counts
    await auth.supabase!
      .from("policy_watch_documents")
      .update({
        status: result.success ? "extracted" : "extraction_failed",
        extraction_completed_at: new Date().toISOString(),
        extraction_error: result.error ?? null,
        claude_model: model,
        claude_input_tokens: response.usage.input_tokens,
        claude_output_tokens: response.usage.output_tokens,
        raw_extraction_json: result.success ? JSON.parse(rawText) : { raw: rawText },
      })
      .eq("id", documentId);

    if (!result.success) {
      return { success: false, error: result.error ?? "Extraction failed" };
    }

    // Stage the extracted rules
    if (result.rules.length > 0) {
      const staged = result.rules.map((r) => ({
        document_id: documentId,
        rule_kind: r.rule_kind,
        extracted_data: r.extracted_data,
        source_excerpt: r.source_excerpt,
        extraction_confidence: r.extraction_confidence,
      }));

      const { error: stageErr } = await auth.supabase!
        .from("policy_watch_staged_rules")
        .insert(staged);

      if (stageErr) {
        logger.error("Failed to stage extracted rules", {
          error: stageErr.message,
        });
        return { success: false, error: stageErr.message };
      }
    }

    logger.info("Extraction complete", {
      documentId,
      rulesStaged: result.rules.length,
      rulesSkipped: result.skipped.length,
      payerName: result.payer_name,
    });

    return {
      success: true,
      data: {
        rules_count: result.rules.length,
        skipped_count: result.skipped.length,
        payer_name: result.payer_name,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown extraction error";
    logger.error("Extraction failed with exception", {
      documentId,
      error: message,
    });

    await auth.supabase!
      .from("policy_watch_documents")
      .update({
        status: "extraction_failed",
        extraction_completed_at: new Date().toISOString(),
        extraction_error: message,
      })
      .eq("id", documentId);

    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Action 3: Review a staged rule (approve or reject)
// ---------------------------------------------------------------------------

export interface ReviewDecision {
  staged_rule_id: string;
  action: "approve" | "reject";
  /** Edited rule data — if provided, replaces extracted_data on approval. */
  edited_data?: Record<string, unknown>;
  review_notes?: string;
}

export async function reviewStagedRule(
  decision: ReviewDecision
): Promise<ActionResult<{ production_rule_id?: string }>> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  // Load the staged rule
  const { data: staged, error: stagedErr } = await auth.supabase!
    .from("policy_watch_staged_rules")
    .select("*, policy_watch_documents!inner(source_url)")
    .eq("id", decision.staged_rule_id)
    .single();

  if (stagedErr || !staged) {
    return { success: false, error: "Staged rule not found" };
  }

  if (staged.status !== "pending_review") {
    return {
      success: false,
      error: `Cannot review a rule in status "${staged.status}"`,
    };
  }

  if (decision.action === "reject") {
    const { error } = await auth.supabase!
      .from("policy_watch_staged_rules")
      .update({
        status: "rejected",
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: decision.review_notes ?? null,
      })
      .eq("id", decision.staged_rule_id);

    if (error) return { success: false, error: error.message };

    await maybeCompleteDocument(auth.supabase!, staged.document_id);
    return { success: true };
  }

  // --- Approve flow ---

  const ruleData = decision.edited_data ?? staged.extracted_data;
  const sourceUrl = staged.policy_watch_documents.source_url;
  const today = new Date().toISOString().split("T")[0]!;

  // Build the form data with system-injected fields
  const formData = {
    ...ruleData,
    source_url: sourceUrl,
    source_document_excerpt: staged.source_excerpt,
    confidence_score: 0.7,
    last_verified_date: today,
    change_reason: `Policy Watch extraction from ${sourceUrl}, approved by admin`,
  };

  // Validate with the appropriate Zod schema
  const schema =
    staged.rule_kind === "drug" ? drugRuleFormSchema : procedureRuleFormSchema;
  const parsed = schema.safeParse(formData);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: `Validation failed: ${issues}`,
    };
  }

  // Write to production via the existing admin RPCs with audit_source='policy_watch'
  const { change_reason, ...payload } = parsed.data;
  const auditCtx: AuditContext = {
    actorUserId: auth.userId!,
    changeReason: change_reason,
    source: "policy_watch",
  };
  const auditParams = toRpcAuditParams(auditCtx);

  const rpcName =
    staged.rule_kind === "drug"
      ? "admin_upsert_drug_rule"
      : "admin_upsert_procedure_rule";

  const { data: rpcResult, error: rpcErr } = await auth.supabase!.rpc(
    rpcName,
    {
      p_payload: payload,
      ...auditParams,
    }
  );

  if (rpcErr) {
    logger.error("Failed to write approved rule to production", {
      error: rpcErr.message,
      stagedRuleId: decision.staged_rule_id,
    });
    return { success: false, error: rpcErr.message };
  }

  const productionRuleId = rpcResult as string;

  // Update the staged rule with approval info
  const updateData: Record<string, unknown> = {
    status: "approved",
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    review_notes: decision.review_notes ?? null,
  };

  if (staged.rule_kind === "drug") {
    updateData.production_drug_rule_id = productionRuleId;
  } else {
    updateData.production_procedure_rule_id = productionRuleId;
  }

  if (decision.edited_data) {
    updateData.extracted_data = decision.edited_data;
  }

  await auth.supabase!
    .from("policy_watch_staged_rules")
    .update(updateData)
    .eq("id", decision.staged_rule_id);

  await maybeCompleteDocument(auth.supabase!, staged.document_id);

  return { success: true, data: { production_rule_id: productionRuleId } };
}

// ---------------------------------------------------------------------------
// Action 4: Retry a failed extraction
// ---------------------------------------------------------------------------

export async function retryExtraction(
  documentId: string
): Promise<ActionResult> {
  const auth = await requireSuperAdmin();
  if (auth.error) return { success: false, error: auth.error };

  const { data: doc } = await auth.supabase!
    .from("policy_watch_documents")
    .select("status")
    .eq("id", documentId)
    .single();

  if (!doc || doc.status !== "extraction_failed") {
    return {
      success: false,
      error: "Can only retry documents with status extraction_failed",
    };
  }

  // Reset to pending
  await auth.supabase!
    .from("policy_watch_documents")
    .update({ status: "pending_extraction", extraction_error: null })
    .eq("id", documentId);

  return runExtraction(documentId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * If all staged rules for a document have been reviewed (approved or rejected),
 * update the document status to 'completed'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function maybeCompleteDocument(supabase: any, documentId: string) {
  const { data: pending } = await supabase
    .from("policy_watch_staged_rules")
    .select("id")
    .eq("document_id", documentId)
    .eq("status", "pending_review")
    .limit(1);

  if (!pending || pending.length === 0) {
    await supabase
      .from("policy_watch_documents")
      .update({ status: "completed" })
      .eq("id", documentId);
  }
}
