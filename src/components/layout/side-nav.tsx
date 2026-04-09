"use client";

import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Prior Auths", href: "/dashboard/prior-auths" },
  { label: "Appointments", href: "/dashboard/appointments" },
  { label: "Payer Rules", href: "/dashboard/payer-rules" },
  { label: "Appeals", href: "/dashboard/appeals" },
  { label: "Revenue Radar", href: "/dashboard/radar", roles: ["practice_admin", "billing_manager"] },
  {
    label: "Settings",
    href: "/dashboard/settings",
    roles: ["practice_admin"],
  },
  {
    label: "Admin",
    href: "/admin",
    roles: ["super_admin"],
  },
];

interface SideNavProps {
  userName: string;
  practiceName: string;
  userRole: UserRole;
}

export function SideNav({ userName, practiceName, userRole }: SideNavProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Practice header */}
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm font-semibold tracking-tight">MedEdge</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{practiceName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <a
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="text-xs capitalize text-zinc-500">
          {userRole.replace("_", " ")}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
