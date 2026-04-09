"use client";

import { useState } from "react";
import { triggerManualSync } from "@/lib/modmed/actions";

export function SyncTriggerButton({ practiceId }: { practiceId: string }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res = await triggerManualSync(practiceId);
      if (res.success) {
        setResult(
          `Sync ${res.data?.status}: ${res.data?.recordsCreated ?? 0} created, ${res.data?.recordsUpdated ?? 0} updated`
        );
      } else {
        setResult(`Error: ${res.error}`);
      }
    } catch {
      setResult("Sync failed unexpectedly");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync Now"}
      </button>
      {result && (
        <span className="text-xs text-zinc-500">{result}</span>
      )}
    </div>
  );
}
