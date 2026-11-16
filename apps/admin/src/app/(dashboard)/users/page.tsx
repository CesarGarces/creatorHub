"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Loader2, UserX, UserCheck } from "lucide-react";
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
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

export default function UsersPage() {
  const { t, tOptional, formatNumber } = useI18n();
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
    } catch (err: unknown) {
      console.error("Failed to load users", err);
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
      toast.success(
        t(
          action === "activate"
            ? "users.toasts.activated"
            : "users.toasts.deactivated",
        ),
      );
    } catch (err: unknown) {
      toast.error(
        localizeError(
          err,
          action === "activate"
            ? "users.toasts.activateFailed"
            : "users.toasts.deactivateFailed",
        ),
      );
    } finally {
      setToggleDialog({ isOpen: false, user: null });
    }
  };

  const openToggleDialog = (user: User) => {
    setToggleDialog({ isOpen: true, user });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">
            {t("users.title")}
          </h1>
          <p className="text-text-muted">{t("users.subtitle")}</p>
        </div>
        <Link href="/users/new" className="shrink-0">
          <Button className="w-full sm:w-auto pointer-coarse:h-11">
            <Plus className="mr-2 h-4 w-4" />
            {t("users.newUser")}
          </Button>
        </Link>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder={t("users.searchPlaceholder")}
          aria-label={t("users.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-dim" />
        )}
      </div>

      <div className="@container rounded-xl border border-border bg-surface overflow-hidden">
        <table className="table-stack w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">{t("users.table.user")}</th>
              <th className="px-4 py-3 font-medium">{t("users.table.role")}</th>
              <th className="px-4 py-3 font-medium">{t("users.table.plan")}</th>
              <th className="px-4 py-3 font-medium">
                {t("users.table.credits")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("users.table.status")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {t("users.table.actions")}
              </th>
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
                  {t("users.empty")}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3" data-primary>
                    <div>
                      <p className="font-medium text-text">
                        {user.name || t("users.unnamed")}
                      </p>
                      <p className="text-xs text-text-dim">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3" data-label={t("users.table.role")}>
                    <Badge
                      variant={user.role === "ADMIN" ? "premium" : "default"}
                      size="sm"
                    >
                      {tOptional(`common.roles.${user.role}`, user.role)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3" data-label={t("users.table.plan")}>
                    <Badge
                      variant={user.plan === "FREE" ? "free" : "premium"}
                      size="sm"
                    >
                      {tOptional(`common.plans.${user.plan}`, user.plan)}
                    </Badge>
                  </td>
                  <td
                    className="px-4 py-3"
                    data-label={t("users.table.credits")}
                  >
                    <div className="tabular-nums text-text">
                      {formatNumber(user.totalCredits)}
                      <span className="ml-1 text-xs text-text-dim">
                        {t("users.creditsBreakdown", {
                          available: user.currentCredits,
                          purchased: user.purchasedCredits,
                        })}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3"
                    data-label={t("users.table.status")}
                  >
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={() => openToggleDialog(user)}
                      aria-label={t("users.statusAria", {
                        name: user.name || user.email,
                      })}
                    />
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    data-label={t("users.table.actions")}
                  >
                    <Link href={`/users/${user.id}/edit`}>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={t("users.editAria", {
                          name: user.name || user.email,
                        })}
                        className="min-w-[80px] pointer-coarse:h-11"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>{t("common.edit")}</span>
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
        <div className="rounded-lg border border-border bg-surface px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="shrink-0 sm:w-28">
              <Button
                variant="secondary"
                size="sm"
                className="pointer-coarse:h-11"
                disabled={meta.page <= 1}
                onClick={() => fetchUsers(meta.page - 1)}
              >
                {t("common.previous")}
              </Button>
            </div>
            <p className="flex-1 text-center text-sm text-text-muted">
              {t("common.pageOf", { page: meta.page, total: meta.totalPages })}
            </p>
            <div className="shrink-0 text-right sm:w-28">
              <Button
                variant="secondary"
                size="sm"
                className="pointer-coarse:h-11"
                disabled={meta.page >= meta.totalPages}
                onClick={() => fetchUsers(meta.page + 1)}
              >
                {t("common.next")}
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
          toggleDialog.user?.isActive
            ? t("users.toggle.deactivateTitle")
            : t("users.toggle.activateTitle")
        }
        description={t(
          toggleDialog.user?.isActive
            ? "users.toggle.deactivateDescription"
            : "users.toggle.activateDescription",
          { name: toggleDialog.user?.name || toggleDialog.user?.email || "" },
        )}
        confirmLabel={
          toggleDialog.user?.isActive
            ? t("users.toggle.deactivateConfirm")
            : t("users.toggle.activateConfirm")
        }
        cancelLabel={t("common.cancel")}
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
