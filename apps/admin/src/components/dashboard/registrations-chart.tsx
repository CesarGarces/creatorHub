"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RegistrationByMonth } from "@/types";

interface RegistrationsChartProps {
  data: RegistrationByMonth[];
}

export function RegistrationsChart({ data }: RegistrationsChartProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold text-text">User Registrations</h3>
      <p className="text-sm text-text-muted">New users per month</p>

      <div className="mt-6 h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            No registration data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="month"
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
              <Line
                type="monotone"
                dataKey="count"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: "#22c55e", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
