import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_NAME } from "@/lib/branding";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalPAs },
    { count: pendingPAs },
    { count: deniedPAs },
    { count: approvedPAs },
  ] = await Promise.all([
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "ready", "submitted", "pending"]),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .eq("status", "denied"),
    supabase
      .from("prior_auths")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  const hasData = (totalPAs ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your prior authorization activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Prior Auths"
          value={totalPAs ?? 0}
        />
        <StatCard
          label="Needs Attention"
          value={pendingPAs ?? 0}
          accent={pendingPAs ? "warning" : undefined}
        />
        <StatCard
          label="Denied"
          value={deniedPAs ?? 0}
          accent={deniedPAs ? "destructive" : undefined}
        />
        <StatCard
          label="Approved"
          value={approvedPAs ?? 0}
          accent={approvedPAs ? "success" : undefined}
        />
      </div>

      {!hasData && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium">
              No prior authorizations yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Prior authorizations appear here automatically when {PRODUCT_NAME}{" "}
              detects an upcoming appointment that requires authorization.
              Connect your practice management system and run a sync to get
              started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "warning" | "destructive" | "success";
}) {
  const valueColor =
    accent === "warning"
      ? "text-amber-600"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "success"
          ? "text-success-600"
          : "text-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
