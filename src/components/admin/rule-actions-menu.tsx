"use client";

import { useState } from "react";

interface RuleActionsMenuProps {
  ruleId: string;
  ruleType: "drug" | "procedure";
  isDeleted: boolean;
  editHref: string;
  onSoftDelete: (ruleId: string, reason: string) => Promise<void>;
  onRestore: (ruleId: string, reason: string) => Promise<void>;
}

export function RuleActionsMenu({
  ruleId,
  isDeleted,
  editHref,
  onSoftDelete,
  onRestore,
}: RuleActionsMenuProps) {
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"delete" | "restore" | null>(null);

  async function handleConfirm() {
    if (!reason.trim() || !action) return;
    setLoading(true);
    try {
      if (action === "delete") {
        await onSoftDelete(ruleId, reason);
      } else {
        await onRestore(ruleId, reason);
      }
    } finally {
      setLoading(false);
      setShowReasonInput(false);
      setReason("");
      setAction(null);
    }
  }

  if (showReasonInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for this change..."
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
          autoFocus
        />
        <button
          onClick={handleConfirm}
          disabled={!reason.trim() || loading}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => {
            setShowReasonInput(false);
            setAction(null);
          }}
          className="text-xs text-zinc-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!isDeleted && (
        <>
          <a
            href={editHref}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Edit
          </a>
          <button
            onClick={() => {
              setAction("delete");
              setShowReasonInput(true);
            }}
            className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete
          </button>
        </>
      )}
      {isDeleted && (
        <button
          onClick={() => {
            setAction("restore");
            setShowReasonInput(true);
          }}
          className="text-xs font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
        >
          Restore
        </button>
      )}
    </div>
  );
}
