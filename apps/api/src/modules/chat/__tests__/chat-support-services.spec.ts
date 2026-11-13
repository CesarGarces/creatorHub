import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolRegistry } from "@creator-hub/tool-sdk";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { toolManifest } from "../../../__tests__/helpers/tool-manifest";
import { ChatSettingsService } from "../chat-settings.service";
import { ChatHistoryService } from "../chat-history.service";
import { ChatRoutingService } from "../chat-routing.service";

beforeEach(() => resetPrismaMock());

describe("ChatSettingsService", () => {
  const service = new ChatSettingsService();

  it("returns existing settings", async () => {
    const stored = { userId: "u1", defaultModel: "m", temperature: 0.2 };
    prismaMock.chatSettings.findUnique.mockResolvedValue(stored);

    expect(await service.getSettings("u1")).toBe(stored);
    expect(prismaMock.chatSettings.create).not.toHaveBeenCalled();
  });

  it("creates default settings on first access", async () => {
    prismaMock.chatSettings.findUnique.mockResolvedValue(null);
    prismaMock.chatSettings.create.mockImplementation(async ({ data }) => data);

    expect(await service.getSettings("u1")).toEqual({
      userId: "u1",
      defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
      temperature: 0.7,
      maxTokens: 8000,
      reasoning: 0.7,
    });
  });

  it("upserts settings, keeping explicit zero values", async () => {
    await service.updateSettings("u1", { temperature: 0, reasoning: 0 });

    const args = prismaMock.chatSettings.upsert.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "u1" });
    expect(args.create).toEqual({
      userId: "u1",
      defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
      temperature: 0,
      maxTokens: 8000,
      reasoning: 0,
    });
    expect(args.update).toEqual({ temperature: 0, reasoning: 0 });
  });
});

describe("ChatHistoryService", () => {
  const service = new ChatHistoryService();

  it("lists a user's sessions, most recent first, with message counts", async () => {
    await service.listSessions("u1");

    expect(prismaMock.chatSession.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });
  });

  it("throws when a session does not exist", async () => {
    prismaMock.chatSession.findUnique.mockResolvedValue(null);

    await expect(service.getSession("missing")).rejects.toThrow(
      "Chat session not found: missing",
    );
  });

  it("returns a session with its messages in chronological order", async () => {
    const session = { id: "s1", messages: [] };
    prismaMock.chatSession.findUnique.mockResolvedValue(session);

    expect(await service.getSession("s1")).toBe(session);
    expect(
      prismaMock.chatSession.findUnique.mock.calls[0]![0].include.messages,
    ).toEqual({ orderBy: { createdAt: "asc" } });
  });

  it("stores messages, omitting empty tool calls", async () => {
    await service.appendMessage("s1", "user", "hello");
    await service.appendMessage("s1", "assistant", "hi", [{ tool: "x" }], 42);

    expect(prismaMock.chatMessage.create.mock.calls[0]![0].data).toEqual({
      sessionId: "s1",
      role: "user",
      content: "hello",
      toolCalls: undefined,
      tokensUsed: undefined,
    });
    expect(prismaMock.chatMessage.create.mock.calls[1]![0].data).toEqual({
      sessionId: "s1",
      role: "assistant",
      content: "hi",
      toolCalls: [{ tool: "x" }],
      tokensUsed: 42,
    });
  });

  it("returns at most 20 history messages by default as role/content pairs", async () => {
    prismaMock.chatMessage.findMany.mockResolvedValue([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ]);

    const history = await service.getSessionMessageHistory("s1");

    expect(history).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "a" },
    ]);
    expect(prismaMock.chatMessage.findMany.mock.calls[0]![0]).toMatchObject({
      where: { sessionId: "s1" },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
  });

  it("updates title and activity timestamp", async () => {
    await service.updateSessionTitle("s1", "New title");
    await service.updateSessionActivity("s1");
    await service.deleteSession("s1");

    expect(prismaMock.chatSession.update.mock.calls[0]![0]).toEqual({
      where: { id: "s1" },
      data: { title: "New title" },
    });
    expect(
      prismaMock.chatSession.update.mock.calls[1]![0].data.updatedAt,
    ).toBeInstanceOf(Date);
    expect(prismaMock.chatSession.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });
});

