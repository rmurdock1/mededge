"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

const STATUS_GROUPS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs Attention" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "appeals", label: "Appeals" },
] as const;

interface PAFiltersProps {
  payers: string[];
}

export function PAFilters({ payers }: PAFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") ?? "all";
  const currentPayer = searchParams.get("payer") ?? "";
  const currentSearch = searchParams.get("q") ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters = currentStatus !== "all" || currentPayer || currentSearch;

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_GROUPS.map((group) => {
          const isActive = currentStatus === group.key;
          return (
            <button
              key={group.key}
              onClick={() =>
                updateParams({ status: group.key === "all" ? "" : group.key })
              }
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-brand-100 text-brand-700"
                  : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Search + payer filter row */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient or procedure..."
            value={currentSearch}
            onChange={(e) => updateParams({ q: e.target.value })}
            className="pl-8"
          />
        </div>

        <select
          value={currentPayer}
          onChange={(e) => updateParams({ payer: e.target.value })}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All payers</option>
          {payers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export function PAStatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string }
  > = {
    draft: {
      label: "Draft",
      className: "bg-secondary text-secondary-foreground",
    },
    ready: {
      label: "Ready",
      className: "bg-brand-100 text-brand-700",
    },
    submitted: {
      label: "Submitted",
      className: "bg-blue-50 text-blue-700",
    },
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700",
    },
    approved: {
      label: "Approved",
      className: "bg-success-100 text-success-700",
    },
    denied: {
      label: "Denied",
      className: "bg-destructive/10 text-destructive",
    },
    appeal_draft: {
      label: "Appeal Draft",
      className: "bg-secondary text-secondary-foreground",
    },
    appeal_submitted: {
      label: "Appeal Sent",
      className: "bg-amber-50 text-amber-700",
    },
    appeal_approved: {
      label: "Appeal Won",
      className: "bg-success-100 text-success-700",
    },
    appeal_denied: {
      label: "Appeal Denied",
      className: "bg-destructive/10 text-destructive",
    },
    expired: {
      label: "Expired",
      className: "bg-secondary text-muted-foreground",
    },
  };

  const c = config[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <Badge variant="outline" className={`border-0 ${c.className}`}>
      {c.label}
    </Badge>
  );
}
