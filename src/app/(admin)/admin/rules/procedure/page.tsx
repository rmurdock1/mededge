import { createClient } from "@/lib/supabase/server";
import { ConfidenceBadge } from "@/components/admin/confidence-badge";
import { ProcedureRuleListActions } from "@/components/admin/procedure-rule-list-actions";
import Link from "next/link";
import type { PayerRuleProcedure } from "@/lib/types";

interface SearchParams {
  payer_name?: string;
  plan_type?: string;
  show_deleted?: string;
}

export default async function ProcedureRulesListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const showDeleted = params.show_deleted === "true";

  let query = supabase
    .from("payer_rules_procedure")
    .select("*")
    .order("last_verified_date", { ascending: true, nullsFirst: true });

  if (!showDeleted) {
    query = query.is("deleted_at", null);
  }
  if (params.payer_name) {
    query = query.eq("payer_name", params.payer_name);
  }
  if (params.plan_type) {
    query = query.eq("plan_type", params.plan_type);
  }

  const { data: rules } = await query;
  const procRules = (rules ?? []) as PayerRuleProcedure[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Procedure Rules
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            PA rules for procedures identified by CPT code (Mohs, phototherapy, etc.)
          </p>
        </div>
        <Link
          href="/admin/rules/procedure/new"
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add Procedure Rule
        </Link>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3">
        <input
          name="payer_name"
          defaultValue={params.payer_name ?? ""}
          placeholder="Filter by payer..."
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <input
          name="plan_type"
          defaultValue={params.plan_type ?? ""}
          placeholder="Filter by plan type..."
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            name="show_deleted"
            value="true"
            defaultChecked={showDeleted}
          />
          Show deleted
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      {procRules.length === 0 ? (
        <p className="text-sm text-zinc-500">No procedure rules found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="pb-2 pr-3">Procedure</th>
                <th className="pb-2 pr-3">CPT</th>
                <th className="pb-2 pr-3">Payer</th>
                <th className="pb-2 pr-3">Plan</th>
                <th className="pb-2 pr-3">PA Req</th>
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2 pr-3">Verified</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {procRules.map((rule) => {
                const isDeleted = rule.deleted_at !== null;
                return (
                  <tr
                    key={rule.id}
                    className={`border-b border-zinc-100 dark:border-zinc-800 ${
                      isDeleted
                        ? "text-zinc-400 line-through opacity-60 dark:text-zinc-600"
                        : ""
                    }`}
                  >
                    <td className="py-2 pr-3 font-medium">{rule.procedure_name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{rule.cpt_code}</td>
                    <td className="py-2 pr-3">{rule.payer_name}</td>
                    <td className="py-2 pr-3">{rule.plan_type}</td>
                    <td className="py-2 pr-3">
                      {rule.pa_required ? (
                        <span className="text-red-600 dark:text-red-400">Yes</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">No</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <ConfidenceBadge score={rule.confidence_score} />
                    </td>
                    <td className="py-2 pr-3 text-zinc-500">
                      {rule.last_verified_date}
                    </td>
                    <td className="py-2">
                      <ProcedureRuleListActions
                        ruleId={rule.id}
                        isDeleted={isDeleted}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
