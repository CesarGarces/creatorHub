import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {
  VoiceAssistantEvent,
  VoiceAssistantRequest,
} from "@creator-hub/shared-types";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(async (path: string) => {
      if (path === "/credits/balance") {
        return {
          balance: 20,
          currentCredits: 20,
          purchasedCredits: 0,
          plan: "FREE",
        };
      }
      if (path === "/tools/voice-assistant/conversations") return { data: [] };
      return [];
    }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

/** Fake STT (the platform's Deepgram socket): tests drive its callbacks. */
const stt = vi.hoisted(() => ({
  options: null as null | {
    onPartialTranscript: (text: string, isFinal: boolean) => void;
    onUtteranceEnd: () => void;
    onResult: (t: string, d: number, c: number) => void;
    onError: (e: string, code?: string) => void;
    purpose?: string;
  },
  startListening: vi.fn(async () => {}),
  stopListening: vi.fn(),
  getLevel: vi.fn(() => 0.4),
  isSupported: true,
}));

vi.mock("@/hooks/use-live-speech-to-text", () => ({
  useLiveSpeechToText: (options: NonNullable<typeof stt.options>) => {
    stt.options = options;
    return {
      startListening: stt.startListening,
      stopListening: stt.stopListening,
      isListening: false,
      isSupported: stt.isSupported,
      getLevel: stt.getLevel,
    };
  },
}));

/** Fake reply stream: `reply.impl` decides what the server answers. */
const reply = vi.hoisted(() => ({
  impl: null as
    | null
    | ((
        request: VoiceAssistantRequest,
        onEvent: (event: VoiceAssistantEvent) => void,
        signal?: AbortSignal,
      ) => Promise<unknown>),
  calls: [] as Array<{ request: VoiceAssistantRequest; signal?: AbortSignal }>,
}));

vi.mock("@/lib/voice-assistant/stream", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  streamAssistantReply: (
    request: VoiceAssistantRequest,
    onEvent: (event: VoiceAssistantEvent) => void,
    signal?: AbortSignal,
  ) => {
    reply.calls.push({ request, signal });
    return reply.impl!(request, onEvent, signal);
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VoiceAssistantWidget } from "@/components/dashboard-widgets/widgets/voice-assistant-widget";
import { AssistantActionCard } from "@/components/voice-assistant/assistant-action-card";
import VoiceAssistantPage from "@/app/(authed)/tools/voice-assistant/page";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import { __resetVoicePricingCache } from "@/components/voice-button/use-voice-pricing";
import api from "@/lib/api";
import { AssistantStreamError } from "@/lib/voice-assistant/stream";

const done = (content = "¡Hola! Estoy muy bien.") =>
  ({
    type: "done",
    messageId: "m2",
    content,
    language: "es",
    audioMs: 0,
    credits: 1,
    balance: 20,
  }) as const;

/** The server answers at once (text + done, no audio: silent player). */
function answers(content = "¡Hola! Estoy muy bien.") {
  reply.impl = async (_request, onEvent) => {
    onEvent({
      type: "start",
      conversationId: "c1",
      userMessageId: "m1",
      language: "es",
      voice: { model: "aura-2-celeste-es", name: "Celeste" },
      title: "Hola",
    });
    onEvent({ type: "delta", content });
    onEvent(done(content));
    return done(content);
  };
}

const orb = () => screen.getByRole("button", { name: /Robotina|Done talking/ });
const status = () => screen.getByRole("status");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  __resetVoicePricingCache();
  stt.options = null;
  stt.isSupported = true;
  stt.startListening.mockClear();
  stt.stopListening.mockClear();
  reply.calls = [];
  answers();
  vi.stubGlobal(
    "Audio",
    vi.fn(function (this: { play: () => Promise<void> }) {
      this.play = () => Promise.resolve();
    }),
  );
  // jsdom has no canvas: the orb draws nothing but still renders.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  useVoiceAssistantStore.setState({
    conversations: [],
    activeConversationId: null,
    messages: [],
    isReplying: false,
    isLoadingConversation: false,
    isLoadingConversations: false,
    preferencesLoaded: false,
    handsFree: true,
    allowance: null,
  });
});

