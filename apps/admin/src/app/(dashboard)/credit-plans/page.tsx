"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowUpDown } from "lucide-react";

interface CreditPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  usdAmount: number;
  creditsGiven: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function CreditPlansPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<CreditPlan | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["credit-plans"],
    queryFn: async () => {
      const res = await api.get<CreditPlan[]>("/admin/credit-plans");
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<CreditPlan> }) =>
      api.put(`/admin/credit-plans/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-plans"] });
      toast.success("Plan updated successfully");
      setEditingPlan(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update plan");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreditPlan, "id" | "createdAt" | "updatedAt">) =>
      api.post("/admin/credit-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-plans"] });
      toast.success("Plan created successfully");
      setIsCreateMode(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create plan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/credit-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-plans"] });
      toast.success("Plan deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete plan");
    },
  });

  const handleSave = (formData: Partial<CreditPlan>) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, updates: formData });
    } else if (isCreateMode) {
      createMutation.mutate(formData as any);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Credit Plans</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage the credit plans available to users for purchasing credits
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPlan(null);
            setIsCreateMode(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          Add Plan
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-6 animate-pulse"
            >
              <div className="h-5 bg-surface-elevated rounded w-1/2 mb-4" />
              <div className="h-8 bg-surface-elevated rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-elevated rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border border-border bg-surface p-6 flex flex-col relative"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    plan.isActive
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {plan.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
              <p className="text-3xl font-bold text-text mt-2">
                ${plan.usdAmount.toFixed(2)}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {plan.creditsGiven.toLocaleString()} credits
              </p>

              <div className="mt-4 flex-1">
                <p className="text-sm text-text-muted">{plan.description}</p>
                <p className="text-xs text-text-dim mt-2">Slug: {plan.slug}</p>
                <p className="text-xs text-text-dim">
                  ${((plan.usdAmount / plan.creditsGiven) * 100).toFixed(1)}¢
                  per credit
                </p>
                <p className="text-xs text-text-dim flex items-center gap-1 mt-1">
                  <ArrowUpDown size={12} />
                  Sort order: {plan.sortOrder}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlan(plan);
                    setIsCreateMode(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete plan "${plan.name}"?`)) {
                      deleteMutation.mutate(plan.id);
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      {(editingPlan || isCreateMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-xl border border-border w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-text mb-4">
              {editingPlan ? "Edit Credit Plan" : "Create Credit Plan"}
            </h2>
            <CreditPlanForm
              plan={editingPlan}
              onSave={handleSave}
              onCancel={() => {
                setEditingPlan(null);
                setIsCreateMode(false);
              }}
              isLoading={updateMutation.isPending || createMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreditPlanForm({
  plan,
  onSave,
  onCancel,
  isLoading,
}: {
  plan: CreditPlan | null;
  onSave: (data: Partial<CreditPlan>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [slug, setSlug] = useState(plan?.slug || "");
  const [name, setName] = useState(plan?.name || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [usdAmount, setUsdAmount] = useState(plan?.usdAmount?.toString() || "");
  const [creditsGiven, setCreditsGiven] = useState(
    plan?.creditsGiven?.toString() || "",
  );
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(
    plan?.sortOrder?.toString() || "0",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug,
      name,
      description: description || undefined,
      usdAmount: parseFloat(usdAmount),
      creditsGiven: parseInt(creditsGiven),
      isActive,
      sortOrder: parseInt(sortOrder),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="slug"
          className="block text-sm font-medium text-text mb-1"
        >
          Slug
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toUpperCase())}
          placeholder="PAY_AS_YOU_GO"
          disabled={!!plan}
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-text mb-1"
        >
          Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pay as you go"
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-text mb-1"
        >
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Buy credits anytime"
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="usdAmount"
            className="block text-sm font-medium text-text mb-1"
          >
            Price (USD)
          </label>
          <input
            id="usdAmount"
            type="number"
            step="0.01"
            min="0.01"
            value={usdAmount}
            onChange={(e) => setUsdAmount(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label
            htmlFor="creditsGiven"
            className="block text-sm font-medium text-text mb-1"
          >
            Credits Given
          </label>
          <input
            id="creditsGiven"
            type="number"
            min="1"
            value={creditsGiven}
            onChange={(e) => setCreditsGiven(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="sortOrder"
            className="block text-sm font-medium text-text mb-1"
          >
            Sort Order
          </label>
          <input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-end pb-1">
          <label
            htmlFor="isActive"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm font-medium text-text">Active</span>
          </label>
        </div>
      </div>

      {usdAmount && creditsGiven && (
        <p className="text-xs text-text-dim">
          ${((parseFloat(usdAmount) / parseInt(creditsGiven)) * 100).toFixed(1)}
          ¢ per credit
        </p>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Saving..." : plan ? "Save Changes" : "Create Plan"}
        </button>
      </div>
    </form>
  );
}
