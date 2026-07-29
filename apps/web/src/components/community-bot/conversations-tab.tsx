"use client";

import { useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  ScrollArea,
  Skeleton,
  cn,
} from "@creator-hub/ui";
import { useCommunityBotStore } from "@/store/community-bot.store";

export function ConversationsTab() {
  const conversations = useCommunityBotStore((s) => s.conversations);
  const isLoading = useCommunityBotStore((s) => s.isLoadingConversations);
  const activeConversationId = useCommunityBotStore(
    (s) => s.activeConversationId,
  );
  const fetchConversations = useCommunityBotStore((s) => s.fetchConversations);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No conversations yet"
        description="Once your bot is connected and fans start writing, every exchange will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        className={cn(
          "lg:col-span-1",
          activeConversationId && "hidden lg:block",
        )}
      >
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <ConversationList />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "lg:col-span-2",
          !activeConversationId && "hidden lg:block",
        )}
      >
        <CardContent className="p-4">
          {activeConversationId ? (
            <MessageThread />
          ) : (
            <div className="hidden lg:flex h-[520px] items-center justify-center text-sm text-text-muted">
              Select a conversation to read the thread
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── List ────────────────────────────────────────────────────

function ConversationList() {
  const conversations = useCommunityBotStore((s) => s.conversations);
  const activeConversationId = useCommunityBotStore(
    (s) => s.activeConversationId,
  );
  const openConversation = useCommunityBotStore((s) => s.openConversation);

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => {
        const last = conversation.messages[0];
        const contactName =
          conversation.contact.displayName ||
          conversation.contact.username ||
          conversation.contact.externalId;

        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => void openConversation(conversation.id)}
            className={cn(
              "w-full text-left px-4 py-3 transition-colors hover:bg-surface-elevated",
              activeConversationId === conversation.id && "bg-surface-elevated",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text truncate">
                {contactName}
              </span>
              <Badge variant="secondary" className="shrink-0">
                {conversation.channel.type === "TELEGRAM" ? (
                  <Send size={10} className="mr-1" />
                ) : null}
                {conversation.channel.type}
              </Badge>
            </div>
            {last && (
              <p className="mt-1 text-xs text-text-muted truncate">
                {last.direction === "OUTBOUND" ? "Bot: " : ""}
                {last.content}
              </p>
            )}
            <p className="mt-0.5 text-[10px] text-text-dim">
              {conversation.messageCount} messages
              {conversation.lastMessageAt &&
                ` · ${new Date(conversation.lastMessageAt).toLocaleString()}`}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Thread ──────────────────────────────────────────────────

function MessageThread() {
  const activeMessages = useCommunityBotStore((s) => s.activeMessages);
  const isLoading = useCommunityBotStore((s) => s.isLoadingMessages);
  const closeConversation = useCommunityBotStore((s) => s.closeConversation);

  if (isLoading) {
    return <Skeleton className="h-[520px] rounded-xl" />;
  }

  return (
    <div className="flex flex-col h-[520px]">
      <button
        type="button"
        onClick={closeConversation}
        className="mb-3 flex items-center gap-1 text-sm text-text-muted hover:text-text lg:hidden"
      >
        <ArrowLeft size={14} /> Back to conversations
      </button>

      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-3">
          {activeMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                message.direction === "INBOUND"
                  ? "bg-surface-elevated text-text"
                  : "ml-auto bg-primary/15 text-text border border-primary/20",
              )}
            >
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
              <p className="mt-1 text-[10px] text-text-dim flex items-center gap-2">
                <span>{new Date(message.createdAt).toLocaleString()}</span>
                {message.direction === "OUTBOUND" &&
                  message.creditsUsed !== null && (
                    <span>· {message.creditsUsed} cr</span>
                  )}
                {message.status === "SKIPPED" && (
                  <span className="text-warning">
                    · skipped ({message.skipReason})
                  </span>
                )}
                {message.status === "FAILED" && (
                  <span className="text-error">· delivery failed</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
