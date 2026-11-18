import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  VoiceAssistantEvent,
  VoiceAssistantRequest,
} from "@creator-hub/shared-types";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const stream = vi.hoisted(() => ({
  impl: null as
    | null
    | ((
        request: VoiceAssistantRequest,
        onEvent: (event: VoiceAssistantEvent) => void,
        signal?: AbortSignal,
      ) => Promise<unknown>),
}));

vi.mock("@/lib/voice-assistant/stream", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  streamAssistantReply: vi.fn(
    (
      request: VoiceAssistantRequest,
      onEvent: (event: VoiceAssistantEvent) => void,
      signal?: AbortSignal,
    ) => stream.impl!(request, onEvent, signal),
  ),
}));

import api from "@/lib/api";
import {
  AssistantStreamError,
  streamAssistantReply,
} from "@/lib/voice-assistant/stream";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import { useCreditsStore } from "@/store/credits.store";

const apiMock = vi.mocked(api);

const DONE = {
  type: "done" as const,
  messageId: "m2",
  content: "¡Hola! ¿Qué tal?",
  language: "es" as const,
  audioMs: 1800,
  credits: 1,
  balance: 41,
};

/** A reply: start → deltas → audio → done. */
function reply(conversationId = "c1") {
  stream.impl = async (_request, onEvent) => {
    onEvent({
      type: "start",
      conversationId,
      userMessageId: "m1",
      language: "es",
      voice: { model: "aura-2-celeste-es", name: "Celeste" },
      title: "Hola Robotina",
    });
    onEvent({ type: "delta", content: "¡Hola! " });
    onEvent({ type: "delta", content: "¿Qué tal?" });
    onEvent({
      type: "audio",
      index: 0,
      mimeType: "audio/mpeg",
      data: "AAA=",
      durationMs: 1800,
      text: "¡Hola! ¿Qué tal?",
    });
    onEvent(DONE);
    return DONE;
  };
}

const state = () => useVoiceAssistantStore.getState();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useVoiceAssistantStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    isReplying: false,
    isLoadingConversation: false,
    preferencesLoaded: false,
    handsFree: true,
    allowance: null,
    settings: {
      model: "deepseek-ai/DeepSeek-V4-Flash",
      temperature: 0.7,
      maxTokens: 300,
    },
  });
});

