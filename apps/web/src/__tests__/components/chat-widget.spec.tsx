import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const stt = vi.hoisted(() => ({
  options: null as null | {
    onPartialTranscript: (t: string, f: boolean) => void;
  },
}));

vi.mock("@/hooks/use-live-speech-to-text", () => ({
  useLiveSpeechToText: (options: NonNullable<typeof stt.options>) => {
    stt.options = options;
    return {
      startListening: vi.fn(async () => {}),
      stopListening: vi.fn(),
      isListening: false,
      isSupported: true,
    };
  },
}));
vi.mock("@/components/modals/upgrade-modal", () => ({
  UpgradeModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="alertdialog">Upgrade required</div> : null,
}));
vi.mock("@/components/provider-select", () => ({
  ProviderSelect: () => <div data-testid="provider-select" />,
}));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

import { ChatWidget } from "@/components/chat/chat-widget";
import { useChatStore } from "@/store/chat.store";
import { useCreditsStore } from "@/store/credits.store";
import { routerMock } from "../mocks/next-navigation";

const chatActions = {
  fetchSessions: vi.fn(),
  fetchSettings: vi.fn(),
  fetchTools: vi.fn(),
  createSession: vi.fn(),
  selectSession: vi.fn(),
  deleteSession: vi.fn(),
  sendMessage: vi.fn(),
  updateSettings: vi.fn(),
  clearActiveSession: vi.fn(),
};
const fetchBalance = vi.fn();

type ChatMessage = ReturnType<typeof useChatStore.getState>["messages"][number];

function msg(
  id: string,
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return { id, role, content, createdAt: "2026-01-01T00:00:00Z" };
}

function renderWidget(
  state: Partial<ReturnType<typeof useChatStore.getState>> = {},
) {
  useChatStore.setState({ ...chatActions, ...state });
  return render(<ChatWidget />);
}