describe("ChatRoutingService", () => {
  let registry: ToolRegistry;
  const styleInjection = { getStylePrompt: vi.fn() };
  let service: ChatRoutingService;

  beforeEach(() => {
    registry = new ToolRegistry();
    styleInjection.getStylePrompt.mockReset().mockResolvedValue("");
    service = new ChatRoutingService(registry, styleInjection as never);
  });

  describe("buildSystemPrompt", () => {
    it("lists only active and beta tools", async () => {
      registry.register(toolManifest({ id: "thumb", name: "Thumbs" }));
      registry.register(
        toolManifest({
          id: "vid",
          name: "Videos",
          category: "video",
          status: "beta",
        }),
      );
      registry.register(
        toolManifest({ id: "old", name: "Old Tool", status: "deprecated" }),
      );

      const prompt = await service.buildSystemPrompt("u1", "hello");

      expect(prompt).toContain('**Thumbs** (id: "thumb", thumbnail)');
      expect(prompt).toContain('**Videos** (id: "vid", video)');
      expect(prompt).not.toContain("Old Tool");
      expect(prompt).toContain("Route: /tools/thumb");
    });

    it("says no tools are available when the registry is empty", async () => {
      const prompt = await service.buildSystemPrompt("u1");
      expect(prompt).toContain("No tools available right now.");
    });

    it("includes chat input params when a tool declares them", async () => {
      registry.register(
        toolManifest({
          chatInputParams: [
            {
              name: "prompt",
              type: "string",
              required: true,
              description: "image idea",
            },
          ],
        }),
      );

      const prompt = await service.buildSystemPrompt("u1");

      expect(prompt).toContain('Chat params: { "prompt": <image idea> }');
    });

    it.each([
      ["hola, necesito crear una miniatura", "Responde en español."],
      ["olá, quero criar uma imagem", "Responda em português."],
      ["What is the best way to grow my channel?", "Respond in English."],
      ["", "Respond in English."],
    ])("detects the reply language for %j", async (message, instruction) => {
      const prompt = await service.buildSystemPrompt("u1", message);
      expect(prompt.trim().endsWith(instruction)).toBe(true);
    });

    it("appends the user's style profile when one exists", async () => {
      styleInjection.getStylePrompt.mockResolvedValue(
        "USER STYLE PROFILE: witty",
      );

      const prompt = await service.buildSystemPrompt("u1", "hi");

      expect(styleInjection.getStylePrompt).toHaveBeenCalledWith("u1");
      expect(prompt.endsWith("\n\nUSER STYLE PROFILE: witty")).toBe(true);
    });
  });

  describe("getChatSuggestions", () => {
    it("suggests prompts only for the active X tools", () => {
      registry.register(
        toolManifest({
          id: "x-search-trends",
          name: "X Trends",
          category: "social",
        }),
      );
      registry.register(
        toolManifest({
          id: "x-post-tweet",
          name: "Post to X",
          category: "social",
          status: "inactive",
        }),
      );
      registry.register(toolManifest({ id: "thumb" }));

      const suggestions = service.getChatSuggestions();

      expect(suggestions).toHaveLength(2);
      expect(suggestions.every((s) => s.toolId === "x-search-trends")).toBe(
        true,
      );
    });
  });

  describe("detectToolFromMessage", () => {
    beforeEach(() => {
      registry.register(
        toolManifest({
          id: "thumb",
          name: "Thumbnail Generator",
          category: "thumbnail",
        }),
      );
      registry.register(
        toolManifest({
          id: "translate",
          name: "Content Translator",
          category: "translator",
        }),
      );
    });

    it("picks the best-matching tool above the confidence threshold", () => {
      expect(
        service.detectToolFromMessage(
          "Please translate this to another language",
        ),
      ).toEqual({ toolId: "translate", confidence: 0.8 });
    });

    it("caps confidence at 1", () => {
      const match = service.detectToolFromMessage(
        "thumbnail generator: design a thumbnail image photo",
      );
      expect(match).toEqual({ toolId: "thumb", confidence: 1 });
    });

    it("returns null when nothing matches strongly enough", () => {
      expect(
        service.detectToolFromMessage("what's the weather like?"),
      ).toBeNull();
      // A single keyword (0.4) is below the 0.5 threshold.
      expect(service.detectToolFromMessage("nice photo")).toBeNull();
    });
  });
});