afterEach(() => {
  cleanup(); // unmount first: it closes an open mic (end sound)
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Tap the orb, say something, pause: the turn ends and is sent. */
async function talk(text: string) {
  await act(async () => {
    fireEvent.click(orb());
  });
  act(() => stt.options!.onPartialTranscript(text, false));
  act(() => stt.options!.onPartialTranscript(text, true));
  await act(async () => {
    vi.advanceTimersByTime(3000); // end of speech (3 s pause)
  });
  await act(async () => {
    stt.options!.onResult(text, 2500, 1);
  });
}

describe("Robotina dashboard widget", () => {
  it("shows the orb, its status, prices and a link to the chat", () => {
    render(<VoiceAssistantWidget />);
    expect(screen.getByRole("heading", { name: "Robotina" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Talk to Robotina" }),
    ).toBeTruthy();
    expect(status().textContent).toBe("Tap to talk");
    expect(
      screen.getByText("60 cr/min voice · 120 cr/min spoken reply"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open chat" }).getAttribute("href"),
    ).toBe("/tools/voice-assistant");
    expect(
      document.querySelector("canvas[data-orb-state='idle']"),
    ).toBeTruthy();
  });

  it("listens on tap, shows what you say, and answers out loud", async () => {
    useVoiceAssistantStore.setState({
      handsFree: false,
      preferencesLoaded: true,
    });
    render(<VoiceAssistantWidget />);

    await act(async () => {
      fireEvent.click(orb());
    });
    expect(stt.startListening).toHaveBeenCalledTimes(1);
    expect(status().textContent).toBe("Listening…");
    expect(
      screen.getByRole("button", { name: "Done talking — send" }),
    ).toBeTruthy();

    act(() => stt.options!.onPartialTranscript("Hola Robotina", false));
    expect(screen.getByText("Hola Robotina")).toBeTruthy();
    act(() =>
      stt.options!.onPartialTranscript("Hola Robotina, ¿cómo estás?", true),
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(stt.stopListening).toHaveBeenCalledTimes(1);
    expect(status().textContent).toBe("Thinking…");

    await act(async () => {
      stt.options!.onResult("Hola Robotina, ¿cómo estás?", 2500, 1);
    });

    expect(reply.calls[0]!.request).toMatchObject({
      content: "Hola Robotina, ¿cómo estás?",
      spoken: true, // she answers with her voice
      languageHint: "en",
    });
    await waitFor(() => expect(status().textContent).toBe("Tap to talk"));
    expect(screen.getByText("¡Hola! Estoy muy bien.")).toBeTruthy();
  });

  it("conversation mode listens again after she answers", async () => {
    render(<VoiceAssistantWidget />);
    await talk("Hola");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(stt.startListening).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe("Listening…");
  });

  it("keeps the conversation loop under StrictMode (double mount in dev)", async () => {
    render(
      <StrictMode>
        <VoiceAssistantWidget />
      </StrictMode>,
    );
    await talk("Hola");
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(stt.startListening).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe("Listening…");
  });

  it("stops the conversation after a long silence", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(stt.stopListening).toHaveBeenCalledTimes(1);
    await act(async () => {
      stt.options!.onResult("", 8000, 1);
    });
    expect(reply.calls).toHaveLength(0);
    expect(status().textContent).toBe("Tap to talk");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(stt.startListening).toHaveBeenCalledTimes(1);
  });

  it("a second tap sends at once", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() => stt.options!.onPartialTranscript("Cuéntame un chiste", false));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Done talking — send" }),
      );
    });
    expect(stt.stopListening).toHaveBeenCalledTimes(1);
  });

  it("sends words that never became final (stalled turn, empty result)", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() => stt.options!.onPartialTranscript("¿Qué tal el clima", false));
    await act(async () => {
      vi.advanceTimersByTime(4900);
    });
    // Interim words alone never close the mic early…
    expect(stt.stopListening).not.toHaveBeenCalled();
    expect(status().textContent).toBe("Listening…");
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    // …but a stalled turn ends, and what was heard is not lost.
    expect(stt.stopListening).toHaveBeenCalledTimes(1);
    await act(async () => {
      stt.options!.onResult("", 5000, 1);
    });
    expect(reply.calls[0]!.request).toMatchObject({
      content: "¿Qué tal el clima",
    });
  });

  it("uses what was heard when the STT result never comes", async () => {
    useVoiceAssistantStore.setState({
      handsFree: false,
      preferencesLoaded: true,
    });
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() => stt.options!.onPartialTranscript("Hello there", true));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(status().textContent).toBe("Thinking…");
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(reply.calls).toHaveLength(1);
    expect(reply.calls[0]!.request).toMatchObject({ content: "Hello there" });
    // A result arriving afterwards doesn't send it twice.
    await act(async () => {
      stt.options!.onResult("Hello there", 3000, 1);
    });
    expect(reply.calls).toHaveLength(1);
  });

  it("explains a lost voice connection in the user's language", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() =>
      stt.options!.onError(
        "The voice connection was interrupted",
        "PROVIDER_CLOSED",
      ),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "The voice connection was interrupted. Try again.",
    );
    expect(status().textContent).toBe("Tap to talk");
  });

  it("tapping while she thinks interrupts her and listens", async () => {
    let signal: AbortSignal | undefined;
    reply.impl = (_r, _onEvent, s) => {
      signal = s;
      return new Promise(() => {}); // never answers
    };
    render(<VoiceAssistantWidget />);
    await talk("Hola");
    expect(status().textContent).toBe("Thinking…");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Interrupt Robotina and talk" }),
      );
    });
    expect(signal?.aborted).toBe(true);
    expect(stt.startListening).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe("Listening…");
  });

  it("ending the conversation discards what was being said", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
    });
    expect(stt.stopListening).toHaveBeenCalledTimes(1);
    await act(async () => {
      stt.options!.onResult("something", 1000, 1);
    });
    expect(reply.calls).toHaveLength(0);
    expect(status().textContent).toBe("Tap to talk");
  });

  it("shows voice input errors (e.g. not enough credits)", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() =>
      stt.options!.onError(
        "You need at least 5 credits to use voice recording",
      ),
    );
    expect(screen.getByRole("alert").textContent).toContain("5 credits");
    expect(status().textContent).toBe("Tap to talk");
  });

  it("saves conversation mode", () => {
    render(<VoiceAssistantWidget />);
    const toggle = screen.getByRole("switch", { name: "Conversation mode" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(useVoiceAssistantStore.getState().handsFree).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("creator_hub.voice_assistant.prefs")!)
        .handsFree,
    ).toBe(false);
  });

  it("plays her voice and waves while speaking", async () => {
    // Fake Web Audio: decoding works, sources end when the test says so.
    const sources: Array<{ onended: (() => void) | null }> = [];
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = async () => undefined;
      close = async () => undefined;
      createAnalyser() {
        return {
          fftSize: 512,
          connect() {},
          getFloatTimeDomainData: (d: Float32Array) => d.fill(0.2),
        };
      }
      async decodeAudioData() {
        return { duration: 1 };
      }
      createBufferSource() {
        const source = {
          buffer: null,
          onended: null as (() => void) | null,
          connect() {},
          start() {},
          stop() {},
        };
        sources.push(source);
        return source;
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    useVoiceAssistantStore.setState({
      handsFree: false,
      preferencesLoaded: true,
    });
    reply.impl = async (_r, onEvent) => {
      onEvent({ type: "delta", content: "Hola." });
      onEvent({
        type: "audio",
        index: 0,
        mimeType: "audio/mpeg",
        data: "AAAA",
        durationMs: 1000,
        text: "Hola.",
      });
      onEvent({ ...done("Hola."), audioMs: 1000 });
      return { ...done("Hola."), audioMs: 1000 };
    };

    render(<VoiceAssistantWidget />);
    await talk("Hola");
    await waitFor(() => expect(status().textContent).toBe("Speaking…"));
    expect(
      document.querySelector("canvas[data-orb-state='speaking']"),
    ).toBeTruthy();

    await act(async () => {
      sources[0]!.onended?.();
    });
    expect(status().textContent).toBe("Tap to talk");
  });
});

