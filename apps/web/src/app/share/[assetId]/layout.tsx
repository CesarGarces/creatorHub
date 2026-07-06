import type { Metadata } from "next";

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://app.creatorhubplatform.com";

export const metadata: Metadata = {
  title: "Created with Creator Hub",
  description:
    "AI-powered tools for content creators. Create stunning images and videos.",
  openGraph: {
    title: "Created with Creator Hub",
    description:
      "AI-powered tools for content creators. Create stunning images and videos.",
    siteName: "Creator Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Created with Creator Hub",
    description:
      "AI-powered tools for content creators. Create stunning images and videos.",
  },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
