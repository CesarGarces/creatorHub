import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareClient } from "./share-client";

// Force dynamic rendering — asset can toggle public/private at any time
// Social media crawlers will still get the OG tags from server-rendered HTML
export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api/v1";

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://app.creatorhubplatform.com";

interface AssetData {
  id: string;
  prompt: string;
  type: "IMAGE" | "VIDEO";
  width: number;
  height: number;
  model: string;
  provider: string;
  url: string;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

async function getAsset(assetId: string): Promise<AssetData | null> {
  try {
    const res = await fetch(`${API_URL}/sharing/${assetId}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    return res.json();
  } catch {
    return null;
  }
}

type PageProps = {
  params: Promise<{ assetId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { assetId } = await params;
  const asset = await getAsset(assetId);

  if (!asset) {
    return {
      title: "Asset Not Found | Creator Hub",
      description: "This asset could not be found or is not public.",
    };
  }

  const title =
    asset.type === "VIDEO"
      ? `Video: "${asset.prompt.slice(0, 60)}${asset.prompt.length > 60 ? "..." : ""}" | Creator Hub`
      : `"${asset.prompt.slice(0, 60)}${asset.prompt.length > 60 ? "..." : ""}" | Creator Hub`;

  const description =
    `Created with ${asset.model} — ${asset.width}x${asset.height} ` +
    `${asset.type.toLowerCase()} by ${asset.creator.name || "a Creator Hub user"}. ` +
    `Join free and create your own.`;

  const imageUrl = asset.url;
  const pageUrl = `${FRONTEND_URL}/share/${assetId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Creator Hub",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: asset.width,
          height: asset.height,
          alt: asset.prompt,
          type: asset.type === "VIDEO" ? "video.other" : "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { assetId } = await params;
  const asset = await getAsset(assetId);

  if (!asset) {
    notFound();
  }

  return <ShareClient asset={asset} assetId={assetId} />;
}
