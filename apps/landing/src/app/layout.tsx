import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Hub — One Workspace. Infinite Content.",
  description:
    "AI-powered platform for content creators. Generate thumbnails, scripts, clips, stream games and content ideas using AI tools and agents.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Creator Hub — One Workspace. Infinite Content.",
    description:
      "AI-powered platform for content creators. Generate thumbnails, scripts, clips, stream games and content ideas using AI tools and agents.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
