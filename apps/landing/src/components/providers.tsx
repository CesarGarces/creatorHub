"use client";

import { Toaster } from "sonner";
import type { Locale } from "@creator-hub/i18n";
import { I18nProvider } from "@/i18n/i18n-provider";
import { MotionProvider } from "@/components/motion-provider";

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <MotionProvider>{children}</MotionProvider>
      <Toaster richColors theme="dark" position="bottom-center" />
    </I18nProvider>
  );
}
