import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StatusBreakdownChart,
  PayerBreakdownChart,
  DenialReasonsChart,
} from "@/components/reports/report-charts";
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

export default async function ReportsPage() {
  const supabase = await createClient();

  // Fetch all PAs for aggregation
  const { data: allPAs } = await supabase
    .from("prior_auths")
    .select("status, payer_name, denial_reason, created_at, decision_date, submitted_date");

  const pas = allPAs ?? [];

  // ---- Compute metrics ----

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const pa of pas) {
    statusMap.set(pa.status, (statusMap.get(pa.status) ?? 0) + 1);
  }
  const statusData = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Approval rate
  const decided = pas.filter((p) =>
    ["approved", "denied", "appeal_approved", "appeal_denied"].includes(p.status)
  );
  const approvedCount = decided.filter((p) =>
    ["approved", "appeal_approved"].includes(p.status)
  ).length;
  const approvalRate =
    decided.length > 0 ? Math.round((approvedCount / decided.length) * 100) : 0;

  // Average turnaround (submitted → decision)
  const turnarounds: number[] = [];
  for (const pa of pas) {
    if (pa.submitted_date && pa.decision_date) {
      const submitted = new Date(pa.submitted_date).getTime();
      const decided = new Date(pa.decision_date).getTime();
      const days = Math.floor((decided - submitted) / 86400000);
      if (days >= 0) turnarounds.push(days);
    }
  }
  const avgTurnaround =
    turnarounds.length > 0
      ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
      : 0;

  // Payer breakdown
  const payerMap = new Map<
    string,
    { total: number; approved: number; denied: number }
  >();
  for (const pa of pas) {
    const p = payerMap.get(pa.payer_name) ?? {
      total: 0,
      approved: 0,
      denied: 0,
    };
    p.total++;
    if (["approved", "appeal_approved"].includes(pa.status)) p.approved++;
    if (["denied", "appeal_denied"].includes(pa.status)) p.denied++;
    payerMap.set(pa.payer_name, p);
  }
  const payerData = [...payerMap.entries()]
    .map(([payer, counts]) => ({ payer, ...counts }))
    .sort((a, b) => b.total - a.total);

  // Denial reasons
  const denialMap = new Map<string, number>();
  for (const pa of pas) {
    if (pa.denial_reason) {
      const reason = pa.denial_reason.length > 40
        ? pa.denial_reason.substring(0, 40) + "..."
        : pa.denial_reason;
      denialMap.set(reason, (denialMap.get(reason) ?? 0) + 1);
    }
  }
  const denialData = [...denialMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Insights across your prior authorization activity.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Total PAs"
          value={pas.length}
          icon={TrendingUp}
        />
        <KPICard
          label="Approval Rate"
          value={`${approvalRate}%`}
          icon={CheckCircle2}
          accent={approvalRate >= 80 ? "success" : approvalRate >= 50 ? "warning" : "destructive"}
        />
        <KPICard
          label="Avg Turnaround"
          value={turnarounds.length > 0 ? `${avgTurnaround}d` : "\u2014"}
          icon={Clock}
        />
        <KPICard
          label="Denials"
          value={decided.length - approvedCount}
          icon={XCircle}
          accent={decided.length - approvedCount > 0 ? "destructive" : undefined}
        />
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart data={statusData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Payer</CardTitle>
          </CardHeader>
          <CardContent>
            <PayerBreakdownChart data={payerData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Denial Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <DenialReasonsChart data={denialData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: "success" | "warning" | "destructive";
}) {
  const iconColor =
    accent === "success"
      ? "text-success-600"
      : accent === "warning"
        ? "text-amber-500"
        : accent === "destructive"
          ? "text-destructive"
          : "text-muted-foreground";

  const valueColor =
    accent === "success"
      ? "text-success-700"
      : accent === "warning"
        ? "text-amber-600"
        : accent === "destructive"
          ? "text-destructive"
          : "text-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
