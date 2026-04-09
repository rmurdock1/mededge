import type { PolicyWatchDocumentStatus } from "@/lib/types";

const STATUS_STYLES: Record<
  PolicyWatchDocumentStatus,
  { label: string; classes: string }
> = {
  pending_extraction: {
    label: "Pending Extraction",
    classes: "bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  extracting: {
    label: "Extracting…",
    classes: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400",
  },
  extracted: {
    label: "Awaiting Review",
    classes: "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400",
  },
  extraction_failed: {
    label: "Extraction Failed",
    classes: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400",
  },
  completed: {
    label: "Completed",
    classes: "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400",
  },
  archived: {
    label: "Archived",
    classes: "bg-zinc-50 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export function DocumentStatusBadge({
  status,
}: {
  status: PolicyWatchDocumentStatus;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${style.classes}`}
    >
      {style.label}
    </span>
  );
}
