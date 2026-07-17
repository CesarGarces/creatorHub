"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Button,
  Input,
  Badge,
  Skeleton,
  Switch,
  ActionConfirmDialog,
} from "@creator-hub/ui";
import { useDebounce } from "@/hooks/use-debounce";
import type { User, PaginatedResponse } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [toggleDialog, setToggleDialog] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({
    isOpen: false,
    user: null,
  });

  const fetchUsers = async (page = 1, query?: string, isSearch = false) => {
    if (isSearch) setIsSearching(true);
    else setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<User>>("/admin/users", {
        params: {
          page: String(page),
          limit: "20",
          search: query || undefined,
        },
      });
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      console.error(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const handleToggleStatus = async () => {
    if (!toggleDialog.user) return;
    const user = toggleDialog.user;
    const action = user.isActive ? "deactivate" : "activate";
    try {
      await api.post(`/admin/users/${user.id}/${action}`);
      fetchUsers(meta.page, debouncedSearch, true);
      toast.success(`User ${action}d successfully`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${action} user`);
    } finally {
      setToggleDialog({ isOpen: false, user: null });
    }
  };

  const openToggleDialog = (user: User) => {
    setToggleDialog({ isOpen: true, user });
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
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-dim" />
        )}
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
          <tbody
            className={`divide-y divide-border ${isSearching ? "opacity-60" : ""}`}
          >
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
                        ({user.currentCredits} available,{" "}
                        {user.purchasedCredits} purchased)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={() => openToggleDialog(user)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/users/${user.id}/edit`}>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${user.name || user.email}`}
                        className="min-w-[80px]"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="w-28">
              <Button
                variant="secondary"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => fetchUsers(meta.page - 1)}
              >
                Previous
              </Button>
            </div>
            <p className="flex-1 text-center text-sm text-text-muted">
              Page {meta.page} of {meta.totalPages}
            </p>
            <div className="w-28 text-right">
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
        </div>
      )}

      <ActionConfirmDialog
        isOpen={toggleDialog.isOpen}
        onClose={() => setToggleDialog({ isOpen: false, user: null })}
        onConfirm={handleToggleStatus}
        title={
          toggleDialog.user?.isActive ? "Deactivate User" : "Activate User"
        }
        description={
          toggleDialog.user?.isActive
            ? `Are you sure you want to deactivate "${toggleDialog.user?.name || toggleDialog.user?.email}"? They will not be able to access the platform.`
            : `Are you sure you want to activate "${toggleDialog.user?.name || toggleDialog.user?.email}"? They will regain access to the platform.`
        }
        confirmLabel={
          toggleDialog.user?.isActive ? "Deactivate user" : "Activate user"
        }
        cancelLabel="Cancel"
        confirmVariant="danger"
        icon={
          toggleDialog.user?.isActive ? (
            <UserX className="h-5 w-5" />
          ) : (
            <UserCheck className="h-5 w-5" />
          )
        }
      />
    </div>
  );
}
