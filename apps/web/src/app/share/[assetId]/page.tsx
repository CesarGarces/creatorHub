import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareClient } from "./share-client";
import { getRequestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";

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
  thumbnailUrl: string | null;
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
  const [asset, locale] = await Promise.all([
    getAsset(assetId),
    getRequestLocale(),
  ]);

  if (!asset) {
    return {
      title: translate(locale, "share.meta.notFoundTitle"),
      description: translate(locale, "share.meta.notFoundDescription"),
    };
  }

  const shortPrompt = `${asset.prompt.slice(0, 60)}${asset.prompt.length > 60 ? "..." : ""}`;
  const title = translate(
    locale,
    asset.type === "VIDEO" ? "share.meta.videoTitle" : "share.meta.imageTitle",
    { prompt: shortPrompt },
  );

  const description = translate(
    locale,
    asset.type === "VIDEO"
      ? "share.meta.descriptionVideo"
      : "share.meta.descriptionImage",
    {
      model: asset.model,
      // Strings, so dimensions are not digit-grouped ("1,280").
      width: String(asset.width),
      height: String(asset.height),
      creator:
        asset.creator.name || translate(locale, "share.page.creatorHubUser"),
    },
  );

  // Use thumbnail for videos (social media crawlers can't process video files)
  // For images, use the asset URL directly
  // For videos without thumbnails, use the static placeholder
  const VIDEO_PLACEHOLDER = `${FRONTEND_URL}/video-thumbnail-placeholder.png`;
  const imageUrl =
    asset.type === "VIDEO"
      ? asset.thumbnailUrl || VIDEO_PLACEHOLDER
      : asset.url;
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
          type: "image/jpeg",
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
