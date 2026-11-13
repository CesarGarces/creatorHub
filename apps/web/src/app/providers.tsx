"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Toaster } from "sonner";
import { UiLabelsProvider, type UiLabels } from "@creator-hub/ui";
import { makeQueryClient } from "@/lib/query-client";
import { I18nProvider, useI18n } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/config";

/** Feeds translated built-in labels to the shared @creator-hub/ui components. */
function LocalizedUiLabels({ children }: { children: React.ReactNode }) {
  const { t, tOptional } = useI18n();

  const labels = useMemo<Partial<UiLabels>>(
    () => ({
      close: t("ui.close"),
      confirmAction: t("ui.confirmAction"),
      generating: t("common.actions.generating"),
      addToFavorites: t("ui.addToFavorites"),
      removeFromFavorites: t("ui.removeFromFavorites"),
      premium: t("ui.premium"),
      formatCredits: (balance: number) =>
        t("common.credits.count", { count: balance }),
      formatToolStatus: (status: string) =>
        tOptional(`ui.toolStatus.${status}`, status),
      cookieConsent: {
        ariaLabel: t("cookieConsent.ariaLabel"),
        message: t("cookieConsent.message"),
        acceptAll: t("cookieConsent.acceptAll"),
        essentialOnly: t("cookieConsent.essentialOnly"),
        cookiePolicy: t("cookieConsent.cookiePolicy"),
      },
    }),
    // `t`/`tOptional` get a new identity exactly when the locale changes.
    [t, tOptional],
  );

  return <UiLabelsProvider labels={labels}>{children}</UiLabelsProvider>;
}

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <I18nProvider initialLocale={initialLocale}>
      <LocalizedUiLabels>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </LocalizedUiLabels>
    </I18nProvider>
  );
}
