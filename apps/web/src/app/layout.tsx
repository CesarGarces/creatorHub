import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { CookieConsent } from "@creator-hub/ui";
import { CookiesModal } from "@/app/cookies/page";
import { getRequestLocale } from "@/i18n/server";
import { LOCALE_META } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: translate(locale, "common.appName"),
    description: translate(locale, "common.appDescription"),
    icons: {
      icon: "/favicon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved on the server (saved cookie → browser language → English) so
  // the very first paint is already in the user's language.
  const locale = await getRequestLocale();

  return (
    <html
      lang={LOCALE_META[locale].intlLocale}
      className="dark"
      suppressHydrationWarning
    >
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <Providers initialLocale={locale}>
          {children}
          <CookieConsent CookiesModal={CookiesModal} />
        </Providers>
      </body>
    </html>
  );
}
