"use client";

import { Badge } from "@creator-hub/ui";
import type { TopUser } from "@/types";

interface TopUsersTableProps {
  users: TopUser[];
}

export function TopUsersTable({ users }: TopUsersTableProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-lg font-semibold text-text">Top Users</h3>
      <p className="text-sm text-text-muted">Users with most service usage</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="pb-3 font-medium">User</th>
              <th className="pb-3 font-medium">Plan</th>
              <th className="pb-3 font-medium text-right">Usage</th>
              <th className="pb-3 font-medium text-right">Credits Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-sm text-text-dim"
                >
                  No usage data yet
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.userId} className="hover:bg-surface-elevated/50">
                  <td className="py-3">
                    <div>
                      <p className="font-medium text-text">{user.userName}</p>
                      <p className="text-xs text-text-dim">{user.userEmail}</p>
                    </div>
                  </td>
                  <td className="py-3">
                    <Badge
                      variant={user.userPlan === "FREE" ? "free" : "premium"}
                      size="sm"
                    >
                      {user.userPlan}
                    </Badge>
                  </td>
                  <td className="py-3 text-right tabular-nums text-text">
                    {user.usageCount}
                  </td>
                  <td className="py-3 text-right tabular-nums text-text">
                    {user.creditsUsed}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
