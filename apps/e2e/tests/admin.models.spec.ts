import { expect, test, type BrowserContext } from "@playwright/test";
import { fakeJwt, mockApi, type MockHandler } from "../fixtures/api-mock";

const ADMIN_TOKEN = fakeJwt({
  sub: "admin-1",
  email: "admin@local",
  role: "ADMIN",
});

const baseModel = {
  contextLength: null,
  maxOutputTokens: null,
  supportsStreaming: false,
  supportsVision: false,
  promptPricePer1k: null,
  completionPricePer1k: null,
  imagePricePerGen: null,
  profitMargin: 2,
  description: null,
  tags: [],
  integratedAt: "2026-11-01T00:00:00Z",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};

const SYNCED = {
  ...baseModel,
  id: "m-synced",
  providerSlug: "openrouter",
  modelId: "openai/gpt-4o-mini",
  displayName: "GPT-4o mini",
  taskType: "text-generation",
  tier: "FREE",
  creditCost: 1,
  isActive: true,
  isCustom: false,
};

const CUSTOM_STT = {
  ...baseModel,
  id: "m-stt",
  providerSlug: "deepgram",
  modelId: "nova-3",
  displayName: "Deepgram Nova 3",
  taskType: "speech-to-text",
  tier: "FREE",
  creditCost: 2,
  isActive: true,
  isCustom: true,
};

async function signInAdmin(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "admin_token", value: ADMIN_TOKEN, url: baseURL },
  ]);
  await context.addInitScript(
    (token) => localStorage.setItem("admin_token", token),
    ADMIN_TOKEN,
  );
}

/** A tiny in-memory /admin/models backend. */
function modelRoutes() {
  let models: Array<Record<string, unknown>> = [SYNCED, CUSTOM_STT];
  const list: MockHandler = () => ({
    data: models,
    meta: { page: 1, limit: 20, total: models.length, totalPages: 1 },
  });
  return {
    "PATCH /auth/preferences": ({ body }: { body: unknown }) => body,
    "GET /admin/models": list,
    "GET /admin/models/stats": () => ({
      total: models.length,
      active: models.filter((m) => m.isActive).length,
      byProvider: {},
      byTaskType: {},
      byTier: {},
    }),
    "POST /admin/models": ({ body }: { body: unknown }) => {
      const created = {
        ...baseModel,
        ...(body as Record<string, unknown>),
        id: "m-new",
        isCustom: true,
      };
      models = [created, ...models];
      return created;
    },
    "DELETE /admin/models/m-stt": () => {
      models = models.filter((m) => m.id !== "m-stt");
      return { deleted: true };
    },
  };
}

test.describe("admin panel · AI models", () => {
  test("adds a custom text model for the AI Planner", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await mockApi(context, modelRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);

    await page.goto("/models");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AI Models",
    );
    // Hand-added models are marked; synced ones have no delete button.
    const sttRow = page.getByRole("row", { name: /Deepgram Nova 3/ });
    await expect(sttRow.getByText("Custom")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete GPT-4o mini" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Add model" }).click();
    const dialog = page.getByRole("dialog", { name: "Add model" });
    await expect(dialog).toBeVisible();

    // Validation runs before anything is sent.
    await dialog.getByRole("button", { name: "Add model" }).click();
    await expect(dialog.getByText("Required")).toHaveCount(2);
    expect(api.calls("POST", "/admin/models")).toHaveLength(0);

    await dialog.getByLabel("Model ID").fill("anthropic/claude-3.5-haiku");
    await dialog.getByLabel("Display name").fill("Claude Haiku");
    await dialog.getByLabel("Tier").selectOption("PRO");
    await dialog.getByLabel("Credit cost").fill("3");
    await dialog.getByLabel("Tags").fill("planning, Fast");
    await dialog.getByRole("switch", { name: "Activate now" }).click();
    await dialog.getByRole("button", { name: "Add model" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Claude Haiku added")).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Claude Haiku/ }).getByText("Custom"),
    ).toBeVisible();

    const [call] = api.calls("POST", "/admin/models");
    expect(call?.body).toEqual({
      providerSlug: "openrouter",
      modelId: "anthropic/claude-3.5-haiku",
      displayName: "Claude Haiku",
      taskType: "text-generation",
      tier: "PRO",
      creditCost: 3,
      tags: ["planning", "fast"],
      supportsStreaming: true,
      supportsVision: false,
      isActive: true,
    });
  });

  test("embedding models get the right provider and price; voice models live in Admin → Voice", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await mockApi(context, modelRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await page.goto("/models");

    await page.getByRole("button", { name: "Add model" }).click();
    const dialog = page.getByRole("dialog", { name: "Add model" });
    await dialog.getByLabel("Task type").selectOption("embedding");
    await expect(dialog.getByLabel("Provider")).toHaveValue("siliconflow");
    await expect(dialog.getByLabel("Credit cost")).toHaveValue("0");
    await expect(dialog.getByText(/similarity search/)).toBeVisible();

    // Speech-to-text is configured in Admin → Voice, not added here.
    await expect(
      dialog.getByLabel("Task type").locator('option[value="speech-to-text"]'),
    ).toHaveCount(0);

    await dialog.getByLabel("Model ID").fill("BAAI/bge-m3");
    await dialog.getByLabel("Display name").fill("BGE M3");
    await dialog.getByRole("button", { name: "Add model" }).click();
    await expect(dialog).toBeHidden();

    expect(api.calls("POST", "/admin/models")[0]?.body).toMatchObject({
      providerSlug: "siliconflow",
      taskType: "embedding",
      creditCost: 0,
    });
  });

  test("deletes a custom model after confirmation", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await mockApi(context, modelRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await page.goto("/models");

    await page.getByRole("button", { name: "Delete Deepgram Nova 3" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText('Delete "Deepgram Nova 3"?');
    await confirm.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Deepgram Nova 3 deleted")).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Deepgram Nova 3/ }),
    ).toHaveCount(0);
    expect(api.calls("DELETE", "/admin/models/m-stt")).toHaveLength(1);
  });
});
