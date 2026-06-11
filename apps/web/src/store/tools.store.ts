import { create } from "zustand";
import api from "@/lib/api";
import type { ToolManifest } from "@creator-hub/shared-types";

interface ToolsState {
  tools: ToolManifest[];
  activeTool: ToolManifest | null;
  isLoading: boolean;

  fetchTools: () => Promise<void>;
  setActiveTool: (tool: ToolManifest | null) => void;
}

export const useToolsStore = create<ToolsState>()((set) => ({
  tools: [],
  activeTool: null,
  isLoading: false,

  fetchTools: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<ToolManifest[]>("/tools");
      set({ tools: data });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveTool: (tool) => set({ activeTool: tool }),
}));
