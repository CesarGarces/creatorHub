"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useMemo, useState } from "react";
import { UiLabelsProvider } from "@creator-hub/ui";
import type { Locale } from "@creator-hub/i18n";
import { I18nProvider, useI18n } from "@/i18n/i18n-provider";

/** Translated built-in labels of the shared UI components (dialogs). */
function LocalizedUiLabels({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const labels = useMemo(
    () => ({
      close: t("common.close"),
      confirmAction: t("common.confirmAction"),
    }),
    [t],
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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

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
