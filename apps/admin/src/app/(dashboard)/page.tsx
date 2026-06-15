"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsageChart } from "@/components/dashboard/usage-chart";
import { RegistrationsChart } from "@/components/dashboard/registrations-chart";
import { TopUsersTable } from "@/components/dashboard/top-users-table";
import type {
  DashboardStats,
  UsageByProvider,
  TopUser,
  RegistrationByMonth,
} from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<UsageByProvider[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationByMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usageRes, topUsersRes, registrationsRes] =
          await Promise.all([
            api.get("/admin/dashboard/stats"),
            api.get("/admin/dashboard/usage"),
            api.get("/admin/dashboard/top-users"),
            api.get("/admin/dashboard/registrations"),
          ]);

        setStats(statsRes.data);
        setUsage(usageRes.data?.byProvider || []);
        setTopUsers(topUsersRes.data?.users || []);
        setRegistrations(registrationsRes.data?.byMonth || []);
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to load dashboard data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-surface animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-xl border border-border bg-surface animate-pulse" />
          <div className="h-80 rounded-xl border border-border bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/30 bg-error/10 p-6 text-error">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-text-muted">Overview of your platform</p>
      </div>

      {stats && <StatsCards stats={stats} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageChart data={usage} />
        <RegistrationsChart data={registrations} />
      </div>

      <TopUsersTable users={topUsers} />
    </div>
  );
}
