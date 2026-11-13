"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Textarea,
} from "@creator-hub/ui";
import { useCommunityBotStore } from "@/store/community-bot.store";
import { useCreditsStore } from "@/store/credits.store";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Test-drive the bot's voice before going live. Each preview runs the
 * real pipeline (style profile + configured model) and therefore costs
 * the model's credit cost, exactly like a live reply.
 */
export function PlaygroundTab() {
  const { t } = useI18n();
  const playgroundHistory = useCommunityBotStore((s) => s.playgroundHistory);
  const isLoading = useCommunityBotStore((s) => s.isPlaygroundLoading);
  const sendPlaygroundMessage = useCommunityBotStore(
    (s) => s.sendPlaygroundMessage,
  );
  const setBalance = useCreditsStore((s) => s.setBalance);
  const storeError = useCommunityBotStore((s) => s.error);

  const [message, setMessage] = useState("");

  const handleSend = async () => {
    const text = message.trim();
    if (!text || isLoading) return;

    await sendPlaygroundMessage(text);

    const state = useCommunityBotStore.getState();
    const latest = state.playgroundHistory[0];
    if (state.error) {
      toast.error(state.error);
    } else if (latest) {
      setBalance(latest.result.balance);
      setMessage("");
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-text">
            {t("communityBot.playground.title")}
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={t("communityBot.playground.placeholder")}
            rows={3}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />{" "}
                {t("communityBot.playground.generating")}
              </>
            ) : (
              <>
                <Send size={16} /> {t("communityBot.playground.testReply")}
              </>
            )}
          </Button>
          <p className="text-xs text-text-muted">
            {t("communityBot.playground.hint")}
          </p>
        </CardContent>
      </Card>

      {playgroundHistory.length === 0 ? (
        <EmptyState
          icon="🧪"
          title={t("communityBot.playground.emptyTitle")}
          description={t("communityBot.playground.emptyDescription")}
        />
      ) : (
        <div className="space-y-3">
          {playgroundHistory.map((entry, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-text-dim">
                    {t("communityBot.playground.fanSays")}
                  </p>
                  <p className="text-sm text-text">{entry.input}</p>
                </div>
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {t("communityBot.playground.botReplies")}
                  </p>
                  <p className="mt-1 text-sm text-text whitespace-pre-wrap">
                    {entry.result.reply}
                  </p>
                </div>
                <p className="text-[11px] text-text-dim">
                  {t("communityBot.playground.meta", {
                    model: entry.result.modelId,
                    count: entry.result.creditsUsed,
                    balance: entry.result.balance,
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
