"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  FlaskConical,
  MessagesSquare,
  Plug,
  Settings2,
} from "lucide-react";
import { cn } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { connectSocket } from "@/lib/socket";
import { useCommunityBotStore } from "@/store/community-bot.store";
import { useCreditsStore } from "@/store/credits.store";
import { ChannelsTab } from "@/components/community-bot/channels-tab";
import { BehaviorTab } from "@/components/community-bot/behavior-tab";
import { ConversationsTab } from "@/components/community-bot/conversations-tab";
import { PlaygroundTab } from "@/components/community-bot/playground-tab";

type TabId = "channels" | "behavior" | "conversations" | "playground";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "channels", label: "Channels", icon: <Plug size={16} /> },
  { id: "behavior", label: "Behavior", icon: <Settings2 size={16} /> },
  {
    id: "conversations",
    label: "Conversations",
    icon: <MessagesSquare size={16} />,
  },
  { id: "playground", label: "Playground", icon: <FlaskConical size={16} /> },
];

export default function CommunityBotPage() {
  const [activeTab, setActiveTab] = useState<TabId>("channels");

  const fetchConfig = useCommunityBotStore((s) => s.fetchConfig);
  const fetchChannels = useCommunityBotStore((s) => s.fetchChannels);
  const fetchConversations = useCommunityBotStore((s) => s.fetchConversations);
  const applyChannelStatus = useCommunityBotStore((s) => s.applyChannelStatus);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);

  useEffect(() => {
    void fetchConfig();
    void fetchChannels();
  }, [fetchConfig, fetchChannels]);

  // Live updates from the worker (via Redis → API → WebSocket)
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    function attach() {
      // socket is non-null: the guard above already returned if null.
      const s = socket!;

      s.on(
        "community:channel_status",
        (event: {
          channelId: string;
          status:
            | "DISCONNECTED"
            | "CONNECTING"
            | "AWAITING_QR"
            | "ACTIVE"
            | "REQUIRES_RESCAN"
            | "ERROR";
          externalIdentity?: string;
          error?: string;
          qrDataUrl?: string;
        }) => {
          applyChannelStatus(event);
          if (event.status === "ACTIVE") {
            toast.success(
              `Channel connected${event.externalIdentity ? ` as ${event.externalIdentity}` : ""}`,
            );
          } else if (event.status === "ERROR") {
            toast.error(event.error || "Channel connection failed");
          }
        },
      );

      s.on("community:reply_skipped", (event: { reason: string }) => {
        if (event.reason === "insufficient_credits") {
          toast.error(
            "Community bot paused: you ran out of credits. Top up to keep replying.",
          );
        } else if (event.reason === "daily_limit") {
          toast.warning(
            "Community bot hit the daily reply limit you configured.",
          );
        }
      });

      s.on("community:message_received", () => {
        if (activeTab === "conversations") void fetchConversations();
      });

      s.on("community:reply_sent", () => {
        fetchBalance();
        if (activeTab === "conversations") void fetchConversations();
      });
    }

    if (socket.connected) {
      attach();
    } else {
      socket.on("connect", attach);
      socket.connect();
    }

    return () => {
      socket.off("connect", attach);
      socket.off("community:channel_status");
      socket.off("community:reply_skipped");
      socket.off("community:message_received");
      socket.off("community:reply_sent");
    };
  }, [activeTab, applyChannelStatus, fetchBalance, fetchConversations]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Community Bot" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text">Community Bot</h2>
            <p className="text-sm text-text-muted max-w-2xl">
              Connect your community channels and let the bot reply to your fans
              in your own voice, powered by your style profile and the AI model
              of your choice. Each reply costs credits like any generation.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "channels" && <ChannelsTab />}
        {activeTab === "behavior" && <BehaviorTab />}
        {activeTab === "conversations" && <ConversationsTab />}
        {activeTab === "playground" && <PlaygroundTab />}
      </div>
    </div>
  );
}
