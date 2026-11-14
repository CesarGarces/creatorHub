import type { Metadata } from "next";
import { LOCALE_META } from "@creator-hub/i18n";
import { Providers } from "./providers";
import { getRequestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: translate(locale, "meta.title"),
    description: translate(locale, "meta.description"),
    icons: {
      icon: "/logo-dark.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Saved choice (shared with the app) → browser language → English, so the
  // first paint is already in the admin's language.
  const locale = await getRequestLocale();

  return (
    <html lang={LOCALE_META[locale].intlLocale} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