describe("voice assistant store — sending", () => {
  it("streams a spoken reply into the conversation", async () => {
    reply();
    const events: string[] = [];

    const done = await state().sendMessage("  Hola Robotina ", {
      spoken: true,
      languageHint: "es",
      onEvent: (e) => events.push(e.type),
    });

    expect(done).toEqual(DONE);
    expect(streamAssistantReply).toHaveBeenCalledWith(
      {
        conversationId: undefined,
        content: "Hola Robotina",
        spoken: true,
        model: "deepseek-ai/DeepSeek-V4-Flash",
        temperature: 0.7,
        maxTokens: 300,
        languageHint: "es",
        // The browser's zone, for the dates and times of actions.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      expect.any(Function),
      undefined,
    );
    expect(events).toEqual(["start", "delta", "delta", "audio", "done"]);
    expect(state().activeConversationId).toBe("c1");
    expect(state().isReplying).toBe(false);
    expect(state().messages).toEqual([
      expect.objectContaining({
        id: "m1",
        role: "user",
        content: "Hola Robotina",
        spoken: true,
        language: "es",
      }),
      expect.objectContaining({
        id: "m2",
        role: "assistant",
        content: "¡Hola! ¿Qué tal?",
        spoken: true,
        audioMs: 1800,
        credits: 1,
        streaming: false,
      }),
    ]);
    expect(state().conversations[0]).toMatchObject({
      id: "c1",
      title: "Hola Robotina",
      lastMessage: "¡Hola! ¿Qué tal?",
    });
    expect(useCreditsStore.getState().balance).toBe(41);
  });

  it("tracks her actions on the reply (running → done)", async () => {
    const record = {
      id: "a1",
      name: "calendar.create_event",
      args: { title: "Grabar" },
    };
    stream.impl = async (_r, onEvent) => {
      onEvent({ type: "delta", content: "Lo agendo. " });
      onEvent({ type: "action", ...record, status: "running" });
      expect(state().messages[1]!.actions).toEqual([
        { ...record, status: "running" },
      ]);
      onEvent({
        type: "action",
        ...record,
        status: "done",
        summary: "Created",
        data: {
          kind: "calendar-agenda",
          from: "2026-11-28",
          days: 1,
          events: [],
          url: "/tools/content-planner",
        },
      });
      onEvent({ type: "delta", content: "¡Listo!" });
      onEvent(DONE);
      return DONE;
    };

    await state().sendMessage("Agenda grabar", { spoken: true });

    expect(state().messages[1]!.actions).toEqual([
      expect.objectContaining({ id: "a1", status: "done", summary: "Created" }),
    ]);
  });

  it("continues the active conversation", async () => {
    reply("c9");
    useVoiceAssistantStore.setState({ activeConversationId: "c9" });
    await state().sendMessage("¿y tú?", { spoken: false });
    expect(vi.mocked(streamAssistantReply).mock.calls[0]![0]).toMatchObject({
      conversationId: "c9",
      spoken: false,
    });
  });

  it("ignores empty messages and messages while replying", async () => {
    reply();
    expect(await state().sendMessage("   ", { spoken: false })).toBeNull();
    useVoiceAssistantStore.setState({ isReplying: true });
    expect(await state().sendMessage("hi", { spoken: false })).toBeNull();
    expect(streamAssistantReply).not.toHaveBeenCalled();
  });

  it("marks the voice failure of a reply", async () => {
    stream.impl = async (_r, onEvent) => {
      onEvent({ type: "audio_error", error: "down" });
      onEvent({ ...DONE, audioMs: 0 });
      return DONE;
    };
    await state().sendMessage("hi", { spoken: true });
    expect(state().messages[1]).toMatchObject({
      voiceFailed: true,
      spoken: false,
    });
  });

  it("marks when her voice stopped for the Free plan's minutes", async () => {
    stream.impl = async (_r, onEvent) => {
      onEvent({ type: "audio_error", error: "x", reason: "free-limit" });
      onEvent({ ...DONE, audioMs: 0 });
      return DONE;
    };
    await state().sendMessage("hi", { spoken: true });
    expect(state().messages[1]).toMatchObject({ voiceFailed: "free-limit" });
  });

  it("a refused reply (Free minutes used up) leaves no turn and marks the limit", async () => {
    stream.impl = async () => {
      throw new AssistantStreamError(
        "You've used all your free minutes with Robotina.",
        403,
        "FREE_LIMIT_REACHED",
      );
    };
    await expect(state().sendMessage("hola", { spoken: true })).rejects.toThrow(
      /free minutes/,
    );
    expect(state().messages).toEqual([]);
    expect(state().allowance).toMatchObject({
      limited: true,
      exhausted: true,
      remainingSeconds: 0,
    });
  });

  it("keeps what was said when the user interrupts", async () => {
    stream.impl = async (_r, onEvent) => {
      onEvent({ type: "delta", content: "Half" });
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    };
    const abort = new AbortController();
    expect(
      await state().sendMessage("hi", { spoken: true, signal: abort.signal }),
    ).toBeNull();
    expect(state().messages[1]).toMatchObject({
      content: "Half",
      interrupted: true,
      streaming: false,
    });
  });

  it("drops an empty reply that was interrupted", async () => {
    stream.impl = async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    };
    await state().sendMessage("hi", { spoken: true });
    expect(state().messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("shows the error and forgets a new conversation that failed", async () => {
    stream.impl = async (_r, onEvent) => {
      onEvent({
        type: "start",
        conversationId: "c-new",
        userMessageId: "m1",
        language: "en",
        voice: null,
        title: "hi",
      });
      throw new Error(
        "Robotina couldn't answer. Try again or choose another model.",
      );
    };
    await expect(state().sendMessage("hi", { spoken: false })).rejects.toThrow(
      /couldn't answer/,
    );
    expect(state().messages[1]).toMatchObject({
      error: "Robotina couldn't answer. Try again or choose another model.",
      streaming: false,
    });
    expect(state().activeConversationId).toBeNull();
    expect(state().conversations).toEqual([]);
    expect(state().isReplying).toBe(false);
  });
});

describe("voice assistant store — history and preferences", () => {
  it("loads the conversation list", async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: "c1", title: "Hi" }],
    } as never);
    await state().fetchConversations();
    expect(apiMock.get).toHaveBeenCalledWith(
      "/tools/voice-assistant/conversations",
      { params: { limit: "50" } },
    );
    expect(state().conversations).toEqual([{ id: "c1", title: "Hi" }]);
  });

  it("keeps a conversation started while the list was loading", async () => {
    apiMock.get.mockResolvedValue({ data: [{ id: "old" }] } as never);
    useVoiceAssistantStore.setState({
      activeConversationId: "new",
      conversations: [{ id: "new" }, { id: "stale" }] as never,
    });
    await state().fetchConversations();
    expect(state().conversations).toEqual([{ id: "new" }, { id: "old" }]);
  });

  it("opens a conversation with its messages", async () => {
    apiMock.get.mockResolvedValue({
      data: {
        id: "c1",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Hi",
            language: "en",
            spoken: true,
            voice: null,
            audioMs: 0,
            creditsCharged: 0,
            interrupted: false,
            actions: [],
            createdAt: "2026-11-27T10:00:00Z",
          },
          {
            id: "m2",
            role: "assistant",
            content: "¡Listo!",
            language: "es",
            spoken: true,
            voice: "aura-2-celeste-es",
            audioMs: 900,
            creditsCharged: 1,
            interrupted: false,
            actions: [
              {
                id: "a1",
                name: "calendar.create_event",
                status: "done",
                args: {},
              },
            ],
            createdAt: "2026-11-27T10:00:01Z",
          },
        ],
      },
    } as never);
    await state().openConversation("c1");
    expect(state().activeConversationId).toBe("c1");
    expect(state().messages).toEqual([
      {
        id: "m1",
        role: "user",
        content: "Hi",
        spoken: true,
        language: "en",
        audioMs: 0,
        credits: 0,
        interrupted: false,
      },
      expect.objectContaining({
        id: "m2",
        actions: [
          { id: "a1", name: "calendar.create_event", status: "done", args: {} },
        ],
      }),
    ]);
  });

  it("deletes a conversation and clears it if it was open", async () => {
    apiMock.delete.mockResolvedValue(undefined as never);
    useVoiceAssistantStore.setState({
      conversations: [{ id: "c1" }, { id: "c2" }] as never,
      activeConversationId: "c1",
      messages: [{ id: "m1" }] as never,
    });
    await state().deleteConversation("c1");
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/voice-assistant/conversations/c1",
    );
    expect(state().conversations).toEqual([{ id: "c2" }]);
    expect(state().activeConversationId).toBeNull();
    expect(state().messages).toEqual([]);
  });

  it("persists the model settings and conversation mode", () => {
    state().updateSettings({ temperature: 0.2 });
    state().setHandsFree(false);
    useVoiceAssistantStore.setState({ preferencesLoaded: false });
    useVoiceAssistantStore.setState({ handsFree: true });
    state().loadPreferences();
    expect(state().handsFree).toBe(false);
    expect(state().settings.temperature).toBe(0.2);
  });
});

