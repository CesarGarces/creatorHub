"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Power, Send, MessageCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Skeleton,
} from "@creator-hub/ui";
import {
  useCommunityBotStore,
  type CommunityChannel,
  type ChannelStatus,
} from "@/store/community-bot.store";
import { useI18n } from "@/i18n/i18n-provider";

// Labels come from `communityBot.status.<STATUS>`.
const STATUS_VARIANT: Record<
  ChannelStatus,
  "primary" | "secondary" | "warning" | "error"
> = {
  ACTIVE: "primary",
  CONNECTING: "warning",
  AWAITING_QR: "warning",
  DISCONNECTED: "secondary",
  REQUIRES_RESCAN: "error",
  ERROR: "error",
};

function useChannel(type: CommunityChannel["type"]) {
  const channels = useCommunityBotStore((s) => s.channels);
  return channels.find((c) => c.type === type);
}

export function ChannelsTab() {
  const { t } = useI18n();
  const isLoading = useCommunityBotStore((s) => s.isLoadingChannels);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TelegramChannelCard />
      <WhatsAppChannelCard />
      <ComingSoonChannelCard
        title="Instagram"
        description={t("communityBot.channels.instagramDescription")}
        phase={t("communityBot.channels.phase", { number: 4 })}
      />
    </div>
  );
}

// ─── Telegram ────────────────────────────────────────────────

