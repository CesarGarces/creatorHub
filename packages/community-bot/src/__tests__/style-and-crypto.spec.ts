import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("./prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { prismaMock, resetPrismaMock } from "./prisma-mock";
import { CredentialCipher } from "../crypto/credential-cipher";
import { buildCommunitySystemPrompt } from "../style/style-prompt";
import { StyleContextService } from "../style/style-context.service";

describe("CredentialCipher", () => {
  const cipher = new CredentialCipher("super-secret-key");

  it("round-trips strings and JSON", () => {
    expect(cipher.decrypt(cipher.encrypt("123:ABC"))).toBe("123:ABC");
    expect(
      cipher.decryptJson(cipher.encryptJson({ botToken: "t", n: 1 })),
    ).toEqual({
      botToken: "t",
      n: 1,
    });
  });

  it("uses the versioned v1:iv:tag:ciphertext format without leaking plaintext", () => {
    const payload = cipher.encrypt("my-bot-token");

    expect(payload.split(":")).toHaveLength(4);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(payload).not.toContain("my-bot-token");
  });

  it("uses a fresh IV for every encryption", () => {
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  it("rejects ciphertext encrypted with another key", () => {
    const other = new CredentialCipher("different-key");
    expect(() => other.decrypt(cipher.encrypt("secret"))).toThrow();
  });

  it("detects tampering through the GCM auth tag", () => {
    const [version, iv, tag, data] = cipher.encrypt("secret").split(":");
    const flipped = Buffer.from(data!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;

    expect(() =>
      cipher.decrypt([version, iv, tag, flipped.toString("base64")].join(":")),
    ).toThrow();
  });

  it.each(["", "v2:a:b:c", "v1:onlytwo", "garbage"])(
    "rejects malformed payload %j",
    (payload) => {
      expect(() => cipher.decrypt(payload)).toThrow(
        "Malformed encrypted credentials payload",
      );
    },
  );

  it("requires a key", () => {
    expect(() => new CredentialCipher("")).toThrow(
      /COMMUNITY_BOT_ENCRYPTION_KEY is not set/,
    );
  });

  describe("fromEnv", () => {
    const original = process.env.COMMUNITY_BOT_ENCRYPTION_KEY;
    afterEach(() => {
      process.env.COMMUNITY_BOT_ENCRYPTION_KEY = original;
    });

    it("reads the key from the environment", () => {
      process.env.COMMUNITY_BOT_ENCRYPTION_KEY = "super-secret-key";
      expect(CredentialCipher.fromEnv().decrypt(cipher.encrypt("x"))).toBe("x");
    });

    it("fails when the key is missing", () => {
      delete process.env.COMMUNITY_BOT_ENCRYPTION_KEY;
      expect(() => CredentialCipher.fromEnv()).toThrow();
    });
  });
});

describe("buildCommunitySystemPrompt", () => {
  const profile = {
    tone: "playful",
    vocabKeywords: ["gg", "let's go"],
    sentenceLength: "short",
    emojiUsage: "high",
    formalityLevel: "casual",
    language: "es",
    summary: "Energetic gamer",
  };

  it("always sets the assistant role, safety rules and a length limit", () => {
    const prompt = buildCommunitySystemPrompt({ creatorName: "Ana" });

    expect(prompt).toContain("You are the community assistant of Ana.");
    expect(prompt).toContain("Never invent facts about the creator");
    expect(prompt).toContain("under 900 characters");
  });

  it("uses a generic name and custom length when provided", () => {
    const prompt = buildCommunitySystemPrompt({ maxReplyChars: 300 });

    expect(prompt).toContain("community assistant of a content creator");
    expect(prompt).toContain("under 300 characters");
  });

  it("injects the style profile with a readable language name", () => {
    const prompt = buildCommunitySystemPrompt({ styleProfile: profile });

    expect(prompt).toContain("Primary language: Spanish (es)");
    expect(prompt).toContain("- Tone: playful");
    expect(prompt).toContain("- Signature vocabulary: gg, let's go");
    expect(prompt).toContain("- Style summary: Energetic gamer");
  });

  it("handles unknown languages, missing keywords and summary", () => {
    const prompt = buildCommunitySystemPrompt({
      styleProfile: {
        ...profile,
        language: "nl",
        vocabKeywords: [],
        summary: null,
      },
    });

    expect(prompt).toContain("Primary language: NL (nl)");
    expect(prompt).toContain("Signature vocabulary: none specified");
    expect(prompt).not.toContain("Style summary");
  });

  it("adds at most five real examples", () => {
    const prompt = buildCommunitySystemPrompt({
      recentSamples: ["a", "b", "c", "d", "e", "f"],
    });

    expect(prompt).toContain('5. "e"');
    expect(prompt).not.toContain('"f"');
  });

  it("appends trimmed creator instructions and skips blank ones", () => {
    expect(
      buildCommunitySystemPrompt({
        systemPromptExtra: "  Never share prices.  ",
      }),
    ).toMatch(
      /ADDITIONAL INSTRUCTIONS FROM THE CREATOR:\nNever share prices\.$/,
    );
    expect(
      buildCommunitySystemPrompt({ systemPromptExtra: "   " }),
    ).not.toContain("ADDITIONAL INSTRUCTIONS");
  });
});

describe("StyleContextService", () => {
  const service = new StyleContextService();

  beforeEach(() => resetPrismaMock());

  it("builds a prompt from the creator's profile, samples and instructions", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ana",
      email: "ana@x.com",
    });
    prismaMock.userStyleProfile.findUnique.mockResolvedValue({
      isActive: true,
      tone: "warm",
      vocabKeywords: [],
      sentenceLength: "short",
      emojiUsage: "low",
      formalityLevel: "casual",
      language: "en",
      summary: null,
    });
    prismaMock.userContentSample.findMany.mockResolvedValue([
      { content: "Thanks for watching!" },
    ]);

    const prompt = await service.buildSystemPrompt({
      userId: "u1",
      useStyleProfile: true,
      systemPromptExtra: "Be brief",
    });

    expect(prompt).toContain("community assistant of Ana");
    expect(prompt).toContain("- Tone: warm");
    expect(prompt).toContain('1. "Thanks for watching!"');
    expect(prompt).toContain("Be brief");
    expect(
      prismaMock.userContentSample.findMany.mock.calls[0]![0],
    ).toMatchObject({
      where: { userId: "u1", isActive: true },
      take: 5,
    });
  });

  it("ignores an inactive profile but still uses samples", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: null,
      email: "creator@x.com",
    });
    prismaMock.userStyleProfile.findUnique.mockResolvedValue({
      isActive: false,
      tone: "hidden",
    });
    prismaMock.userContentSample.findMany.mockResolvedValue([]);

    const prompt = await service.buildSystemPrompt({
      userId: "u1",
      useStyleProfile: true,
    });

    expect(prompt).toContain("community assistant of creator.");
    expect(prompt).not.toContain("hidden");
  });

  it("skips all style data when the creator opted out", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const prompt = await service.buildSystemPrompt({
      userId: "u1",
      useStyleProfile: false,
    });

    expect(prismaMock.userStyleProfile.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.userContentSample.findMany).not.toHaveBeenCalled();
    expect(prompt).toContain("a content creator");
  });
});
