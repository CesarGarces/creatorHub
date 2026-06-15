"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { UsageByProvider } from "@/types";

interface UsageChartProps {
  data: UsageByProvider[];
}

export function UsageChart({ data }: UsageChartProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold text-text">Usage by Provider</h3>
      <p className="text-sm text-text-muted">
        Generations and credits consumed
      </p>

      <div className="mt-6 h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            No usage data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="toolId"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <YAxis
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121826",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#f1f5f9" }}
                itemStyle={{ color: "#f1f5f9" }}
              />
              <Bar dataKey="usageCount" fill="#00bbd9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
