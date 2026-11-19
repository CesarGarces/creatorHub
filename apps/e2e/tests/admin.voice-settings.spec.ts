import { expect, test } from "@playwright/test";
import { mockApi, type MockHandler } from "../fixtures/api-mock";
import { expectAccessible } from "../fixtures/a11y";
import { VIEWPORTS, expectNoHorizontalOverflow } from "../fixtures/responsive";
import { ADMIN_VOICE_SETTINGS, signInAdmin } from "../fixtures/admin-data";

/** A silent WAV (header only): the preview "plays" without sound. */
const SILENT_WAV =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/** A tiny in-memory /admin/voice-settings backend. */
function voiceRoutes() {
  let current = structuredClone(ADMIN_VOICE_SETTINGS);
  const save: MockHandler = ({ body }) => {
    const b = body as {
      sttModel: string;
      sttCreditsPerSecond: number;
      ttsCreditsPerSecond: number;
      ttsVoices: typeof current.settings.tts.voices;
      freeTierMinutes: number | null;
      freeTierPeriod: string;
    };
    current = {
      ...current,
      settings: {
        stt: {
          provider: "deepgram",
          model: b.sttModel,
          creditsPerSecond: b.sttCreditsPerSecond,
        },
        tts: {
          provider: "deepgram",
          creditsPerSecond: b.ttsCreditsPerSecond,
          voices: b.ttsVoices,
        },
        freeTier: { minutes: b.freeTierMinutes, period: b.freeTierPeriod },
        updatedAt: new Date().toISOString(),
      },
    };
    return current;
  };
  return {
    "PATCH /auth/preferences": ({ body }: { body: unknown }) => body,
    "GET /admin/voice-settings": () => current,
    "PUT /admin/voice-settings": save,
    "POST /admin/voice-settings/preview": ({ body }: { body: unknown }) => ({
      voice: (body as { voice: string }).voice,
      mimeType: "audio/wav",
      durationMs: 0,
      data: SILENT_WAV,
    }),
  };
}

