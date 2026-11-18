import { describe, expect, it } from "vitest";
import {
  detectLanguage,
  languageScores,
  resolveReplyLanguage,
} from "../language";

describe("detectLanguage", () => {
  it.each([
    "Hello, how are you today?",
    "Tell me a joke about cats",
    "What do you think about artificial intelligence?",
    "Can you help me with my video ideas?",
    "I'm tired, it was a long day",
  ])("English: %s", (text) => {
    expect(detectLanguage(text)).toBe("en");
  });

  it.each([
    "Hola, ¿cómo estás?",
    "¿Qué opinas de la inteligencia artificial?",
    "Me puedes contar un chiste",
    "Quiero aprender inglés",
    "Estoy cansado, fue un día muy largo",
    "buenos dias, necesito ayuda con mi canal",
    "cuéntame algo interesante",
  ])("Spanish: %s", (text) => {
    expect(detectLanguage(text)).toBe("es");
  });

  it.each([
    "Olá, tudo bem com você?",
    "O que você acha da inteligência artificial?",
    "Pode me contar uma piada?",
    "Quero aprender inglês",
    "Estou cansado, foi um dia muito longo",
    "bom dia, preciso de ajuda com meu canal",
    "Não sei o que fazer hoje",
  ])("Portuguese: %s", (text) => {
    expect(detectLanguage(text)).toBe("pt");
  });

  it("returns null for text too short or too close to call", () => {
    expect(detectLanguage("ok")).toBeNull();
    expect(detectLanguage("")).toBeNull();
    expect(detectLanguage("123 456")).toBeNull();
    // Shared words only ("no", "como", "para") count for no language.
    expect(detectLanguage("no")).toBeNull();
    expect(detectLanguage("como para")).toBeNull();
  });

  it("counts letters only one language uses", () => {
    expect(languageScores("¿ñ?").es).toBeGreaterThan(0);
    expect(languageScores("ação").pt).toBeGreaterThan(0);
    expect(languageScores("ação").es).toBe(0);
  });
});

describe("resolveReplyLanguage", () => {
  it("follows the message's language", () => {
    expect(
      resolveReplyLanguage({
        text: "Hola, ¿qué tal?",
        previous: "en",
        hint: "pt",
      }),
    ).toBe("es");
  });

  it("keeps the conversation's language for unclear messages", () => {
    expect(
      resolveReplyLanguage({ text: "ok", previous: "pt", hint: "en" }),
    ).toBe("pt");
  });

  it("then uses the interface language, then English", () => {
    expect(
      resolveReplyLanguage({ text: "ok", previous: null, hint: "es" }),
    ).toBe("es");
    expect(
      resolveReplyLanguage({ text: "ok", previous: "fr", hint: "de" }),
    ).toBe("en");
    expect(resolveReplyLanguage({ text: "ok" })).toBe("en");
  });
});
