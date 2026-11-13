import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const providerSelect = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/provider-select", () => ({
  ProviderSelect: (props: Record<string, unknown>) => {
    providerSelect.props = props;
    return <div data-testid="provider-select" />;
  },
}));

import { toast } from "sonner";
import { BehaviorTab } from "@/components/community-bot/behavior-tab";
import { ChannelsTab } from "@/components/community-bot/channels-tab";
import { ConversationsTab } from "@/components/community-bot/conversations-tab";
import { PlaygroundTab } from "@/components/community-bot/playground-tab";
import {
  useCommunityBotStore,
  type CommunityBotConfig,
  type CommunityChannel,
  type ConversationSummary,
  type ConversationMessage,
} from "@/store/community-bot.store";
import { useCreditsStore } from "@/store/credits.store";
import { fieldByLabel } from "../helpers/dom";

type BotState = ReturnType<typeof useCommunityBotStore.getState>;

const actions = {
  updateConfig: vi.fn(),
  connectTelegram: vi.fn(),
  connectWhatsApp: vi.fn(),
  disconnectChannel: vi.fn(),
  fetchConversations: vi.fn(),
  openConversation: vi.fn(),
  closeConversation: vi.fn(),
  sendPlaygroundMessage: vi.fn(),
};

function setBotState(state: Partial<BotState>) {
  useCommunityBotStore.setState({ ...actions, ...state });
}

beforeEach(() => {
  vi.clearAllMocks();
  useCommunityBotStore.setState(useCommunityBotStore.getInitialState(), true);
  setBotState({});
});

// ─── Behavior ────────────────────────────────────────────────────────

