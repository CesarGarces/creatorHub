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

const STATUS_META: Record<
  ChannelStatus,
  { label: string; variant: "primary" | "secondary" | "warning" | "error" }
> = {
  ACTIVE: { label: "Connected", variant: "primary" },
  CONNECTING: { label: "Connecting…", variant: "warning" },
  AWAITING_QR: { label: "Scan QR code", variant: "warning" },
  DISCONNECTED: { label: "Disconnected", variant: "secondary" },
  REQUIRES_RESCAN: { label: "Re-link required", variant: "error" },
  ERROR: { label: "Error", variant: "error" },
};

function useChannel(type: CommunityChannel["type"]) {
  const channels = useCommunityBotStore((s) => s.channels);
  return channels.find((c) => c.type === type);
}

export function ChannelsTab() {
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
        description="Reply to DMs and comments through the official Meta API."
        phase="Phase 4"
      />
    </div>
  );
}

// ─── Telegram ────────────────────────────────────────────────

function TelegramChannelCard() {
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
      toast.error("Paste your bot token from @BotFather first");
      return;
    }
    const ok = await connectTelegram(botToken.trim());
    if (ok) {
      toast.success("Token accepted — the worker is bringing your bot online");
      setBotToken("");
    } else {
      // Read error after async: Zustand state updated after connectTelegram returned
      const currentError = useCommunityBotStore.getState().error;
      toast.error(currentError || "Failed to connect Telegram");
    }
  };

  const handleDisconnect = async () => {
    await disconnectChannel("TELEGRAM");
    toast.success("Telegram bot disconnected");
  };

  const status = channel?.status ?? "DISCONNECTED";
  const meta = STATUS_META[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={18} className="text-primary" />
          <h3 className="font-semibold text-text">Telegram</h3>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">
          Create a bot with{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            @BotFather
          </a>{" "}
          (free, 2 minutes) and paste the token here. The bot replies to private
          messages in your voice.
        </p>

        {channel?.externalIdentity && (
          <p className="text-sm text-text">
            Bot:{" "}
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
                label="Bot token"
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
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isBusy || !botToken.trim()}
              className="w-full"
            >
              {isConnecting || status === "CONNECTING" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Connecting…
                </>
              ) : (
                "Connect Telegram"
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
            <Power size={16} /> Disconnect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── WhatsApp ────────────────────────────────────────────────

function WhatsAppChannelCard() {
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
      toast.error(currentError || "Failed to connect WhatsApp");
    }
  };

  const handleDisconnect = async () => {
    await disconnectChannel("WHATSAPP");
    toast.success("WhatsApp disconnected");
  };

  const status = channel?.status ?? "DISCONNECTED";
  const meta = STATUS_META[status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-green-500" />
          <h3 className="font-semibold text-text">WhatsApp</h3>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">
          Link your personal WhatsApp number via QR code (like WhatsApp Web).
          Unlimited and free — no Meta API fees.
        </p>

        {channel?.externalIdentity && status === "ACTIVE" && (
          <p className="text-sm text-text">
            Number:{" "}
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
              Scan this QR code with WhatsApp:
            </p>
            <img
              src={qrDataUrl}
              alt="WhatsApp QR Code"
              className="w-48 h-48 rounded-lg border border-border"
            />
            <p className="text-xs text-text-dim">
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
          </div>
        )}

        {status === "AWAITING_QR" && !qrDataUrl && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="animate-spin text-green-500" />
            <p className="text-sm text-text-muted">Generating QR code…</p>
          </div>
        )}

        {status !== "ACTIVE" && status !== "AWAITING_QR" && (
          <Button onClick={handleConnect} disabled={isBusy} className="w-full">
            {isConnecting || status === "CONNECTING" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Connecting…
              </>
            ) : (
              "Connect WhatsApp"
            )}
          </Button>
        )}

        {status === "ACTIVE" && (
          <Button
            variant="danger"
            onClick={handleDisconnect}
            className="w-full"
          >
            <Power size={16} /> Disconnect
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
  return (
    <Card className="opacity-70">
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="font-semibold text-text">{title}</h3>
        <Badge variant="secondary">{phase}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">{description}</p>
        <Button disabled variant="secondary" className="w-full">
          Coming soon
        </Button>
      </CardContent>
    </Card>
  );
}
