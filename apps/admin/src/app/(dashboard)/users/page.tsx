"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, UserX, UserCheck } from "lucide-react";
import api from "@/lib/api";
import { Button, Input, Badge, Skeleton } from "@creator-hub/ui";
import type { User, PaginatedResponse } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<User>>("/admin/users", {
        params: {
          page: String(page),
          limit: "20",
          search: search || undefined,
        },
      });
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      console.error(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [search]);

  const toggleStatus = async (user: User) => {
    const action = user.isActive ? "deactivate" : "activate";
    try {
      await api.post(`/admin/users/${user.id}/${action}`);
      fetchUsers(meta.page);
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to ${action} user`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Users</h1>
          <p className="text-text-muted">Manage platform users</p>
        </div>
        <Link href="/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New User
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Credits</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-dim">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-text-dim">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.role === "ADMIN" ? "premium" : "default"}
                      size="sm"
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.plan === "FREE" ? "free" : "premium"}
                      size="sm"
                    >
                      {user.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="tabular-nums text-text">
                      {user.totalCredits}
                      <span className="ml-1 text-xs text-text-dim">
                        ({user.freeCredits} free + {user.purchasedCredits}{" "}
                        purchased)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={user.isActive ? "secondary" : "outline"}
                      size="sm"
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/users/${user.id}/edit`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(user)}
                        title={user.isActive ? "Deactivate" : "Activate"}
                      >
                        {user.isActive ? (
                          <UserX className="h-4 w-4 text-error" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-secondary" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => fetchUsers(meta.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchUsers(meta.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
