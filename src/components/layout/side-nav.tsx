"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_NAME } from "@/lib/branding";
import type { UserRole } from "@/lib/types";
import {
  LayoutDashboard,
  FileCheck,
  BarChart3,
  Settings,
  Shield,
  LogOut,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Prior Auths", href: "/prior-auths", icon: FileCheck },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["practice_admin"],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: Shield,
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
    <aside className="flex w-60 shrink-0 flex-col border-r bg-white">
      {/* Brand header */}
      <div className="px-5 py-5">
        <p className="text-base font-bold tracking-tight text-brand-600">
          {PRODUCT_NAME}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {practiceName}
        </p>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User footer */}
      <div className="px-5 py-4">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {userRole.replace("_", " ")}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
