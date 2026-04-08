import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch summary counts for the dashboard
  const [
    { count: totalPAs },
    { count: pendingPAs },
    { count: deniedPAs },
    { count: upcomingAppts },
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
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("appointment_date", new Date().toISOString().split("T")[0]!),
  ]);

  const stats = [
    { label: "Total Prior Auths", value: totalPAs ?? 0 },
    { label: "Pending / In Progress", value: pendingPAs ?? 0 },
    { label: "Denied (Need Appeal)", value: deniedPAs ?? 0 },
    { label: "Upcoming Appointments", value: upcomingAppts ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Overview of your prior authorization activity.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
