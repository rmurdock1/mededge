import { createClient } from "@/lib/supabase/server";
import { SyncTriggerButton } from "@/components/admin/modmed-sync/sync-trigger-button";

export default async function ModMedSyncPage() {
  const supabase = await createClient();

  // Fetch recent sync logs
  const { data: syncLogs } = await supabase
    .from("modmed_sync_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);

  // Fetch practices with ModMed config
  const { data: practices } = await supabase
    .from("practices")
    .select("id, name, modmed_url_prefix, specialty")
    .not("modmed_url_prefix", "is", null);

  // Fetch sync state for all practices
  const { data: syncStates } = await supabase
    .from("practice_sync_state")
    .select("*");

  // Fetch unknown lookup stats
  const { data: unknownStats } = await supabase
    .from("pa_lookup_log")
    .select("code, payer_name, code_kind")
    .eq("lookup_result", "unknown")
    .limit(100);

  // Count unknowns by code
  const unknownCounts = new Map<string, { code: string; payer: string; kind: string; count: number }>();
  for (const row of unknownStats ?? []) {
    const key = `${row.payer_name}|${row.code}`;
    const existing = unknownCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      unknownCounts.set(key, {
        code: row.code,
        payer: row.payer_name,
        kind: row.code_kind,
        count: 1,
      });
    }
  }
  const topUnknowns = Array.from(unknownCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          ModMed Sync
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Appointment sync status and PA detection results
        </p>
      </div>

      {/* Circuit Breaker Banner */}
      {syncStates?.some((s) => s.breaker_status === "open") && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:border-red-600 dark:bg-red-950">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#9888;</span>
            <h3 className="font-semibold text-red-800 dark:text-red-200">
              Circuit Breaker OPEN
            </h3>
          </div>
          {syncStates
            .filter((s) => s.breaker_status === "open")
            .map((s) => {
              const practice = practices?.find((p) => p.id === s.practice_id);
              return (
                <div key={s.practice_id} className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>
                    <strong>{practice?.name ?? s.practice_id}</strong>: Opened at{" "}
                    {s.breaker_opened_at
                      ? new Date(s.breaker_opened_at).toLocaleString()
                      : "unknown"}
                  </p>
                  <p className="mt-1">
                    Last error: {s.breaker_last_failure_error ?? "unknown"}
                  </p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Recovery will be attempted on the next cron run (every 15 min).
                    {s.breaker_failure_count} consecutive failures.
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Connected Practices */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Connected Practices
        </h2>
        {!practices || practices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No practices have ModMed credentials configured.
          </p>
        ) : (
          <div className="space-y-3">
            {practices.map((practice) => {
              const state = syncStates?.find(
                (s) => s.practice_id === practice.id
              );
              return (
                <div
                  key={practice.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {practice.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Firm: {practice.modmed_url_prefix}
                      {practice.specialty ? ` | ${practice.specialty}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Last sync:{" "}
                      {state?.last_successful_sync_at
                        ? new Date(state.last_successful_sync_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <BreakerBadge status={state?.breaker_status ?? "closed"} />
                    <SyncTriggerButton practiceId={practice.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unknown Rules Report */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Unknown Rules Report
        </h2>
        <p className="mb-3 text-sm text-zinc-500">
          Top payer + code combinations where no rule exists. Add rules for these to improve PA detection.
        </p>
        {topUnknowns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No unknown lookups recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="pb-2 pr-4">Payer</th>
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {topUnknowns.map((u, i) => (
                <tr
                  key={i}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-2 pr-4 text-zinc-900 dark:text-zinc-100">
                    {u.payer}
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm">{u.code}</td>
                  <td className="py-2 pr-4 text-zinc-500">{u.kind}</td>
                  <td className="py-2">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {u.count}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Sync Logs */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Recent Sync Logs
        </h2>
        {!syncLogs || syncLogs.length === 0 ? (
          <p className="text-sm text-zinc-500">No sync runs recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-2 pr-4 text-zinc-900 dark:text-zinc-100">
                    {new Date(log.started_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-zinc-500">{log.sync_type}</td>
                  <td className="py-2 pr-4">
                    <SyncStatusBadge status={log.status} />
                  </td>
                  <td className="py-2 pr-4 text-zinc-500">
                    {log.triggered_by}
                  </td>
                  <td className="py-2 pr-4 text-zinc-500">
                    {log.records_created ?? 0}
                  </td>
                  <td className="py-2 text-zinc-500">
                    {log.records_updated ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    partial:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-800"}`}
    >
      {status}
    </span>
  );
}

function BreakerBadge({ status }: { status: string }) {
  if (status === "closed") {
    return (
      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        Connected
      </span>
    );
  }
  if (status === "half_open") {
    return (
      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Recovering
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
      Disconnected
    </span>
  );
}
