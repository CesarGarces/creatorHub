"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Check, X, Settings } from "lucide-react";
import type { Mode, ToolWithModes } from "@/types";

export default function ToolsPage() {
  const queryClient = useQueryClient();
  const [selectedTool, setSelectedTool] = useState<ToolWithModes | null>(null);
  const [selectedModeIds, setSelectedModeIds] = useState<string[]>([]);

  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ["tools-with-modes"],
    queryFn: async () => {
      const res = await api.get<ToolWithModes[]>("/admin/tools-with-modes");
      return res.data;
    },
  });

  const { data: modes, isLoading: modesLoading } = useQuery({
    queryKey: ["modes"],
    queryFn: async () => {
      const res = await api.get<Mode[]>("/admin/modes");
      return res.data;
    },
  });

  const setModesMutation = useMutation({
    mutationFn: (data: { toolId: string; modeIds: string[] }) =>
      api.put(`/admin/tools/${data.toolId}/modes`, { modeIds: data.modeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools-with-modes"] });
      toast.success("Tool modes updated successfully");
      setSelectedTool(null);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to update tool modes",
      );
    },
  });

  const openToolModal = (tool: ToolWithModes) => {
    setSelectedTool(tool);
    setSelectedModeIds(tool.modes.map((m) => m.id));
  };

  const toggleMode = (modeId: string) => {
    setSelectedModeIds((prev) =>
      prev.includes(modeId)
        ? prev.filter((id) => id !== modeId)
        : [...prev, modeId],
    );
  };

  const handleSave = () => {
    if (selectedTool) {
      setModesMutation.mutate({
        toolId: selectedTool.id,
        modeIds: selectedModeIds,
      });
    }
  };

  const activeModes = modes?.filter((m) => m.isActive) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Tools</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage which modes are available for each tool
        </p>
      </div>

      {toolsLoading || modesLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-6 animate-pulse"
            >
              <div className="h-5 bg-surface-elevated rounded w-1/3 mb-3" />
              <div className="h-4 bg-surface-elevated rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {tools?.map((tool) => (
            <div
              key={tool.id}
              className="rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{tool.icon || "🔧"}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-text">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-text-muted mt-1">
                      {tool.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
                      <span className="px-2 py-0.5 rounded bg-surface-elevated">
                        {tool.category}
                      </span>
                      <span>{tool.creditsPerUse} credits/use</span>
                      <span
                        className={`px-2 py-0.5 rounded ${
                          tool.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {tool.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openToolModal(tool)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors"
                >
                  <Settings size={14} />
                  Modes
                </button>
              </div>

              {tool.modes.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tool.modes.map((mode) => (
                    <span
                      key={mode.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{
                        backgroundColor: (mode.color || "#6366f1") + "15",
                        color: mode.color || "#6366f1",
                      }}
                    >
                      {mode.icon && <span>{mode.icon}</span>}
                      {mode.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-dim italic">
                  No modes assigned
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-xl border border-border w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold text-text mb-1">
              Configure Modes
            </h2>
            <p className="text-sm text-text-muted mb-6">
              Select which modes are available for{" "}
              <span className="font-medium text-text">{selectedTool.name}</span>
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeModes.map((mode) => {
                const isSelected = selectedModeIds.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => toggleMode(mode.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-surface-elevated"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>

                    {mode.icon ? (
                      <span className="text-xl">{mode.icon}</span>
                    ) : (
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: mode.color || "#6366f1" }}
                      >
                        <span className="text-white text-xs font-bold">
                          {mode.name.charAt(0)}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text">
                        {mode.name}
                      </p>
                      {mode.description && (
                        <p className="text-xs text-text-dim truncate">
                          {mode.description}
                        </p>
                      )}
                    </div>

                    <span className="text-xs font-mono text-text-dim">
                      {mode.slug}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
              <p className="text-sm text-text-dim">
                {selectedModeIds.length} mode
                {selectedModeIds.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTool(null)}
                  disabled={setModesMutation.isPending}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={setModesMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {setModesMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
