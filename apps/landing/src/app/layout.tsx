import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { LOCALE_META } from "@creator-hub/i18n";
import { Providers } from "@/components/providers";
import { getRequestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = translate(locale, "meta.title");
  const description = translate(locale, "meta.description");
  return {
    title,
    description,
    icons: {
      icon: "/favicon.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      // "es-ES" → "es_ES" (Open Graph format)
      locale: LOCALE_META[locale].intlLocale.replace("-", "_"),
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Saved choice (shared with the app) → browser language → English, so the
  // first paint is already in the visitor's language.
  const locale = await getRequestLocale();

  return (
    <html
      lang={LOCALE_META[locale].intlLocale}
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