describe("BehaviorTab", () => {
  const config: CommunityBotConfig = {
    id: "cfg",
    userId: "u1",
    isEnabled: false,
    modelId: "deepseek/v4",
    temperature: 0.7,
    maxTokens: 300,
    systemPromptExtra: null,
    useStyleProfile: true,
    historyLength: 10,
    dailyReplyLimit: 200,
    perContactCooldownSec: 30,
  };

  it("shows skeletons until the config loads", () => {
    setBotState({ config: null });
    const { container } = render(<BehaviorTab />);
    expect(screen.queryByText("Save configuration")).toBeNull();
    expect(container.querySelectorAll(".h-96")).toHaveLength(2);
  });

  it("fills the form from the stored config", () => {
    setBotState({ config });
    render(<BehaviorTab />);

    expect(screen.getByText("Temperature: 0.70")).toBeTruthy();
    expect(fieldByLabel("Max reply tokens").value).toBe("300");
    expect(fieldByLabel("Daily reply limit").value).toBe("200");
    expect(providerSelect.props).toMatchObject({
      toolModes: ["chat"],
      value: "deepseek/v4",
    });
    const [autoReplies, styleProfile] = screen.getAllByRole("switch");
    expect(autoReplies!.getAttribute("aria-checked")).toBe("false");
    expect(styleProfile!.getAttribute("aria-checked")).toBe("true");
  });

  it("saves the edited configuration", async () => {
    actions.updateConfig.mockResolvedValue(config);
    setBotState({ config });
    render(<BehaviorTab />);

    fireEvent.click(screen.getAllByRole("switch")[0]!);
    act(() =>
      (providerSelect.props!.onChange as (id: string) => void)(
        "anthropic/claude",
      ),
    );
    fireEvent.change(fieldByLabel("Max reply tokens"), {
      target: { value: "800" },
    });
    fireEvent.change(
      fieldByLabel("Extra instructions for the bot (optional)"),
      {
        target: { value: "  Never discuss pricing.  " },
      },
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Save configuration"));
    });

    expect(actions.updateConfig).toHaveBeenCalledWith({
      isEnabled: true,
      modelId: "anthropic/claude",
      temperature: 0.7,
      maxTokens: 800,
      systemPromptExtra: "Never discuss pricing.",
      useStyleProfile: true,
      historyLength: 10,
      dailyReplyLimit: 200,
      perContactCooldownSec: 30,
    });
    expect(toast.success).toHaveBeenCalledWith("Bot configuration saved");
  });

  it("sends blank extra instructions as undefined", async () => {
    actions.updateConfig.mockResolvedValue(config);
    setBotState({ config: { ...config, systemPromptExtra: "old" } });
    render(<BehaviorTab />);

    fireEvent.change(
      fieldByLabel("Extra instructions for the bot (optional)"),
      {
        target: { value: "   " },
      },
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Save configuration"));
    });

    expect(
      actions.updateConfig.mock.calls[0]![0].systemPromptExtra,
    ).toBeUndefined();
  });

  it("clamps numeric fields to their minimums", () => {
    setBotState({ config });
    render(<BehaviorTab />);

    fireEvent.change(fieldByLabel("Max reply tokens"), {
      target: { value: "10" },
    });
    fireEvent.change(fieldByLabel("Daily reply limit"), {
      target: { value: "-5" },
    });
    fireEvent.change(fieldByLabel("Cooldown per fan (seconds)"), {
      target: { value: "" },
    });

    expect(fieldByLabel("Max reply tokens").value).toBe("50");
    expect(fieldByLabel("Daily reply limit").value).toBe("0");
    expect(fieldByLabel("Cooldown per fan (seconds)").value).toBe("0");
  });

  it("reports a failed save", async () => {
    actions.updateConfig.mockResolvedValue(null);
    setBotState({ config });
    render(<BehaviorTab />);

    await act(async () => {
      fireEvent.click(screen.getByText("Save configuration"));
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Could not save the configuration",
    );
  });

  it("disables saving while a save is in progress", () => {
    setBotState({ config, isSavingConfig: true });
    render(<BehaviorTab />);

    expect(
      (screen.getByText(/Saving/).closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

// ─── Channels ────────────────────────────────────────────────────────

describe("ChannelsTab", () => {
  function channel(overrides: Partial<CommunityChannel>): CommunityChannel {
    return {
      id: "ch",
      type: "TELEGRAM",
      status: "DISCONNECTED",
      externalIdentity: null,
      lastConnectedAt: null,
      lastError: null,
      createdAt: "2026-01-01",
      ...overrides,
    };
  }

  const connectTelegramButton = () =>
    screen.getByText("Connect Telegram").closest("button") as HTMLButtonElement;

  it("shows skeletons while channels load", () => {
    setBotState({ isLoadingChannels: true });
    render(<ChannelsTab />);
    expect(screen.queryByText("Telegram")).toBeNull();
  });

  it("shows all channels, with Instagram marked as coming soon", () => {
    render(<ChannelsTab />);

    expect(screen.getByText("Telegram")).toBeTruthy();
    expect(screen.getByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
    expect(
      (screen.getByText("Coming soon") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getAllByText("Disconnected")).toHaveLength(2);
  });

  describe("Telegram", () => {
    it("keeps the bot token hidden by default", () => {
      render(<ChannelsTab />);

      const tokenInput = fieldByLabel("Bot token") as HTMLInputElement;
      expect(tokenInput.type).toBe("password");
      fireEvent.click(screen.getByText("Show"));
      expect(tokenInput.type).toBe("text");
      fireEvent.click(screen.getByText("Hide"));
      expect(tokenInput.type).toBe("password");
    });

    it("requires a token before connecting", () => {
      render(<ChannelsTab />);
      expect(connectTelegramButton().disabled).toBe(true);
    });

    it("connects with the trimmed token and clears it on success", async () => {
      actions.connectTelegram.mockResolvedValue(true);
      render(<ChannelsTab />);

      fireEvent.change(fieldByLabel("Bot token"), {
        target: { value: "  123:ABC  " },
      });
      await act(async () => {
        fireEvent.click(connectTelegramButton());
      });

      expect(actions.connectTelegram).toHaveBeenCalledWith("123:ABC");
      expect(toast.success).toHaveBeenCalled();
      expect(fieldByLabel("Bot token").value).toBe("");
    });

    it("shows the server error and keeps the token when connecting fails", async () => {
      actions.connectTelegram.mockImplementation(async () => {
        useCommunityBotStore.setState({
          error: "Telegram rejected this bot token",
        });
        return false;
      });
      render(<ChannelsTab />);

      fireEvent.change(fieldByLabel("Bot token"), {
        target: { value: "123:BAD" },
      });
      await act(async () => {
        fireEvent.click(connectTelegramButton());
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Telegram rejected this bot token",
      );
      expect(fieldByLabel("Bot token").value).toBe("123:BAD");
    });

    it("shows a connected bot and lets the user disconnect it", async () => {
      setBotState({
        channels: [channel({ status: "ACTIVE", externalIdentity: "@fan_bot" })],
      });
      render(<ChannelsTab />);

      expect(screen.getByText("Connected")).toBeTruthy();
      expect(screen.getByText("@fan_bot")).toBeTruthy();
      expect(screen.queryByText("Bot token")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });

      expect(actions.disconnectChannel).toHaveBeenCalledWith("TELEGRAM");
      expect(toast.success).toHaveBeenCalledWith("Telegram bot disconnected");
    });

    it("shows the last connection error", () => {
      setBotState({
        channels: [channel({ status: "ERROR", lastError: "Bot was blocked" })],
      });
      render(<ChannelsTab />);

      expect(screen.getByText("Error")).toBeTruthy();
      expect(screen.getByText("Bot was blocked")).toBeTruthy();
    });

    it("disables connecting while a connection is in progress", () => {
      setBotState({ channels: [channel({ status: "CONNECTING" })] });
      render(<ChannelsTab />);

      fireEvent.change(fieldByLabel("Bot token"), {
        target: { value: "123:ABC" },
      });
      const button = screen
        .getAllByText(/Connecting…/)
        .map((el) => el.closest("button"))
        .find(Boolean) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("WhatsApp", () => {
    it("starts QR pairing", async () => {
      actions.connectWhatsApp.mockResolvedValue(true);
      render(<ChannelsTab />);

      await act(async () => {
        fireEvent.click(screen.getByText("Connect WhatsApp"));
      });

      expect(actions.connectWhatsApp).toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("reports a failed pairing start", async () => {
      actions.connectWhatsApp.mockResolvedValue(false);
      render(<ChannelsTab />);

      await act(async () => {
        fireEvent.click(screen.getByText("Connect WhatsApp"));
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to connect WhatsApp");
    });

    it("shows the QR code to scan", () => {
      setBotState({
        channels: [channel({ type: "WHATSAPP", status: "AWAITING_QR" })],
        qrDataUrl: "data:image/png;base64,QR",
      });
      render(<ChannelsTab />);

      expect(
        (screen.getByAltText("WhatsApp QR Code") as HTMLImageElement).src,
      ).toBe("data:image/png;base64,QR");
      expect(screen.getByText("Scan QR code")).toBeTruthy();
      expect(screen.queryByText("Connect WhatsApp")).toBeNull();
    });

    it("shows a placeholder while the QR code is generated", () => {
      setBotState({
        channels: [channel({ type: "WHATSAPP", status: "AWAITING_QR" })],
      });
      render(<ChannelsTab />);
      expect(screen.getByText("Generating QR code…")).toBeTruthy();
    });

    it("shows the linked number and disconnects", async () => {
      setBotState({
        channels: [
          channel({
            type: "WHATSAPP",
            status: "ACTIVE",
            externalIdentity: "+57 300 000",
          }),
        ],
      });
      render(<ChannelsTab />);

      expect(screen.getByText("+57 300 000")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });
      expect(actions.disconnectChannel).toHaveBeenCalledWith("WHATSAPP");
    });

    it("asks to re-link when the session expired", () => {
      setBotState({
        channels: [channel({ type: "WHATSAPP", status: "REQUIRES_RESCAN" })],
      });
      render(<ChannelsTab />);

      expect(screen.getByText("Re-link required")).toBeTruthy();
      expect(screen.getByText("Connect WhatsApp")).toBeTruthy();
    });
  });
});

// ─── Conversations ───────────────────────────────────────────────────

describe("ConversationsTab", () => {
  function conversation(
    overrides: Partial<ConversationSummary>,
  ): ConversationSummary {
    return {
      id: "c1",
      messageCount: 4,
      lastMessageAt: null,
      contact: {
        externalId: "tg-777",
        username: "fan77",
        displayName: "Big Fan",
        isBlocked: false,
      },
      channel: { type: "TELEGRAM" },
      messages: [],
      ...overrides,
    };
  }

  function message(
    overrides: Partial<ConversationMessage>,
  ): ConversationMessage {
    return {
      id: "m",
      direction: "INBOUND",
      content: "",
      status: "SENT",
      skipReason: null,
      modelId: null,
      creditsUsed: null,
      createdAt: "2026-01-01T10:00:00Z",
      ...overrides,
    };
  }

  it("loads conversations on mount", () => {
    render(<ConversationsTab />);
    expect(actions.fetchConversations).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    render(<ConversationsTab />);
    expect(screen.getByText("No conversations yet")).toBeTruthy();
  });

  it("lists conversations with the best available contact name", () => {
    setBotState({
      conversations: [
        conversation({ id: "c1" }),
        conversation({
          id: "c2",
          contact: {
            externalId: "tg-2",
            username: "handle2",
            displayName: null,
            isBlocked: false,
          },
          channel: { type: "WHATSAPP" },
        }),
        conversation({
          id: "c3",
          contact: {
            externalId: "tg-3",
            username: null,
            displayName: null,
            isBlocked: false,
          },
          messages: [
            {
              content: "See you soon!",
              direction: "OUTBOUND",
              status: "SENT",
              createdAt: "",
            },
          ],
        }),
      ],
    });
    render(<ConversationsTab />);

    expect(screen.getByText("Big Fan")).toBeTruthy();
    expect(screen.getByText("handle2")).toBeTruthy();
    expect(screen.getByText("tg-3")).toBeTruthy();
    expect(screen.getByText("Bot: See you soon!")).toBeTruthy();
    expect(screen.getByText("WHATSAPP")).toBeTruthy();
  });

  it("opens a conversation", () => {
    setBotState({ conversations: [conversation({ id: "c9" })] });
    render(<ConversationsTab />);

    fireEvent.click(screen.getByText("Big Fan"));

    expect(actions.openConversation).toHaveBeenCalledWith("c9");
  });

  it("shows the thread with delivery details", () => {
    setBotState({
      conversations: [conversation({})],
      activeConversationId: "c1",
      activeMessages: [
        message({ id: "1", content: "When is the next stream?" }),
        message({
          id: "2",
          direction: "OUTBOUND",
          content: "Friday at 8pm!",
          creditsUsed: 2,
        }),
        message({
          id: "3",
          direction: "OUTBOUND",
          content: "(skipped)",
          status: "SKIPPED",
          skipReason: "DAILY_LIMIT",
        }),
        message({
          id: "4",
          direction: "OUTBOUND",
          content: "Oops",
          status: "FAILED",
        }),
      ],
    });
    render(<ConversationsTab />);

    expect(screen.getByText("When is the next stream?")).toBeTruthy();
    expect(screen.getByText("· 2 cr")).toBeTruthy();
    expect(screen.getByText("· skipped (DAILY_LIMIT)")).toBeTruthy();
    expect(screen.getByText("· delivery failed")).toBeTruthy();

    fireEvent.click(screen.getByText("Back to conversations"));
    expect(actions.closeConversation).toHaveBeenCalled();
  });
});

// ─── Playground ──────────────────────────────────────────────────────

describe("PlaygroundTab", () => {
  const textarea = () =>
    screen.getByPlaceholderText(/Write a message as if you were a fan/);
  const sendButton = () =>
    screen.getByText("Test reply").closest("button") as HTMLButtonElement;

  beforeEach(() => useCreditsStore.setState({ balance: 100 }));

  it("shows an empty state and disables sending blank messages", () => {
    render(<PlaygroundTab />);

    expect(screen.getByText("No previews yet")).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
  });

  it("sends the message, updates the credit balance and clears the box", async () => {
    const result = {
      reply: "See you Friday!",
      modelId: "deepseek/v4",
      creditsUsed: 1,
      balance: 99,
    };
    actions.sendPlaygroundMessage.mockImplementation(async (input: string) => {
      useCommunityBotStore.setState({
        playgroundHistory: [{ input, result }],
        error: null,
      });
    });
    render(<PlaygroundTab />);

    fireEvent.change(textarea(), {
      target: { value: "  When do you stream?  " },
    });
    await act(async () => {
      fireEvent.click(sendButton());
    });

    expect(actions.sendPlaygroundMessage).toHaveBeenCalledWith(
      "When do you stream?",
    );
    expect(useCreditsStore.getState().balance).toBe(99);
    expect((textarea() as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("See you Friday!")).toBeTruthy();
    expect(
      screen.getByText(/deepseek\/v4 · 1 credit · balance 99/),
    ).toBeTruthy();
  });

  it("keeps the message and shows the error when the preview fails", async () => {
    actions.sendPlaygroundMessage.mockImplementation(async () => {
      useCommunityBotStore.setState({ error: "Insufficient credits" });
    });
    render(<PlaygroundTab />);

    fireEvent.change(textarea(), { target: { value: "Hi" } });
    await act(async () => {
      fireEvent.click(sendButton());
    });

    expect(toast.error).toHaveBeenCalledWith("Insufficient credits");
    expect((textarea() as HTMLTextAreaElement).value).toBe("Hi");
    expect(useCreditsStore.getState().balance).toBe(100);
  });

  it("pluralizes credits in the history", () => {
    setBotState({
      playgroundHistory: [
        {
          input: "q",
          result: {
            reply: "a",
            modelId: "pro-model",
            creditsUsed: 3,
            balance: 50,
          },
        },
      ],
    });
    render(<PlaygroundTab />);
    expect(screen.getByText(/pro-model · 3 credits · balance 50/)).toBeTruthy();
  });

  it("blocks sending while a preview is generating", () => {
    setBotState({ isPlaygroundLoading: true });
    render(<PlaygroundTab />);

    expect(
      (screen.getByText(/Generating/).closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
