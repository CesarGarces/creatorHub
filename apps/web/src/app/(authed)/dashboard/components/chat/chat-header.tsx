"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chat.store";
import { ChatSettings } from "./chat-settings";

export function ChatHeader() {
  const {
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    clearActiveSession,
  } = useChatStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="relative border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-2 text-sm font-medium text-text hover:text-primary transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {activeSession?.title || "New Chat"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Chat Settings"
            className="rounded-lg p-1.5 text-text-dim hover:text-text hover:bg-surface-elevated transition-colors"
            title="Chat Settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {showSessions && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-surface-elevated shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              Sessions
            </span>
            <button
              type="button"
              onClick={() => {
                clearActiveSession();
                setShowSessions(false);
              }}
              className="text-xs text-primary hover:text-primary-hover"
            >
              + New
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface transition-colors ${
                  session.id === activeSessionId ? "bg-primary/10" : ""
                }`}
                onClick={() => {
                  selectSession(session.id);
                  setShowSessions(false);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    {session.title || "Untitled Chat"}
                  </p>
                  <p className="text-xs text-text-dim">
                    {session._count?.messages || 0} messages
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  aria-label="Delete session"
                  className="ml-2 rounded p-1 text-text-dim hover:text-error hover:bg-error/10 transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-text-dim">
                No sessions yet
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && <ChatSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
