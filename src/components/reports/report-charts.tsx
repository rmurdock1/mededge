"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface StatusCount {
  status: string;
  count: number;
}

interface PayerCount {
  payer: string;
  total: number;
  approved: number;
  denied: number;
}

interface DenialReason {
  reason: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  ready: "#7c3aed",
  submitted: "#3b82f6",
  pending: "#f59e0b",
  approved: "#10b981",
  denied: "#ef4444",
  appeal_draft: "#a78bfa",
  appeal_submitted: "#f59e0b",
  appeal_approved: "#059669",
  appeal_denied: "#dc2626",
  expired: "#6b7280",
};

const PIE_COLORS = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b", "#7c3aed", "#6b7280"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  submitted: "Submitted",
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  appeal_draft: "Appeal Draft",
  appeal_submitted: "Appeal Sent",
  appeal_approved: "Appeal Won",
  appeal_denied: "Appeal Denied",
  expired: "Expired",
};

export function StatusBreakdownChart({ data }: { data: StatusCount[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] ?? d.status,
    fill: STATUS_COLORS[d.status] ?? "#94a3b8",
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PayerBreakdownChart({ data }: { data: PayerCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="payer"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Approved" />
        <Bar dataKey="denied" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} name="Denied" />
        <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DenialReasonsChart({ data }: { data: DenialReason[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No denials recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="count"
          nameKey="reason"
          label={({ name, percent }) =>
            `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
