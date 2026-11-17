import type { Decorator } from "@storybook/nextjs-vite";
import { Providers } from "@/app/providers";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import {
  useNotificationStore,
  type Notification,
} from "@/store/notification.store";
import { useMobileNavStore } from "@/store/mobile-nav.store";
import { toLocale } from "./locale";

/**
 * Wraps stories of web-app components in the app's own providers (i18n,
 * translated UI labels, React Query, toasts) in the toolbar's language.
 */
export const withWebApp: Decorator = (Story, { globals }) => {
  const locale = toLocale(globals.locale);
  return (
    <Providers initialLocale={locale}>
      <Story />
    </Providers>
  );
};

export const STORY_USER = {
  id: "u1",
  email: "ana@example.com",
  role: "USER",
  name: "Ana Creator",
  emailVerified: "2026-01-01T00:00:00.000Z",
};

export interface WebSessionOptions {
  /** Credit balance shown in the top bar (below 50 adds a low-credit notice). */
  balance?: number;
  notifications?: Notification[];
  /** Mobile navigation drawer open (phones & tablets). */
  drawerOpen?: boolean;
}

/**
 * Seeds the stores a signed-in page reads, so components render the real
 * signed-in state without touching the network. Use in `beforeEach`.
 */
export function seedWebSession({
  balance = 1500,
  notifications = [],
  drawerOpen = false,
}: WebSessionOptions = {}): void {
  useAuthStore.setState({ user: STORY_USER, isHydrated: true });
  useCreditsStore.setState({
    balance,
    currentCredits: Math.min(balance, 500),
    purchasedCredits: Math.max(balance - 500, 0),
    plan: "STARTER",
    isLoading: false,
    isHydrated: true,
    error: null,
  });
  useNotificationStore.setState({
    notifications,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    isHydrated: true,
  });
  useMobileNavStore.setState({ isOpen: drawerOpen });
}
