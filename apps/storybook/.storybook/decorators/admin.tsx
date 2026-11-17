import type { Decorator } from "@storybook/nextjs-vite";
import { Providers } from "@admin/app/providers";
import { toLocale } from "./locale";

/**
 * Wraps stories of admin components in the admin's providers (i18n, UI
 * labels, React Query, toasts) in the toolbar's language.
 */
export const withAdminApp: Decorator = (Story, { globals }) => {
  const locale = toLocale(globals.locale);
  return (
    <Providers initialLocale={locale}>
      <Story />
    </Providers>
  );
};
