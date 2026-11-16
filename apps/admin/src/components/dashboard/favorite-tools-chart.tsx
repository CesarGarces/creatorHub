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
import type { FavoriteStats } from "@/types";
import { useI18n } from "@/i18n/i18n-provider";

interface FavoriteToolsChartProps {
  data: FavoriteStats[];
}

export function FavoriteToolsChart({ data }: FavoriteToolsChartProps) {
  const { t } = useI18n();
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-text">
        {t("dashboard.favorites.title")}
      </h3>
      <p className="text-sm text-text-muted">
        {t("dashboard.favorites.subtitle")}
      </p>

      <div className="mt-4 h-56 sm:mt-6 sm:h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            {t("dashboard.favorites.empty")}
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
              <Bar
                dataKey="favoriteCount"
                name={t("dashboard.favorites.series")}
                fill="#fbbf24"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
