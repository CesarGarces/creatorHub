"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Agent to tool mapping
const agentToToolMap: Record<string, string> = {
  "x-post-tweet": "x-post-tweet",
  "x-search-trends": "x-search-trends",
};

export default function AgentChatPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  useEffect(() => {
    // Redirect to the corresponding tool page
    const toolId = agentToToolMap[agentId];
    if (toolId) {
      router.replace(`/tools/${toolId}`);
    } else {
      // Unknown agent, redirect to agents list
      router.replace("/agents");
    }
  }, [agentId, router]);

  // Show loading state while redirecting
  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-text-muted">Redirecting to tool...</p>
      </div>
    </div>
  );
}
