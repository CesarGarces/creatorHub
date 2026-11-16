import { create } from "zustand";

/**
 * Off-canvas navigation on phones and portrait tablets (below `lg`). The
 * sidebar is docked from `lg` up and ignores this state there. Always starts
 * closed so the page content gets the whole screen.
 *
 * UI-only state: shared by the top bar's menu button and the sidebar drawer.
 */
interface MobileNavState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useMobileNavStore = create<MobileNavState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
