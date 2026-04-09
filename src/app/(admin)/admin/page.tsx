import { createClient } from "@/lib/supabase/server";
import { ConfidenceBadge } from "@/components/admin/confidence-badge";
import Link from "next/link";

interface ConfidenceTierCount {
  tier: string;
  count: number;
  className: string;
}

function classifyTiers(
  rules: Array<{ confidence_score: number }>
): ConfidenceTierCount[] {
  const tiers = { high: 0, medium: 0, low: 0, unverified: 0 };
  for (const r of rules) {
    if (r.confidence_score >= 0.9) tiers.high++;
    else if (r.confidence_score >= 0.8) tiers.medium++;
    else if (r.confidence_score >= 0.5) tiers.low++;
    else tiers.unverified++;
  }
  return [
    { tier: "High (>=90%)", count: tiers.high, className: "text-green-600 dark:text-green-400" },
    { tier: "Medium (80-89%)", count: tiers.medium, className: "text-yellow-600 dark:text-yellow-400" },
    { tier: "Low (50-79%)", count: tiers.low, className: "text-orange-600 dark:text-orange-400" },
    { tier: "Unverified (<50%)", count: tiers.unverified, className: "text-red-600 dark:text-red-400" },
  ];
}

function getOneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0] as string;
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const oneYearAgo = getOneYearAgo();

  // Parallel queries for dashboard stats
  const [drugResult, procResult, auditResult, staleDrugResult, staleProcResult] =
    await Promise.all([
      supabase
        .from("payer_rules_drug")
        .select("confidence_score")
        .is("deleted_at", null),
      supabase
        .from("payer_rules_procedure")
        .select("confidence_score")
        .is("deleted_at", null),
      supabase
        .from("rule_audit_log")
        .select("id, action, source, change_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("payer_rules_drug")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lt("last_verified_date", oneYearAgo),
      supabase
        .from("payer_rules_procedure")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lt("last_verified_date", oneYearAgo),
    ]);

  const drugRules = drugResult.data ?? [];
  const procRules = procResult.data ?? [];
  const allRules = [...drugRules, ...procRules];
  const tiers = classifyTiers(allRules);
  const recentAudit = auditResult.data ?? [];
  const staleDrugCount = staleDrugResult.count ?? 0;
  const staleProcCount = staleProcResult.count ?? 0;
  const staleTotal = staleDrugCount + staleProcCount;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Admin Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Rule management dashboard for MedEdge Operations
        </p>
      </div>

      {/* Rule counts by type */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Drug Rules" value={drugRules.length} href="/admin/rules/drug" />
        <StatCard label="Procedure Rules" value={procRules.length} href="/admin/rules/procedure" />
        <StatCard label="Total Rules" value={allRules.length} />
        <StatCard
          label="Stale (>1yr)"
          value={staleTotal}
          alert={staleTotal > 0}
        />
      </div>

      {/* Confidence tier breakdown */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Confidence Tiers
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <p className="text-sm text-zinc-500">{t.tier}</p>
              <p className={`mt-1 text-2xl font-bold ${t.className}`}>
                {t.count}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent audit activity */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Audit Activity
          </h2>
          <Link
            href="/admin/audit"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            View all
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No audit entries yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-2 pr-4">
                    <ConfidenceBadge score={0} />
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {entry.action}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-zinc-500">{entry.source}</td>
                  <td className="max-w-xs truncate py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {entry.change_reason ?? "—"}
                  </td>
                  <td className="py-2 text-zinc-500">
                    {new Date(entry.created_at).toLocaleString()}
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

function StatCard({
  label,
  value,
  href,
  alert,
}: {
  label: string;
  value: number;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-lg border p-4 ${
        alert
          ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          alert
            ? "text-red-600 dark:text-red-400"
            : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