describe("ChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState(useChatStore.getInitialState(), true);
    useCreditsStore.setState({
      ...useCreditsStore.getInitialState(),
      balance: 250,
      plan: "PRO",
      isHydrated: true,
      fetchBalance,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("loads sessions, settings, tools and balance on mount", () => {
    renderWidget();

    expect(chatActions.fetchSessions).toHaveBeenCalled();
    expect(chatActions.fetchSettings).toHaveBeenCalled();
    expect(chatActions.fetchTools).toHaveBeenCalled();
    expect(fetchBalance).toHaveBeenCalled();
    expect(screen.getByText("250 cr")).toBeTruthy();
  });

  describe("opening and closing", () => {
    it("opens from the floating button", () => {
      renderWidget();

      fireEvent.click(screen.getByLabelText("Open chat"));

      expect(useChatStore.getState().isWidgetOpen).toBe(true);
      expect(screen.queryByLabelText("Open chat")).toBeNull();
    });

    it.each([
      [
        "the close button",
        () => fireEvent.click(screen.getByLabelText("Close chat")),
      ],
      ["Escape", () => fireEvent.keyDown(window, { key: "Escape" })],
      [
        "the backdrop",
        () =>
          fireEvent.click(
            document.querySelector('[aria-hidden="true"].fixed') as Element,
          ),
      ],
    ])("closes with %s", (_how, close) => {
      renderWidget({ isWidgetOpen: true });

      act(() => close());

      expect(useChatStore.getState().isWidgetOpen).toBe(false);
    });
  });

  describe("tooltip", () => {
    it("appears after 3s while closed and disappears after 20s", () => {
      vi.useFakeTimers();
      renderWidget();

      expect(screen.queryByRole("tooltip")).toBeNull();
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.getByRole("tooltip").textContent).toContain(
        "Do you need help?",
      );

      act(() => vi.advanceTimersByTime(20000));
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("is never shown once the chat has been opened", () => {
      vi.useFakeTimers();
      renderWidget({ isWidgetOpen: true });

      act(() => vi.advanceTimersByTime(5000));

      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  describe("upgrade prompt", () => {
    it("opens when a FREE user has no credits left", () => {
      useCreditsStore.setState({ balance: 0, plan: "FREE" });
      renderWidget();
      expect(screen.getByRole("alertdialog").textContent).toBe(
        "Upgrade required",
      );
    });

    it.each([
      ["a paid plan", { balance: 0, plan: "PRO" }],
      ["credits remaining", { balance: 5, plan: "FREE" }],
      [
        "the balance still loading",
        { balance: 0, plan: "FREE", isLoading: true },
      ],
      [
        "the balance not yet fetched",
        { balance: 0, plan: "FREE", isHydrated: false },
      ],
    ])("stays closed with %s", (_case, credits) => {
      useCreditsStore.setState(credits);
      renderWidget();
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  describe("input", () => {
    const input = () =>
      screen.getByLabelText("Chat message") as HTMLTextAreaElement;

    it("sends the trimmed message on Enter and clears the box", () => {
      renderWidget({ isWidgetOpen: true });

      fireEvent.change(input(), { target: { value: "  make a thumbnail  " } });
      fireEvent.keyDown(input(), { key: "Enter" });

      expect(chatActions.sendMessage).toHaveBeenCalledWith("make a thumbnail");
      expect(input().value).toBe("");
    });

    it("keeps Shift+Enter for new lines", () => {
      renderWidget({ isWidgetOpen: true });

      fireEvent.change(input(), { target: { value: "line one" } });
      fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });

      expect(chatActions.sendMessage).not.toHaveBeenCalled();
    });

    it("does not send blank messages", () => {
      renderWidget({ isWidgetOpen: true });

      fireEvent.change(input(), { target: { value: "   " } });
      fireEvent.keyDown(input(), { key: "Enter" });

      expect(chatActions.sendMessage).not.toHaveBeenCalled();
      expect(
        (screen.getByLabelText("Send message") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("locks the input while a reply is streaming", () => {
      renderWidget({ isWidgetOpen: true, isStreaming: true });

      expect(input().disabled).toBe(true);
      expect(
        (screen.getByLabelText("Send message") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("fills the box from voice transcripts, committing final utterances", () => {
      renderWidget({ isWidgetOpen: true });

      act(() => stt.options!.onPartialTranscript("hello", false));
      expect(input().value).toBe("hello");
      act(() => stt.options!.onPartialTranscript("hello there", true));
      expect(input().value).toBe("hello there");
      // (Interim text after a committed utterance is currently appended
      // without a separating space — reported as a bug, not asserted here.)
      act(() => stt.options!.onPartialTranscript("how are you", true));
      expect(input().value).toBe("hello there how are you");
    });
  });

  describe("sessions", () => {
    const sessions = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      title: i === 1 ? undefined : `Chat ${i}`,
      model: "m",
      temperature: 0.7,
      maxTokens: 100,
      reasoning: 0.7,
      createdAt: "",
      updatedAt: "",
    }));

    it("shows at most five recent sessions", () => {
      renderWidget({ isWidgetOpen: true, sessions });

      expect(screen.getByText("Chat 0")).toBeTruthy();
      expect(screen.getByText("Chat 4")).toBeTruthy();
      expect(screen.queryByText("Chat 5")).toBeNull();
      // Untitled sessions get a default label.
      expect(screen.getByLabelText("Delete chat")).toBeTruthy();
    });

    it("selects and deletes sessions independently", () => {
      renderWidget({ isWidgetOpen: true, sessions });

      fireEvent.click(screen.getByText("Chat 2"));
      fireEvent.click(screen.getByLabelText("Delete Chat 3"));

      expect(chatActions.selectSession).toHaveBeenCalledWith("s2");
      expect(chatActions.deleteSession).toHaveBeenCalledWith("s3");
      expect(chatActions.selectSession).toHaveBeenCalledTimes(1);
    });

    it("starts a new chat", () => {
      renderWidget({ isWidgetOpen: true });
      fireEvent.click(screen.getByLabelText("New chat"));
      expect(chatActions.clearActiveSession).toHaveBeenCalled();
    });
  });

  describe("settings", () => {
    it("toggles the settings panel and updates values as numbers", () => {
      renderWidget({ isWidgetOpen: true });

      fireEvent.click(screen.getByLabelText("Chat settings"));
      fireEvent.change(screen.getByLabelText("Temperature"), {
        target: { value: "0.2" },
      });
      fireEvent.change(screen.getByLabelText("Max Tokens"), {
        target: { value: "2048" },
      });
      fireEvent.change(screen.getByLabelText("Reasoning"), {
        target: { value: "0.9" },
      });

      expect(chatActions.updateSettings).toHaveBeenCalledWith({
        temperature: 0.2,
      });
      expect(chatActions.updateSettings).toHaveBeenCalledWith({
        maxTokens: 2048,
      });
      expect(chatActions.updateSettings).toHaveBeenCalledWith({
        reasoning: 0.9,
      });

      fireEvent.click(screen.getByLabelText("Close settings"));
      expect(screen.queryByLabelText("Temperature")).toBeNull();
    });
  });

  describe("messages", () => {
    it("offers starter prompts when the conversation is empty", () => {
      renderWidget({ isWidgetOpen: true });

      fireEvent.click(screen.getByText("Translate my script"));

      expect(chatActions.sendMessage).toHaveBeenCalledWith(
        "Translate my script",
      );
    });

    it("renders user and assistant messages", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg("u1", "user", "Hi!"),
          msg("a1", "assistant", "Hello, creator."),
        ],
      });

      expect(screen.getByText("Hi!")).toBeTruthy();
      expect(screen.getByText("Hello, creator.")).toBeTruthy();
      expect(screen.queryByText("How can I help?")).toBeNull();
    });

    it("shows a placeholder while the assistant reply is still empty", () => {
      renderWidget({
        isWidgetOpen: true,
        isStreaming: true,
        messages: [
          msg("u1", "user", "Hi"),
          msg("assistant-123", "assistant", ""),
        ],
      });

      expect(screen.getByText("Making...")).toBeTruthy();
    });

    it("turns a fenced route_to_tool action into a navigation card", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg(
            "a1",
            "assistant",
            'I can do that.\n```json\n{ "action": "route_to_tool", "toolId": "thumbnail-generator", "params": { "prompt": "cat & dog" } }\n```\nClick below.',
          ),
        ],
      });

      expect(screen.getByText("I can do that.")).toBeTruthy();
      expect(screen.getByText("Click below.")).toBeTruthy();
      expect(screen.getByText("Go to Thumbnail")).toBeTruthy();
      expect(screen.queryByText(/"action"/)).toBeNull();

      fireEvent.click(screen.getByText("Open tool"));

      expect(routerMock.push).toHaveBeenCalledWith(
        "/tools/thumbnail-generator?prompt=cat+%26+dog",
      );
      expect(useChatStore.getState().isWidgetOpen).toBe(false);
    });

    it("parses an unfenced action at the end of a reply", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg(
            "a1",
            "assistant",
            'Opening the video tool. {"action": "route_to_tool", "toolId": "video"}',
          ),
        ],
      });

      expect(screen.getByText("Opening the video tool.")).toBeTruthy();
      fireEvent.click(screen.getByText("Open tool"));
      expect(routerMock.push).toHaveBeenCalledWith("/tools/video-generator");
    });

    it("falls back to /tools/<id> for unknown tools", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg(
            "a1",
            "assistant",
            '```json\n{"action":"route_to_tool","toolId":"new-tool"}\n```',
          ),
        ],
      });

      expect(screen.getByText("Go to new-tool")).toBeTruthy();
      fireEvent.click(screen.getByText("Open tool"));
      expect(routerMock.push).toHaveBeenCalledWith("/tools/new-tool");
    });

    it("renders a tweet preview card for preview_tweet actions", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg(
            "a1",
            "assistant",
            '```json\n{"action":"preview_tweet","draftId":"d1","content":"AI is eating the world","topic":"AI"}\n```',
          ),
        ],
      });

      expect(screen.getByText("Tweet Draft")).toBeTruthy();
      expect(screen.getByText("AI is eating the world")).toBeTruthy();
      expect(screen.getByText("Topic: AI")).toBeTruthy();
    });

    it("shows malformed action JSON as plain text", () => {
      const broken = '```json\n{"action":"route_to_tool", toolId: oops}\n```';
      renderWidget({
        isWidgetOpen: true,
        messages: [msg("a1", "assistant", broken)],
      });

      expect(screen.queryByText("Open tool")).toBeNull();
      expect(screen.getByText(/toolId: oops/)).toBeTruthy();
    });

    it("does not parse actions inside user messages", () => {
      renderWidget({
        isWidgetOpen: true,
        messages: [
          msg("u1", "user", '{"action": "route_to_tool", "toolId": "video"}'),
        ],
      });

      expect(screen.queryByText("Open tool")).toBeNull();
    });
  });
});