describe("Robotina tool page", () => {
  it("looks like the other chat tools: history, settings, voice and composer", async () => {
    render(<VoiceAssistantPage />);
    expect(
      screen.getByRole("heading", { name: "Robotina — AI voice assistant" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Talk to Robotina" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Start voice input" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Type a message or tap the mic…" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show History" }));
    expect(await screen.findByText("No conversations yet")).toBeTruthy();
    expect(
      screen.getByText(
        "Voice input 60 cr/min · Reply 1 cr (spoken: 120 cr/min)",
      ),
    ).toBeTruthy();
  });

  it("answers typed messages in text (no voice)", async () => {
    render(<VoiceAssistantPage />);
    const input = screen.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    fireEvent.change(input, { target: { value: "Tell me a joke" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(reply.calls[0]!.request).toMatchObject({
      content: "Tell me a joke",
      spoken: false,
    });
    await waitFor(() =>
      expect(screen.getByText("¡Hola! Estoy muy bien.")).toBeTruthy(),
    );
    expect(screen.getByText("1 cr")).toBeTruthy();
    // The new conversation shows up in the history.
    fireEvent.click(screen.getByRole("button", { name: "Show History" }));
    expect(screen.getByRole("button", { name: /^Hola/ })).toBeTruthy();
  });

  it("sends spoken messages with the voice button, reply out loud", async () => {
    useVoiceAssistantStore.setState({
      handsFree: false,
      preferencesLoaded: true,
    });
    render(<VoiceAssistantPage />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Start voice input" }),
      );
    });
    expect(stt.startListening).toHaveBeenCalled();
    act(() => stt.options!.onPartialTranscript("Olá, tudo bem?", true));
    expect(screen.getByText("Olá, tudo bem?")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      stt.options!.onResult("Olá, tudo bem?", 1500, 1);
    });
    expect(reply.calls[0]!.request).toMatchObject({
      content: "Olá, tudo bem?",
      spoken: true,
    });
  });

  it("configures only the text model: the voices come from Admin → Voice", async () => {
    const get = vi.mocked(api.get);
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (path: string, ...rest: unknown[]) =>
      path === "/voice/pricing"
        ? {
            stt: { model: "nova-3", creditsPerMinute: 1 },
            tts: {
              creditsPerMinute: 2,
              voices: {
                en: {
                  model: "aura-2-orion-en",
                  name: "Orion",
                  accent: "American",
                  gender: "masculine",
                },
                es: {
                  model: "aura-2-estrella-es",
                  name: "Estrella",
                  accent: "Mexican",
                  gender: "feminine",
                },
                pt: {
                  model: "flux-bianca-pt",
                  name: "Bianca",
                  accent: "Brazilian",
                  gender: "feminine",
                },
              },
            },
          }
        : (original as (...args: unknown[]) => unknown)(path, ...rest),
    );
    try {
      render(<VoiceAssistantPage />);
      fireEvent.click(screen.getByRole("button", { name: "Model settings" }));
      expect(screen.getByText(/Her voice is Deepgram/)).toBeTruthy();
      expect(await screen.findByText(/Estrella · Spanish/)).toBeTruthy();
      expect(screen.getByText(/Orion · English/)).toBeTruthy();
      expect(
        screen.getByRole("switch", { name: "Conversation mode" }),
      ).toBeTruthy();
      // One model selector (the text model) — no voice/TTS selector.
      expect(screen.queryAllByRole("combobox").length).toBeLessThanOrEqual(1);
      expect(screen.queryByText(/text-to-speech model|TTS model/i)).toBeNull();
    } finally {
      get.mockImplementation(original);
    }
  });

  it("says when her voice stopped because the credits ran out", async () => {
    reply.impl = async (_r, onEvent) => {
      onEvent({
        type: "start",
        conversationId: "c1",
        userMessageId: "u1",
        language: "en",
        voice: { model: "aura-2-andromeda-en", name: "Andromeda" },
        title: "Hi",
      });
      onEvent({ type: "delta", content: "Hello! The rest goes in text." });
      onEvent({
        type: "audio_error",
        reason: "credits",
        error: "Not enough credits for her voice — the rest is in text.",
      });
      onEvent({
        type: "done",
        messageId: "m2",
        content: "Hello! The rest goes in text.",
        language: "en",
        audioMs: 0,
        credits: 1,
        balance: 0,
      });
      return true;
    };
    render(<VoiceAssistantPage />);
    const input = screen.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    fireEvent.change(input, { target: { value: "Hi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(
      await screen.findByText(
        "Not enough credits for her voice — the rest is in text",
      ),
    ).toBeTruthy();
  });

  it("shows a readable error when she can't answer", async () => {
    reply.impl = async () => {
      throw new Error(
        "Robotina couldn't answer. Try again or choose another model.",
      );
    };
    render(<VoiceAssistantPage />);
    const input = screen.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    fireEvent.change(input, { target: { value: "Hi" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((a) => a.textContent?.includes("choose another model")),
      ).toBe(true),
    );
  });
});

describe("Robotina actions", () => {
  const created = {
    kind: "calendar-event" as const,
    change: "created" as const,
    event: {
      id: "ev1",
      title: "Grabar el unboxing",
      type: "RECORDING",
      startAt: "2026-11-28T20:00:00.000Z",
      endAt: "2026-11-28T21:00:00.000Z",
    },
    conflicts: [
      {
        id: "ev9",
        title: "Weekly livestream",
        type: "LIVESTREAM",
        startAt: "2026-11-28T20:30:00.000Z",
        endAt: "2026-11-28T22:00:00.000Z",
      },
    ],
    url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
  };

  /** The server creates an event during the reply. */
  function createsEvent() {
    reply.impl = async (_request, onEvent) => {
      onEvent({
        type: "start",
        conversationId: "c1",
        userMessageId: "m1",
        language: "es",
        voice: null,
        title: "Agenda",
      });
      onEvent({ type: "delta", content: "Perfecto, lo agendo. " });
      const base = {
        type: "action" as const,
        id: "a1",
        name: "calendar.create_event",
        args: { title: "Grabar el unboxing" },
      };
      onEvent({ ...base, status: "running" });
      onEvent({ ...base, status: "done", summary: "Created", data: created });
      onEvent({ type: "delta", content: "¡Listo!" });
      onEvent(done("Perfecto, lo agendo. ¡Listo!"));
      return done("Perfecto, lo agendo. ¡Listo!");
    };
  }

  it("shows the session she created, its overlap and a link to the planner", async () => {
    createsEvent();
    render(<VoiceAssistantPage />);
    const input = screen.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    fireEvent.change(input, {
      target: { value: "Agenda grabar mañana de 3 a 4" },
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() =>
      expect(screen.getByText("Added to your calendar")).toBeTruthy(),
    );
    expect(screen.getByText("Grabar el unboxing")).toBeTruthy();
    expect(screen.getByText(/Recording ·/)).toBeTruthy();
    expect(screen.getByText(/Overlaps with Weekly livestream/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open in planner →" })
        .getAttribute("href"),
    ).toBe(created.url);
    expect(reply.calls[0]!.request.timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("refreshes the planner's data (Plans for today) at once", async () => {
    createsEvent();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    useVoiceAssistantStore.setState({
      handsFree: false,
      preferencesLoaded: true,
    });
    render(
      <QueryClientProvider client={client}>
        <VoiceAssistantWidget />
      </QueryClientProvider>,
    );

    await talk("Agenda grabar mañana de 3 a 4");

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["content-planner"] });
    // The widget shows it too, compact, linking to the planner.
    const link = await screen.findByRole("link", {
      name: /Grabar el unboxing/,
    });
    expect(link.getAttribute("href")).toBe(created.url);
  });
});

describe("AssistantActionCard", () => {
  const base = { id: "a1", args: {} };

  it("shows the action while it runs", () => {
    render(
      <AssistantActionCard
        action={{ ...base, name: "calendar.list_events", status: "running" }}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Checking your calendar…",
    );
  });

  it("says when it couldn't be done (she explains why)", () => {
    render(
      <AssistantActionCard
        action={{ ...base, name: "calendar.create_event", status: "failed" }}
      />,
    );
    expect(screen.getByText("Couldn't complete it")).toBeTruthy();
  });

  it("lists the agenda she read", () => {
    const event = (id: string, title: string) => ({
      id,
      title,
      type: "SCRIPTING",
      startAt: "2026-11-28T14:00:00.000Z",
      endAt: "2026-11-28T15:00:00.000Z",
    });
    render(
      <AssistantActionCard
        action={{
          ...base,
          name: "calendar.list_events",
          status: "done",
          data: {
            kind: "calendar-agenda",
            from: "2026-11-28",
            days: 1,
            events: ["a", "b", "c", "d", "e", "f"].map((id) =>
              event(id, `Session ${id}`),
            ),
            url: "/tools/content-planner",
          },
        }}
      />,
    );
    expect(screen.getByText("Your calendar")).toBeTruthy();
    expect(screen.getByText("Session a")).toBeTruthy();
    expect(screen.queryByText("Session e")).toBeNull();
    expect(screen.getByText("+2 more")).toBeTruthy();
  });

  it("says when nothing is planned", () => {
    render(
      <AssistantActionCard
        action={{
          ...base,
          name: "calendar.list_events",
          status: "done",
          data: {
            kind: "calendar-agenda",
            from: "2026-11-28",
            days: 1,
            events: [],
            url: "/tools/content-planner",
          },
        }}
      />,
    );
    expect(screen.getByText("Nothing planned")).toBeTruthy();
  });
});

describe("Conversation mode during an action", () => {
  it("keeps her turn while she searches: thinking + what she's doing, mic closed", async () => {
    const sources: Array<{ onended: (() => void) | null }> = [];
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = async () => undefined;
      close = async () => undefined;
      createAnalyser() {
        return {
          fftSize: 512,
          connect() {},
          getFloatTimeDomainData: (d: Float32Array) => d.fill(0.2),
        };
      }
      async decodeAudioData() {
        return { duration: 1 };
      }
      createBufferSource() {
        const source = {
          buffer: null,
          onended: null as (() => void) | null,
          connect() {},
          start() {},
          stop() {},
        };
        sources.push(source);
        return source;
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    let finish!: () => void;
    reply.impl = (_r, onEvent) =>
      new Promise((resolve) => {
        onEvent({ type: "delta", content: "Ok, lo busco ahora." });
        onEvent({
          type: "audio",
          index: 0,
          mimeType: "audio/mpeg",
          data: "AAAA",
          durationMs: 1000,
          text: "Ok",
        });
        onEvent({
          type: "action",
          id: "a1",
          name: "calendar.list_events",
          args: {},
          status: "running",
        });
        finish = () => {
          onEvent({
            type: "action",
            id: "a1",
            name: "calendar.list_events",
            args: {},
            status: "done",
            summary: "x",
          });
          onEvent({ type: "delta", content: " Tienes dos." });
          onEvent({
            type: "audio",
            index: 1,
            mimeType: "audio/mpeg",
            data: "AAAA",
            durationMs: 1000,
            text: "Tienes",
          });
          onEvent(done("Ok, lo busco ahora. Tienes dos."));
          resolve(done("Ok, lo busco ahora. Tienes dos."));
        };
      });
    render(<VoiceAssistantWidget />);
    await talk("¿Tengo planes mañana?");
    await waitFor(() => expect(sources.length).toBe(1));
    await act(async () => {
      sources[0]!.onended?.();
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    // Her first sentence ended; the search is running: still her turn.
    expect(status().textContent).toBe("Checking your calendar…");
    expect(
      document.querySelector("canvas[data-orb-state='thinking']"),
    ).toBeTruthy();
    expect(stt.startListening).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    await waitFor(() => expect(sources.length).toBe(2));
    await act(async () => {
      sources[1]!.onended?.();
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    // Only after her last word does the mic reopen (conversation mode).
    expect(stt.startListening).toHaveBeenCalledTimes(2);
    expect(status().textContent).toBe("Listening…");
  });
});

describe("AssistantActionCard — edits, deletions and projects", () => {
  const slot = {
    id: "ev1",
    title: "Grabar el unboxing",
    type: "RECORDING",
    startAt: "2026-11-28T22:00:00.000Z",
    endAt: "2026-11-28T23:00:00.000Z",
  };
  const record = (
    status: string,
    data: unknown,
    name = "calendar.update_event",
  ) => ({ id: "a1", name, args: {}, status, data }) as never;

  it("shows a moved session with its previous time", () => {
    render(
      <AssistantActionCard
        action={record("done", {
          kind: "calendar-event",
          change: "updated",
          event: slot,
          previous: {
            startAt: "2026-11-28T20:00:00.000Z",
            endAt: "2026-11-28T21:00:00.000Z",
          },
          conflicts: [],
          url: "/tools/content-planner",
        })}
      />,
    );
    expect(screen.getByText("Updated in your calendar")).toBeTruthy();
    expect(screen.getByText(/^Was /)).toBeTruthy();
  });

  it("asks for the OK before deleting, then shows it deleted", () => {
    const data = {
      kind: "calendar-event",
      change: "deleted",
      event: slot,
      conflicts: [],
      url: "/tools/content-planner",
    };
    const { rerender } = render(
      <AssistantActionCard
        action={record("needs_confirmation", data, "calendar.delete_event")}
      />,
    );
    expect(screen.getByText("Waiting for your OK to delete")).toBeTruthy();
    expect(screen.getByText("Say “yes” to confirm")).toBeTruthy();
    expect(screen.getByText("Grabar el unboxing").className).not.toContain(
      "line-through",
    );

    rerender(
      <AssistantActionCard
        action={record("done", data, "calendar.delete_event")}
      />,
    );
    expect(screen.getByText("Deleted from your calendar")).toBeTruthy();
    expect(screen.getByText("Grabar el unboxing").className).toContain(
      "line-through",
    );
    expect(
      screen.queryByRole("link", { name: "Open in planner →" }),
    ).toBeNull();
  });

  it("shows video projects: created, deleted with its sessions, and the list", () => {
    const project = {
      id: "p1",
      title: "Review del teléfono",
      platform: "youtube-long",
      publishAt: "2026-12-10T23:00:00.000Z",
      sessions: { total: 3, done: 1 },
    };
    const { rerender } = render(
      <AssistantActionCard
        action={record(
          "done",
          { kind: "calendar-project", change: "created", project, url: "/x" },
          "calendar.create_project",
        )}
      />,
    );
    expect(screen.getByText("Video project created")).toBeTruthy();
    expect(screen.getByText(/Publishes .* · 1\/3 sessions done/)).toBeTruthy();

    rerender(
      <AssistantActionCard
        action={record(
          "needs_confirmation",
          { kind: "calendar-project", change: "deleted", project, url: "/x" },
          "calendar.delete_project",
        )}
      />,
    );
    expect(screen.getByText("Waiting for your OK to delete")).toBeTruthy();
    expect(screen.getByText(/With its 3 sessions/)).toBeTruthy();

    rerender(
      <AssistantActionCard
        action={record(
          "done",
          {
            kind: "calendar-projects",
            projects: [
              project,
              { ...project, id: "p2", title: "Vlog", publishAt: null },
            ],
            url: "/x",
          },
          "calendar.list_projects",
        )}
      />,
    );
    expect(screen.getByText("Your video projects")).toBeTruthy();
    expect(screen.getByText("No publish date")).toBeTruthy();
  });

  it("says what she's doing while each kind of action runs", () => {
    const { rerender } = render(
      <AssistantActionCard
        action={record("running", undefined, "calendar.update_event")}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Updating your calendar…",
    );
    rerender(
      <AssistantActionCard
        action={record("running", undefined, "calendar.delete_project")}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Preparing the deletion…",
    );
  });

  it("still shows actions saved before edits existed (no `change`)", () => {
    render(
      <AssistantActionCard
        action={record(
          "done",
          { kind: "calendar-event", event: slot, conflicts: [], url: "/x" },
          "calendar.create_event",
        )}
      />,
    );
    expect(screen.getByText("Added to your calendar")).toBeTruthy();
  });
});

describe("Robotina on the Free plan (minutes set in Admin → Voice)", () => {
  const PRICING = {
    stt: { model: "nova-3", creditsPerMinute: 1 },
    freeTier: { minutes: 10, period: "monthly" },
    tts: {
      creditsPerMinute: 2,
      voices: {
        en: {
          model: "aura-2-andromeda-en",
          name: "Andromeda",
          accent: "American",
          gender: "feminine",
        },
        es: {
          model: "aura-2-celeste-es",
          name: "Celeste",
          accent: "Colombian",
          gender: "feminine",
        },
        pt: {
          model: "flux-bianca-pt",
          name: "Bianca",
          accent: "Brazilian",
          gender: "feminine",
        },
      },
    },
  };
  const allowance = (remainingSeconds: number) => ({
    limited: true,
    period: "monthly",
    limitSeconds: 600,
    usedSeconds: 600 - remainingSeconds,
    remainingSeconds,
    exhausted: remainingSeconds === 0,
    resetsAt: "2026-12-01T00:00:00.000Z",
  });

  /** Serves the voice pricing and the user's allowance for one test. */
  function serve(remainingSeconds: number) {
    const get = vi.mocked(api.get);
    const original = get.getMockImplementation()!;
    get.mockImplementation(async (path: string, ...rest: unknown[]) =>
      path === "/voice/pricing"
        ? PRICING
        : path === "/voice/allowance"
          ? allowance(remainingSeconds)
          : (original as (...args: unknown[]) => unknown)(path, ...rest),
    );
    return () => get.mockImplementation(original);
  }

  it("shows the minutes left, and Robotina's voice input counts them", async () => {
    const restore = serve(420);
    try {
      render(<VoiceAssistantWidget />);
      expect(
        await screen.findByText(
          "Free plan: 7 of 10 minutes with Robotina left this month",
        ),
      ).toBeTruthy();
      // Her ears tell the server it's Robotina (the Free minutes apply).
      expect(stt.options?.purpose).toBe("voice-assistant");
      await act(async () => {
        fireEvent.click(orb());
      });
      expect(stt.startListening).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("used up: invites to upgrade and doesn't listen", async () => {
    const restore = serve(0);
    try {
      render(<VoiceAssistantWidget />);
      expect(
        await screen.findByText(
          "You've used your 10 free minutes with Robotina",
        ),
      ).toBeTruthy();
      expect(screen.getByText(/They come back on December 1/)).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "Upgrade for unlimited use" })
          .getAttribute("href"),
      ).toBe("/credits");
      const button = orb() as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      await act(async () => {
        fireEvent.click(button);
      });
      expect(stt.startListening).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("when the server refuses a reply, the invitation replaces the error", async () => {
    reply.impl = async () => {
      throw new AssistantStreamError(
        "You've used all your free minutes with Robotina. Upgrade your plan for unlimited use.",
        403,
        "FREE_LIMIT_REACHED",
      );
    };
    render(<VoiceAssistantPage />);
    const input = screen.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    fireEvent.change(input, { target: { value: "Hola" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(
      await screen.findByRole("link", { name: "Upgrade for unlimited use" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByText("Hola")).toBeNull();
  });

  it("when the voice is refused mid-conversation, the invitation shows", async () => {
    render(<VoiceAssistantWidget />);
    await act(async () => {
      fireEvent.click(orb());
    });
    act(() =>
      stt.options!.onError(
        "You've used all your free minutes with Robotina. Upgrade your plan for unlimited use.",
        "FREE_LIMIT_REACHED",
      ),
    );
    expect(
      screen.getByRole("link", { name: "Upgrade for unlimited use" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(status().textContent).toBe("Tap to talk");
  });
});
