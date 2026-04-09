import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StagedRuleReviewForm } from "@/components/admin/policy-watch/staged-rule-review-form";
import type { StagedRuleKind } from "@/lib/types";

interface Props {
  params: Promise<{ documentId: string; stagedRuleId: string }>;
}

export default async function ReviewStagedRulePage({ params }: Props) {
  const { documentId, stagedRuleId } = await params;
  const supabase = await createClient();

  const { data: staged } = await supabase
    .from("policy_watch_staged_rules")
    .select("*, policy_watch_documents!inner(source_url)")
    .eq("id", stagedRuleId)
    .single();

  if (!staged || staged.status !== "pending_review") notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/admin/policy-watch/${documentId}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; Back to document
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Review{" "}
        {staged.rule_kind === "drug" ? "Drug" : "Procedure"} Rule
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: editable form (2/3 width) */}
        <div className="lg:col-span-2">
          <StagedRuleReviewForm
            stagedRuleId={stagedRuleId}
            documentId={documentId}
            ruleKind={staged.rule_kind as StagedRuleKind}
            extractedData={staged.extracted_data as Record<string, unknown>}
          />
        </div>

        {/* Right: source excerpt (1/3 width) */}
        <div>
          <div className="sticky top-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Source Excerpt</h3>
            {staged.source_excerpt ? (
              <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {staged.source_excerpt}
              </blockquote>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No excerpt available.</p>
            )}

            <div className="mt-4">
              <h3 className="text-sm font-semibold">Source Document</h3>
              <a
                href={staged.policy_watch_documents.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Open policy document
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
