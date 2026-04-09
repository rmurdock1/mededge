"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewStagedRule } from "@/lib/policy-watch/actions";

export function StagedRuleActions({
  stagedRuleId,
  documentId,
}: {
  stagedRuleId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");

    const result = await reviewStagedRule({
      staged_rule_id: stagedRuleId,
      action: "approve",
    });

    if (!result.success) {
      setError(result.error ?? "Approval failed");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  async function handleReject() {
    if (!rejectNotes.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setLoading(true);
    setError("");

    const result = await reviewStagedRule({
      staged_rule_id: stagedRuleId,
      action: "reject",
      review_notes: rejectNotes,
    });

    if (!result.success) {
      setError(result.error ?? "Rejection failed");
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "..." : "Approve"}
        </button>
        <button
          onClick={() => setShowReject(!showReject)}
          disabled={loading}
          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
        >
          Reject
        </button>
        <a
          href={`/admin/policy-watch/${documentId}/review/${stagedRuleId}`}
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
        >
          Edit
        </a>
      </div>

      {showReject && (
        <div className="flex w-64 flex-col gap-2">
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Reason for rejection..."
            rows={2}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={handleReject}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Confirm Reject
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
