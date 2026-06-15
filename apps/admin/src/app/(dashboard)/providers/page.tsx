"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { Button, Input, Badge, Skeleton } from "@creator-hub/ui";
import type { Provider, PaginatedResponse } from "@/types";

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchProviders = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Provider>>(
        "/admin/providers",
        {
          params: {
            page: String(page),
            limit: "20",
            search: search || undefined,
          },
        },
      );
      setProviders(res.data.data);
      setMeta(res.data.meta);
    } catch (err: any) {
      console.error(err.response?.data?.message || "Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders(1);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      await api.delete(`/admin/providers/${id}`);
      fetchProviders(meta.page);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete provider");
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
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Cost</th>
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
            ) : providers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-dim">
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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/providers/${provider.id}/edit`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(provider.id)}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
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
    </div>
  );
}
