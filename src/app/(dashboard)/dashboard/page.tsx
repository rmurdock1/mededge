import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/branding";
import { decryptPHI } from "@/lib/crypto/phi";
import { PAStatusBadge } from "@/components/prior-auths/pa-filters";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch summary counts
  const [
    { count: totalPAs },
    { count: needsAttention },
    { count: submittedCount },
    { count: approvedCount },
    { count: deniedCount },
  ] = await Promise.all([
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "ready"]),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "pending"]),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .in("status", ["denied", "appeal_denied"]),
  ]);

  // Fetch urgent PAs (draft/ready status, sorted by nearest appointment)
  const { data: urgentPAs } = await supabase
    .from("prior_auths")
    .select(`
      id,
      status,
      payer_name,
      procedure_or_medication,
      created_at,
      patient_id,
      patients!inner(name_encrypted)
    `)
    .in("status", ["draft", "ready", "denied"])
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent activity
  const { data: recentActivity } = await supabase
    .from("pa_activity_log")
    .select("id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  const hasData = (totalPAs ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your prior authorization activity.
          </p>
        </div>
        <Link href="/prior-auths">
          <Button variant="outline" size="sm">
            View all PAs
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total"
          value={totalPAs ?? 0}
          icon={FileCheck}
        />
        <StatCard
          label="Needs Attention"
          value={needsAttention ?? 0}
          icon={AlertCircle}
          accent={needsAttention ? "warning" : undefined}
        />
        <StatCard
          label="Awaiting Decision"
          value={submittedCount ?? 0}
          icon={Clock}
          accent={submittedCount ? "info" : undefined}
        />
        <StatCard
          label="Approved"
          value={approvedCount ?? 0}
          icon={CheckCircle2}
          accent={approvedCount ? "success" : undefined}
        />
        <StatCard
          label="Denied"
          value={deniedCount ?? 0}
          icon={AlertCircle}
          accent={deniedCount ? "destructive" : undefined}
        />
      </div>

      {!hasData && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <FileCheck className="h-6 w-6 text-brand-600" />
            </div>
            <p className="text-lg font-medium">
              No prior authorizations yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Prior authorizations appear here automatically when {PRODUCT_NAME}{" "}
              detects an upcoming appointment that requires authorization.
              Connect your practice management system and run a sync to get
              started.
            </p>
            <Link href="/settings" className="mt-6 inline-block">
              <Button className="bg-brand-600 hover:bg-brand-700">
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Urgent PAs — takes 3 columns */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Needs your attention</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {urgentPAs && urgentPAs.length > 0 ? (
                <div className="divide-y">
                  {urgentPAs.map((pa) => {
                    let patientName = "Unknown Patient";
                    try {
                      const patients = pa.patients as unknown as { name_encrypted: string } | null;
                      if (patients?.name_encrypted) {
                        patientName = decryptPHI(patients.name_encrypted);
                      }
                    } catch {
                      patientName = "Patient";
                    }

                    return (
                      <Link
                        key={pa.id}
                        href={`/prior-auths/${pa.id}`}
                        className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {patientName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pa.procedure_or_medication} &middot; {pa.payer_name}
                          </p>
                        </div>
                        <PAStatusBadge status={pa.status} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  All PAs are up to date. Nice work!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity feed — takes 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity && recentActivity.length > 0 ? (
                <div className="divide-y">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="px-5 py-3">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {activity.details}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        {formatRelativeTime(activity.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Activity will appear here as PAs are processed.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "warning" | "destructive" | "success" | "info";
}) {
  const iconColor =
    accent === "warning"
      ? "text-amber-500"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "success"
          ? "text-success-600"
          : accent === "info"
            ? "text-blue-500"
            : "text-muted-foreground";

  const valueColor =
    accent === "warning"
      ? "text-amber-600"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "success"
          ? "text-success-700"
          : accent === "info"
            ? "text-blue-600"
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
