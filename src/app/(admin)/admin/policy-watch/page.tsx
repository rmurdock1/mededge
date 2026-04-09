import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DocumentStatusBadge } from "@/components/admin/policy-watch/document-status-badge";
import type { PolicyWatchDocumentStatus } from "@/lib/types";

export default async function PolicyWatchPage() {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("policy_watch_documents")
    .select("id, source_url, payer_name_hint, status, created_at, claude_input_tokens, claude_output_tokens")
    .order("created_at", { ascending: false })
    .limit(50);

  // Count pending reviews
  const { count: pendingCount } = await supabase
    .from("policy_watch_staged_rules")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policy Watch</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Extract PA rules from payer coverage policy documents using AI.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(pendingCount ?? 0) > 0 && (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {pendingCount} pending review
            </span>
          )}
          <Link
            href="/admin/policy-watch/ingest"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Ingest Document
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {!documents || documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              No documents ingested yet. Click &quot;Ingest Document&quot; to extract rules from a payer coverage policy.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Payer Hint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/policy-watch/${doc.id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {truncateUrl(doc.source_url)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {doc.payer_name_hint ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge
                        status={doc.status as PolicyWatchDocumentStatus}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-zinc-500">
                      {doc.claude_input_tokens != null
                        ? `${(doc.claude_input_tokens + (doc.claude_output_tokens ?? 0)).toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}
