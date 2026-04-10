"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_NAME } from "@/lib/branding";
import type { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Prior Auths", href: "/prior-auths" },
  { label: "Reports", href: "/reports" },
  {
    label: "Settings",
    href: "/settings",
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
    <aside className="flex w-60 flex-col border-r bg-white">
      {/* Brand header */}
      <div className="border-b px-4 py-4">
        <p className="text-sm font-bold tracking-tight text-brand-600">
          {PRODUCT_NAME}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {practiceName}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t px-4 py-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {userRole.replace("_", " ")}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
