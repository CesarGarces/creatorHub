import { beforeEach, describe, expect, it } from "vitest";
import { localizeError } from "../errors";
import { __resetClientLocaleForTests, initClientLocale } from "../runtime";
import { ApiError } from "@/lib/api";

describe("localizeError", () => {
  beforeEach(() => {
    __resetClientLocaleForTests();
    initClientLocale("es");
  });

  it("translates known backend messages", () => {
    expect(localizeError(new ApiError(401, "Invalid credentials"))).toBe(
      "Correo o contraseña incorrectos",
    );
    expect(
      localizeError(
        new Error("Insufficient credits. This model requires 5 credits."),
      ),
    ).toBe("No tienes suficientes créditos para esta acción");
  });

  it("extracts numbers from parameterized messages", () => {
    expect(
      localizeError(
        new Error("Please wait 42 seconds before requesting a new code"),
      ),
    ).toBe("Espera 42 segundos antes de solicitar un nuevo código");
  });

  it("maps rate limiting by status code", () => {
    expect(localizeError(new ApiError(429, "ThrottlerException"))).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
  });

  it("uses the caller's fallback for empty or technical messages", () => {
    expect(localizeError(undefined, "thumbnail.failed")).toBe(
      "No se pudo generar la miniatura. Inténtalo de nuevo.",
    );
    expect(
      localizeError(new ApiError(500, "Request failed (500)"), "video.failed"),
    ).toBe("No se pudo generar el video. Inténtalo de nuevo.");
  });

  it("keeps unknown server messages (they carry useful detail)", () => {
    expect(localizeError(new Error("Model quota exceeded for today"))).toBe(
      "Model quota exceeded for today",
    );
  });
});
