import { createClient } from "@/lib/supabase/server";
import { AUDIT_SOURCES, AUDIT_ACTIONS } from "@/lib/admin/schemas";
import type { RuleAuditLogEntry } from "@/lib/types";

interface SearchParams {
  source?: string;
  action?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("rule_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.source) {
    query = query.eq("source", params.source);
  }
  if (params.action) {
    query = query.eq("action", params.action);
  }

  const { data, count } = await query;
  const entries = (data ?? []) as RuleAuditLogEntry[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (params.source) p.set("source", params.source);
    if (params.action) p.set("action", params.action);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Immutable history of all payer rule changes ({count ?? 0} total entries)
        </p>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Source:
          <select
            name="source"
            defaultValue={params.source ?? ""}
            className="ml-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="">All</option>
            {AUDIT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Action:
          <select
            name="action"
            defaultValue={params.action ?? ""}
            className="ml-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No audit entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="pb-2 pr-3">Time</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 pr-3">Rule Type</th>
                <th className="pb-2 pr-3">Changed Fields</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-2 pr-3 text-zinc-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{entry.source}</td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {entry.drug_rule_id ? "Drug" : "Procedure"}
                  </td>
                  <td className="py-2 pr-3">
                    {entry.changed_fields ? (
                      <span className="font-mono text-xs text-zinc-500">
                        {entry.changed_fields.join(", ")}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="max-w-sm truncate py-2 text-zinc-600 dark:text-zinc-400">
                    {entry.change_reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <a
              href={buildUrl({ page: String(page - 1) })}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Previous
            </a>
          )}
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={buildUrl({ page: String(page + 1) })}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    insert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    soft_delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    restore: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    delete: "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[action] ?? "bg-zinc-100 text-zinc-800"
      }`}
    >
      {action}
    </span>
  );
}
