"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import type { RegistrationByDay } from "@/types";

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function RegistrationsChart() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [from, setFrom] = useState(formatDate(weekAgo));
  const [to, setTo] = useState(formatDate(today));
  const [data, setData] = useState<RegistrationByDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/dashboard/registrations", {
          params: { from, to },
        });
        setData(res.data?.byDay || []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [from, to]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text">
            User Registrations
          </h3>
          <p className="text-sm text-text-muted">New users by date</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            max={to}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
          />
          <span className="text-text-dim">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from}
            max={formatDate(today)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text"
          />
        </div>
      </div>

      <div className="mt-6 h-64">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            No registration data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                allowDecimals={false}
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
