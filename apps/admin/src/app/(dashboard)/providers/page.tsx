"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Button,
  Input,
  Badge,
  Skeleton,
  ActionConfirmDialog,
} from "@creator-hub/ui";
import { useDebounce } from "@/hooks/use-debounce";
import type { Provider, PaginatedResponse } from "@/types";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
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
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: string | null;
    name: string;
  }>({
    isOpen: false,
    id: null,
    name: "",
  });

  const fetchProviders = async (page = 1, query?: string, isSearch = false) => {
    if (isSearch) setIsSearching(true);
    else setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Provider>>(
        "/admin/providers",
        {
          params: {
            page: String(page),
            limit: "20",
            search: query || undefined,
          },
        },
      );
      setProviders(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      console.error(err.response?.data?.message || "Failed to load providers");
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchProviders(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      await api.delete(`/admin/providers/${deleteDialog.id}`);
      fetchProviders(meta.page, debouncedSearch, true);
      toast.success("Provider deleted successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete provider");
    } finally {
      setDeleteDialog({ isOpen: false, id: null, name: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Providers</h1>
          <p className="text-text-muted">Manage AI providers and pricing</p>
        </div>
        <Link href="/providers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Provider
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
        <Input
          placeholder="Search providers..."
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
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Modes</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Cost</th>
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
                  <td colSpan={7} className="px-4 py-4">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : providers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-dim">
                  No providers found
                </td>
              </tr>
            ) : (
              providers.map((provider) => (
                <tr key={provider.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text">{provider.name}</p>
                      <p className="text-xs text-text-dim">{provider.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {provider.model}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(provider.modes ?? []).length > 0 ? (
                        (provider.modes ?? []).map((pm: any) => (
                          <Badge
                            key={pm.mode?.id || pm.id}
                            variant="outline"
                            size="sm"
                          >
                            {pm.mode?.icon && (
                              <span className="mr-0.5">{pm.mode.icon}</span>
                            )}
                            {pm.mode?.name || pm.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-text-dim">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={provider.tier === "PRO" ? "premium" : "free"}
                      size="sm"
                    >
                      {provider.tier}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text">
                    {provider.costPerCredit} cr
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={provider.isActive ? "secondary" : "outline"}
                      size="sm"
                    >
                      {provider.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/providers/${provider.id}/edit`}>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${provider.name}`}
                          className="min-w-[80px]"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDeleteDialog({
                            isOpen: true,
                            id: provider.id,
                            name: provider.name,
                          })
                        }
                        aria-label={`Delete ${provider.name}`}
                        className="min-w-[80px] border-error text-error hover:bg-error/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Delete</span>
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
              onClick={() => fetchProviders(meta.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchProviders(meta.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ActionConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, name: "" })}
        onConfirm={handleDelete}
        title="Delete Provider"
        description={`Are you sure you want to delete "${deleteDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete provider"
        cancelLabel="Keep provider"
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
