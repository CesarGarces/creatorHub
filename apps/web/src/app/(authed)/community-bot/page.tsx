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
import { useI18n } from "@/i18n/i18n-provider";
import { t as translateNow } from "@/i18n/runtime";
import { localizeError } from "@/i18n/errors";

type TabId = "channels" | "behavior" | "conversations" | "playground";

const TABS: Array<{ id: TabId; icon: React.ReactNode }> = [
  { id: "channels", icon: <Plug size={16} /> },
  { id: "behavior", icon: <Settings2 size={16} /> },
  { id: "conversations", icon: <MessagesSquare size={16} /> },
  { id: "playground", icon: <FlaskConical size={16} /> },
];

export default function CommunityBotPage() {
  const { t } = useI18n();
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
          console.log("[Socket] community:channel_status received:", event);
          applyChannelStatus(event);
          console.log(
            "[Socket] Store after applyChannelStatus:",
            useCommunityBotStore.getState().qrDataUrl?.slice(0, 50),
          );
          if (event.status === "ACTIVE") {
            // Socket handlers outlive renders: read the *current* locale.
            toast.success(
              event.externalIdentity
                ? translateNow("communityBot.socket.channelConnectedAs", {
                    identity: event.externalIdentity,
                  })
                : translateNow("communityBot.socket.channelConnected"),
            );
          } else if (event.status === "ERROR") {
            toast.error(
              localizeError(event.error, "communityBot.socket.channelFailed"),
            );
          }
        },
      );

      s.on("community:reply_skipped", (event: { reason: string }) => {
        if (event.reason === "insufficient_credits") {
          toast.error(translateNow("communityBot.socket.outOfCredits"));
        } else if (event.reason === "daily_limit") {
          toast.warning(translateNow("communityBot.socket.dailyLimit"));
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
    <div className="flex flex-col lg:h-full">
      <TopBar title={t("communityBot.title")} />

      {/* Own scroll area on desktop; flows with the page below lg. */}
      <div className="p-4 sm:p-6 space-y-6 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-text">
              {t("communityBot.title")}
            </h2>
            <p className="text-sm text-text-muted max-w-2xl">
              {t("communityBot.description")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        {/* Swipeable on phones; bleeds to the screen edges. */}
        <div
          data-scroll-x
          role="tablist"
          aria-label={t("communityBot.title")}
          className="-mx-4 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-border px-4 scrollbar-none sm:mx-0 sm:px-0"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 pointer-coarse:min-h-11 text-sm font-medium transition-colors border-b-2 -mb-px sm:px-4",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.icon}
              {t(`communityBot.tabs.${tab.id}`)}
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
