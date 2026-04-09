import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DocumentStatusBadge } from "@/components/admin/policy-watch/document-status-badge";
import { ExtractionConfidenceBadge } from "@/components/admin/policy-watch/extraction-confidence-badge";
import { StagedRuleActions } from "@/components/admin/policy-watch/staged-rule-actions";
import type {
  PolicyWatchDocumentStatus,
  StagedRuleStatus,
  StagedRuleKind,
  ExtractionConfidence,
} from "@/lib/types";

interface Props {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentDetailPage({ params }: Props) {
  const { documentId } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("policy_watch_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (!doc) notFound();

  const { data: stagedRules } = await supabase
    .from("policy_watch_staged_rules")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  const pending = (stagedRules ?? []).filter(
    (r) => r.status === "pending_review"
  );
  const approved = (stagedRules ?? []).filter((r) => r.status === "approved");
  const rejected = (stagedRules ?? []).filter((r) => r.status === "rejected");

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/policy-watch"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; Back to Policy Watch
        </Link>
      </div>

      {/* Document header */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {doc.payer_name_hint ?? "Coverage Policy"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 break-all">{doc.source_url}</p>
          </div>
          <DocumentStatusBadge
            status={doc.status as PolicyWatchDocumentStatus}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Plan Type Hint</dt>
            <dd className="font-medium">{doc.plan_type_hint ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Model</dt>
            <dd className="font-medium">{doc.claude_model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tokens</dt>
            <dd className="font-medium tabular-nums">
              {doc.claude_input_tokens != null
                ? `${doc.claude_input_tokens.toLocaleString()} in / ${(doc.claude_output_tokens ?? 0).toLocaleString()} out`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ingested</dt>
            <dd className="font-medium">
              {new Date(doc.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>

        {doc.extraction_error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <strong>Extraction error:</strong> {doc.extraction_error}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Pending Review" count={pending.length} color="purple" />
        <StatCard label="Approved" count={approved.length} color="green" />
        <StatCard label="Rejected" count={rejected.length} color="red" />
      </div>

      {/* Staged rules */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Extracted Rules</h2>

        {!stagedRules || stagedRules.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No rules extracted from this document.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {(stagedRules ?? []).map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          rule.rule_kind === "drug"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        }`}
                      >
                        {(rule.rule_kind as StagedRuleKind).toUpperCase()}
                      </span>
                      <ExtractionConfidenceBadge
                        confidence={rule.extraction_confidence as ExtractionConfidence}
                      />
                      <StatusBadge status={rule.status as StagedRuleStatus} />
                    </div>

                    <div className="mt-2">
                      <p className="text-sm font-medium">
                        {getRuleName(rule.extracted_data, rule.rule_kind as StagedRuleKind)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(rule.extracted_data as Record<string, unknown>).payer_name as string}
                        {" / "}
                        {(rule.extracted_data as Record<string, unknown>).plan_type as string}
                        {" — PA "}
                        {(rule.extracted_data as Record<string, unknown>).pa_required
                          ? "Required"
                          : "Not Required"}
                      </p>
                    </div>

                    {rule.source_excerpt && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700">
                          Source excerpt
                        </summary>
                        <blockquote className="mt-1 border-l-2 border-zinc-300 pl-3 text-xs italic text-zinc-500 dark:border-zinc-700">
                          {rule.source_excerpt}
                        </blockquote>
                      </details>
                    )}

                    {rule.review_notes && (
                      <p className="mt-2 text-xs text-zinc-500">
                        <span className="font-medium">Review notes:</span>{" "}
                        {rule.review_notes}
                      </p>
                    )}
                  </div>

                  {rule.status === "pending_review" && (
                    <StagedRuleActions
                      stagedRuleId={rule.id}
                      documentId={documentId}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getRuleName(
  data: Record<string, unknown> | unknown,
  kind: StagedRuleKind
): string {
  const d = data as Record<string, unknown>;
  if (kind === "drug") {
    return (d.drug_name as string) ?? (d.hcpcs_code as string) ?? "Unknown Drug";
  }
  return (
    (d.procedure_name as string) ?? (d.cpt_code as string) ?? "Unknown Procedure"
  );
}

function StatusBadge({ status }: { status: StagedRuleStatus }) {
  const styles: Record<StagedRuleStatus, string> = {
    pending_review:
      "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
    approved:
      "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    rejected:
      "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "purple" | "green" | "red";
}) {
  const colors = {
    purple: "text-purple-600 dark:text-purple-400",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${colors[color]}`}>
        {count}
      </p>
    </div>
  );
}
