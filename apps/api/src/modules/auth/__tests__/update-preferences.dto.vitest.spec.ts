import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { UpdatePreferencesDto } from "../dto/update-preferences.dto";

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

const validate = (body: unknown) =>
  pipe.transform(body, { type: "body", metatype: UpdatePreferencesDto });

describe("PATCH /auth/preferences body", () => {
  it.each(["en", "es", "pt"])("accepts supported language %s", async (lang) => {
    await expect(validate({ preferredLanguage: lang })).resolves.toMatchObject({
      preferredLanguage: lang,
    });
  });

  it("rejects unsupported languages", async () => {
    await expect(validate({ preferredLanguage: "fr" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a missing language", async () => {
    await expect(validate({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unexpected fields", async () => {
    await expect(
      validate({ preferredLanguage: "es", role: "ADMIN" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
