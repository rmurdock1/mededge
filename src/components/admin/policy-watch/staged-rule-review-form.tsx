"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewStagedRule } from "@/lib/policy-watch/actions";
import type { StagedRuleKind } from "@/lib/types";

interface Props {
  stagedRuleId: string;
  documentId: string;
  ruleKind: StagedRuleKind;
  extractedData: Record<string, unknown>;
}

/**
 * Full review form that pre-fills fields from extracted_data.
 * The admin can edit any field before approving.
 */
export function StagedRuleReviewForm({
  stagedRuleId,
  documentId,
  ruleKind,
  extractedData,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jsonText, setJsonText] = useState(
    JSON.stringify(extractedData, null, 2)
  );

  async function handleApprove() {
    setLoading(true);
    setError("");

    let editedData: Record<string, unknown>;
    try {
      editedData = JSON.parse(jsonText);
    } catch {
      setError("Invalid JSON. Please fix the syntax and try again.");
      setLoading(false);
      return;
    }

    const result = await reviewStagedRule({
      staged_rule_id: stagedRuleId,
      action: "approve",
      edited_data: editedData,
    });

    if (!result.success) {
      setError(result.error ?? "Approval failed");
      setLoading(false);
      return;
    }

    router.push(`/admin/policy-watch/${documentId}`);
    router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    setError("");

    const result = await reviewStagedRule({
      staged_rule_id: stagedRuleId,
      action: "reject",
      review_notes: "Rejected during edit review",
    });

    if (!result.success) {
      setError(result.error ?? "Rejection failed");
      setLoading(false);
      return;
    }

    router.push(`/admin/policy-watch/${documentId}`);
    router.refresh();
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError("");
    } catch {
      setError("Cannot format — invalid JSON");
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {ruleKind === "drug" ? "Drug" : "Procedure"} Rule Data
        </h2>
        <button
          type="button"
          onClick={handleFormat}
          className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
        >
          Format JSON
        </button>
      </div>

      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows={28}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
      />

      <p className="mt-2 text-xs text-zinc-500">
        Edit the JSON above to correct any extraction errors before approving.
        The system will add: source_url, confidence_score (0.7),
        last_verified_date, and change_reason.
      </p>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Approve & Create Rule"}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