test.describe("admin panel · Voice (STT & TTS)", () => {
  test("configures the STT model, the voice of each language and the prices per second", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const api = await mockApi(context, voiceRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);

    await page.goto("/voice");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Voice (STT & TTS)",
    );
    // Saved values: Nova-3, 1 cr/s in; Andromeda, Celeste, Bianca, 2 cr/s out.
    await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
      "nova-3",
    );
    await expect(page.locator("#voice-stt-rate")).toHaveValue("1");
    await expect(page.locator("#voice-tts-rate")).toHaveValue("2");
    await expect(page.getByLabel("Voice (Spanish)")).toHaveValue(
      "aura-2-celeste-es",
    );
    await expect(
      page.getByText("1 minute of voice input = 60 credits"),
    ).toBeVisible();
    await expect(
      page.getByText("A 20-second spoken answer = 40 credits"),
    ).toBeVisible();
    await expectAccessible(page, testInfo, "voice settings");

    // Hear a voice before choosing it.
    await page.getByLabel("Voice (Spanish)").selectOption("aura-2-estrella-es");
    await page.getByRole("button", { name: "Play Estrella" }).click();
    await expect
      .poll(() => api.calls("POST", "/admin/voice-settings/preview").length)
      .toBe(1);
    expect(api.calls("POST", "/admin/voice-settings/preview")[0]?.body).toEqual(
      { language: "es", voice: "aura-2-estrella-es" },
    );

    // A voice Deepgram released after the catalog: typed by id.
    await page.getByLabel("Voice (Portuguese)").selectOption("__custom__");
    await page
      .getByLabel("Deepgram voice id (Portuguese)")
      .fill("flux-paula-pt");

    // English on Aura-1.
    await page.getByLabel("Model (English)").selectOption("aura");
    await expect(page.getByLabel("Voice (English)")).toHaveValue(
      "aura-asteria-en",
    );

    // Prices per second.
    await page.locator("#voice-stt-rate").fill("0.5");
    await expect(
      page.getByText("1 minute of voice input = 30 credits"),
    ).toBeVisible();
    await page.getByLabel("Model", { exact: true }).selectOption("nova-2");
    await expect(
      page.getByText("Transcribes the user's interface language only."),
    ).toBeVisible();
    await expect(page.getByText("Unsaved changes")).toBeVisible();

    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Voice settings saved")).toBeVisible();
    expect(api.calls("PUT", "/admin/voice-settings")[0]?.body).toEqual({
      sttModel: "nova-2",
      sttCreditsPerSecond: 0.5,
      ttsCreditsPerSecond: 2,
      ttsVoices: {
        en: { model: "aura", voice: "aura-asteria-en" },
        es: { model: "aura-2", voice: "aura-2-estrella-es" },
        pt: { model: "flux", voice: "flux-paula-pt" },
      },
      freeTierMinutes: null,
      freeTierPeriod: "monthly",
    });
    await expect(page.getByText(/^Last saved/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeDisabled();
  });

  test("limits Robotina on the Free plan to some minutes", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await mockApi(context, voiceRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await page.goto("/voice");

    const limit = page.getByRole("switch", {
      name: "Limit Robotina on the Free plan",
    });
    await expect(limit).not.toBeChecked();
    await expect(page.getByText(/as long as their credits last/)).toBeVisible();
    await limit.click();
    await expect(
      page.getByText(/invitation to upgrade for unlimited use/),
    ).toBeVisible();
    await expect(page.getByLabel("Minutes", { exact: true })).toHaveValue("10");
    await page.getByLabel("Minutes", { exact: true }).fill("20");
    await page.getByLabel("Minutes come back").selectOption("lifetime");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Voice settings saved")).toBeVisible();
    expect(api.calls("PUT", "/admin/voice-settings")[0]?.body).toMatchObject({
      freeTierMinutes: 20,
      freeTierPeriod: "lifetime",
    });
    // Saved: the form shows the limit after reloading.
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Limit Robotina on the Free plan" }),
    ).toBeChecked();
    await expect(page.getByLabel("Minutes", { exact: true })).toHaveValue("20");

    // Bad minutes are explained, nothing saved.
    await page.getByLabel("Minutes", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      page.getByText("Whole minutes, from 1 to 10,000"),
    ).toBeVisible();
    expect(api.calls("PUT", "/admin/voice-settings")).toHaveLength(1);
  });

  test("explains invalid values and saves nothing", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await mockApi(context, voiceRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await page.goto("/voice");

    await page.locator("#voice-tts-rate").fill("250");
    await page.getByLabel("Voice (Spanish)").selectOption("__custom__");
    await page
      .getByLabel("Deepgram voice id (Spanish)")
      .fill("aura-2-thalia-en");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(
      page.getByText("Between 0 and 100, with up to 2 decimals"),
    ).toBeVisible();
    await expect(
      page.getByText("Not a voice of this model and language"),
    ).toBeVisible();
    await expect(page.locator("#voice-tts-rate")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(api.calls("PUT", "/admin/voice-settings")).toHaveLength(0);
  });

  test("warns when Deepgram is not configured", async ({
    page,
    context,
    baseURL,
  }) => {
    await mockApi(
      context,
      {
        ...voiceRoutes(),
        "GET /admin/voice-settings": {
          ...ADMIN_VOICE_SETTINGS,
          ttsProvider: null,
        },
      },
      baseURL!,
    );
    await signInAdmin(context, baseURL!);
    await page.goto("/voice");
    await expect(page.getByText(/DEEPGRAM_API_KEY is not set/)).toBeVisible();
  });
});

test.describe("admin panel · Voice on a phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("fits the screen, save bar in reach", async ({
    page,
    context,
    baseURL,
  }) => {
    await mockApi(context, voiceRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await page.goto("/voice");
    await expect(page.getByLabel("Voice (Portuguese)")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toBeInViewport();
  });
});
