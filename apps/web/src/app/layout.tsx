import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { CookieConsent, VisualViewportObserver } from "@creator-hub/ui";
import { CookiesModal } from "@/components/legal/legal-modals";
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

/**
 * Mobile-first viewport: `interactive-widget=resizes-content` makes Chromium
 * shrink the layout when the on-screen keyboard opens (iOS is handled by
 * VisualViewportObserver), and `viewport-fit=cover` exposes the safe-area
 * insets used by the drawer, chat and bottom-anchored UI.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0b0f19",
};

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
        <VisualViewportObserver />
        <Providers initialLocale={locale}>
          {children}
          <CookieConsent CookiesModal={CookiesModal} />
        </Providers>
      </body>
    </html>
  );
}
