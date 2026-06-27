"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/chat.store";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function ChatPanel() {
  const { fetchSessions, fetchSettings, fetchTools, activeSessionId } =
    useChatStore();

  useEffect(() => {
    fetchSessions();
    fetchSettings();
    fetchTools();
  }, [fetchSessions, fetchSettings, fetchTools]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface overflow-hidden">
      <ChatHeader />
      <ChatMessages />
      <ChatInput />
    </div>
  );
}