function TelegramChannelCard() {
  const { t, rich } = useI18n();
  const channel = useChannel("TELEGRAM");
  const connectTelegram = useCommunityBotStore((s) => s.connectTelegram);
  const disconnectChannel = useCommunityBotStore((s) => s.disconnectChannel);
  const isConnecting = useCommunityBotStore((s) => s.isConnecting);

  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const isBusy =
    isConnecting ||
    channel?.status === "CONNECTING" ||
    channel?.status === "ACTIVE";

  const handleConnect = async () => {
    if (!botToken.trim()) {
      toast.error(t("communityBot.channels.telegram.pasteTokenFirst"));
      return;
    }
    const ok = await connectTelegram(botToken.trim());
    if (ok) {
      toast.success(t("communityBot.channels.telegram.tokenAccepted"));
      setBotToken("");
    } else {
      // Read error after async: Zustand state updated after connectTelegram returned
      const currentError = useCommunityBotStore.getState().error;
      toast.error(currentError || t("communityBot.channels.telegram.failed"));
    }
  };

  const handleDisconnect = async () => {
    await disconnectChannel("TELEGRAM");
    toast.success(t("communityBot.channels.telegram.disconnected"));
  };

  const status = channel?.status ?? "DISCONNECTED";
  const statusVariant = STATUS_VARIANT[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={18} className="text-primary" />
          <h3 className="font-semibold text-text">Telegram</h3>
        </div>
        <Badge variant={statusVariant}>
          {t(`communityBot.status.${status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">
          {rich("communityBot.channels.telegram.description", {
            link: (chunks) => (
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>

        {channel?.externalIdentity && (
          <p className="text-sm text-text">
            {t("communityBot.channels.telegram.bot")}{" "}
            <span className="font-medium text-primary">
              {channel.externalIdentity}
            </span>
          </p>
        )}

        {channel?.lastError && (
          <p className="text-xs text-error">{channel.lastError}</p>
        )}

        {status !== "ACTIVE" && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                label={t("communityBot.channels.telegram.tokenLabel")}
                type={showToken ? "text" : "password"}
                placeholder="123456789:AAE…"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-xs text-text-dim hover:text-text"
              >
                {showToken
                  ? t("communityBot.channels.telegram.hide")
                  : t("communityBot.channels.telegram.show")}
              </button>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isBusy || !botToken.trim()}
              className="w-full"
            >
              {isConnecting || status === "CONNECTING" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />{" "}
                  {t("communityBot.channels.connecting")}
                </>
              ) : (
                t("communityBot.channels.telegram.connect")
              )}
            </Button>
          </div>
        )}

        {status === "ACTIVE" && (
          <Button
            variant="danger"
            onClick={handleDisconnect}
            className="w-full"
          >
            <Power size={16} /> {t("communityBot.channels.disconnect")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── WhatsApp ────────────────────────────────────────────────

function WhatsAppChannelCard() {
  const { t } = useI18n();
  const channel = useChannel("WHATSAPP");
  const connectWhatsApp = useCommunityBotStore((s) => s.connectWhatsApp);
  const disconnectChannel = useCommunityBotStore((s) => s.disconnectChannel);
  const isConnecting = useCommunityBotStore((s) => s.isConnecting);
  const qrDataUrl = useCommunityBotStore((s) => s.qrDataUrl);

  const isBusy =
    isConnecting ||
    channel?.status === "CONNECTING" ||
    channel?.status === "AWAITING_QR" ||
    channel?.status === "ACTIVE";

  const handleConnect = async () => {
    const ok = await connectWhatsApp();
    if (!ok) {
      const currentError = useCommunityBotStore.getState().error;
      toast.error(currentError || t("communityBot.channels.whatsapp.failed"));
    }
  };

  const handleDisconnect = async () => {
    await disconnectChannel("WHATSAPP");
    toast.success(t("communityBot.channels.whatsapp.disconnected"));
  };

  const status = channel?.status ?? "DISCONNECTED";
  const statusVariant = STATUS_VARIANT[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-green-500" />
          <h3 className="font-semibold text-text">WhatsApp</h3>
        </div>
        <Badge variant={statusVariant}>
          {t(`communityBot.status.${status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">
          {t("communityBot.channels.whatsapp.description")}
        </p>

        {channel?.externalIdentity && status === "ACTIVE" && (
          <p className="text-sm text-text">
            {t("communityBot.channels.whatsapp.number")}{" "}
            <span className="font-medium text-green-500">
              {channel.externalIdentity}
            </span>
          </p>
        )}

        {channel?.lastError && (
          <p className="text-xs text-error">{channel.lastError}</p>
        )}

        {status === "AWAITING_QR" && qrDataUrl && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-text-muted">
              {t("communityBot.channels.whatsapp.scanQr")}
            </p>
            <img
              src={qrDataUrl}
              alt={t("communityBot.channels.whatsapp.qrAlt")}
              className="w-48 h-48 rounded-lg border border-border"
            />
            <p className="text-xs text-text-dim">
              {t("communityBot.channels.whatsapp.qrInstructions")}
            </p>
          </div>
        )}

        {status === "AWAITING_QR" && !qrDataUrl && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin text-green-500" />
            <p className="text-sm text-text-muted">
              {t("communityBot.channels.whatsapp.generatingQr")}
            </p>
          </div>
        )}

        {status !== "ACTIVE" && status !== "AWAITING_QR" && (
          <Button onClick={handleConnect} disabled={isBusy} className="w-full">
            {isConnecting || status === "CONNECTING" ? (
              <>
                <Loader2 size={16} className="animate-spin" />{" "}
                {t("communityBot.channels.connecting")}
              </>
            ) : (
              t("communityBot.channels.whatsapp.connect")
            )}
          </Button>
        )}

        {status === "ACTIVE" && (
          <Button
            variant="danger"
            onClick={handleDisconnect}
            className="w-full"
          >
            <Power size={16} /> {t("communityBot.channels.disconnect")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Upcoming channels ───────────────────────────────────────

function ComingSoonChannelCard({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  const { t } = useI18n();
  return (
    <Card className="opacity-70">
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="font-semibold text-text">{title}</h3>
        <Badge variant="secondary">{phase}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">{description}</p>
        <Button disabled variant="secondary" className="w-full">
          {t("communityBot.channels.comingSoon")}
        </Button>
      </CardContent>
    </Card>
  );
}
