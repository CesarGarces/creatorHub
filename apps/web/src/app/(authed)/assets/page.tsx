"use client";

import { EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

export default function AssetsPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Assets" },
        ]}
      />
      <div className="p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">Assets</h1>
          <p className="mt-1 text-text-muted">Your generated images and files</p>
        </div>

        <EmptyState
          icon="📁"
          title="No assets yet"
          description="Generated images and files will appear here."
          actionLabel="Generate your first thumbnail"
          onAction={() => window.location.href = "/tools/thumbnail-generator"}
        />
      </div>
    </>
  );
}
