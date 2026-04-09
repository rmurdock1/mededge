import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const adminNavItems = [
  { label: "Overview", href: "/admin" },
  { label: "Drug Rules", href: "/admin/rules/drug" },
  { label: "Procedure Rules", href: "/admin/rules/procedure" },
  { label: "Audit Log", href: "/admin/audit" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    notFound();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold tracking-tight">MedEdge Admin</p>
          <p className="mt-0.5 text-xs text-zinc-500">Rule Management</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="truncate text-sm font-medium">
            {profile.full_name ?? user.email ?? "Admin"}
          </p>
          <p className="text-xs text-zinc-500">super_admin</p>
          <Link
            href="/dashboard"
            className="mt-2 block text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Back to Dashboard
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-zinc-50 p-6 dark:bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