describe("voice assistant store — Free plan minutes", () => {
  const ALLOWANCE = {
    limited: true,
    period: "monthly",
    limitSeconds: 600,
    usedSeconds: 200,
    remainingSeconds: 400,
    exhausted: false,
    resetsAt: "2026-12-01T00:00:00.000Z",
  };

  it("loads what the user has left", async () => {
    apiMock.get.mockResolvedValueOnce(ALLOWANCE);
    await state().loadAllowance();
    expect(apiMock.get).toHaveBeenCalledWith("/voice/allowance");
    expect(state().allowance).toEqual(ALLOWANCE);
  });

  it("ignores bad answers and errors", async () => {
    apiMock.get.mockResolvedValueOnce({ nope: true });
    await state().loadAllowance();
    apiMock.get.mockRejectedValueOnce(new Error("offline"));
    await state().loadAllowance();
    expect(state().allowance).toBeNull();
  });

  it("refreshes it after a reply when the user is limited", async () => {
    useVoiceAssistantStore.setState({ allowance: ALLOWANCE as never });
    apiMock.get.mockResolvedValue({ ...ALLOWANCE, remainingSeconds: 390 });
    reply();
    await state().sendMessage("hola", { spoken: true });
    await vi.waitFor(() =>
      expect(state().allowance?.remainingSeconds).toBe(390),
    );
  });
});
