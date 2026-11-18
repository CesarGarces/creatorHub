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
    onError: (e: string) => void;
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

import { VoiceAssistantWidget } from "@/components/dashboard-widgets/widgets/voice-assistant-widget";
import VoiceAssistantPage from "@/app/(authed)/tools/voice-assistant/page";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import { __resetSttRateCache } from "@/components/voice-button/use-stt-rate";

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
  __resetSttRateCache();
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
    expect(screen.getByText("1 cr/min voice · 1 cr/reply")).toBeTruthy();
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
      screen.getByText("Voice input 1 cr/min · Reply 1 cr (spoken: 1 cr/min)"),
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

  it("configures only the text model: the voice is fixed (Aura-2 by language)", () => {
    render(<VoiceAssistantPage />);
    fireEvent.click(screen.getByRole("button", { name: "Model settings" }));
    expect(
      screen.getByText(/Her voice is Deepgram Aura-2/).textContent,
    ).toContain("Andromeda (English), Celeste (Spanish), Bianca (Portuguese)");
    expect(
      screen.getByRole("switch", { name: "Conversation mode" }),
    ).toBeTruthy();
    // One model selector (the text model) — no voice/TTS selector.
    expect(screen.queryAllByRole("combobox").length).toBeLessThanOrEqual(1);
    expect(screen.queryByText(/text-to-speech model|TTS model/i)).toBeNull();
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
