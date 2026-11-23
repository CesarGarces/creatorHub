import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";
import { mockApi, type ApiMock } from "../fixtures/api-mock";
import { signInWeb } from "../fixtures/web-data";
import { webPageRoutes } from "../fixtures/web-pages";
import { expectAccessible } from "../fixtures/a11y";
import {
  VIEWPORTS,
  expectNoHorizontalOverflow,
  expectTouchTarget,
} from "../fixtures/responsive";

/**
 * Robotina — AI voice assistant (ARCHITECTURE.md §14g) in real Chromium:
 * a fake microphone (Chromium's fake capture device), a fake Deepgram STT
 * on the Socket.IO connection (`stt:*` events), the SSE reply with an audio
 * segment that really plays through Web Audio, and conversation mode
 * reopening the mic. Only the backend is mocked.
 */

test.use({
  launchOptions: {
    executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  },
});

/** 0.6 s of a quiet 220 Hz tone, 16-bit mono WAV (the "voice" segment). */
function toneWav(ms = 600, rate = 16000): string {
  const samples = Math.round((ms / 1000) * rate);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const v = Math.sin((2 * Math.PI * 220 * i) / rate) * 0.3;
    buf.writeInt16LE(Math.round(v * 0x7fff), 44 + i * 2);
  }
  return buf.toString("base64");
}

const sse = (...events: object[]) =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

interface SttFake {
  starts: number;
  ends: number;
}

/**
 * A fake Deepgram STT on the app's Socket.IO connection: on `stt:start` it
 * "hears" `phrase` (partial, then final); on `stt:end` it sends the result.
 */
async function fakeStt(
  context: BrowserContext,
  appOrigin: string,
  phrase: string,
  /** Deepgram drops the first session mid-phrase (PROVIDER_CLOSED). */
  { dropFirstSession = false } = {},
): Promise<SttFake> {
  const stats: SttFake = { starts: 0, ends: 0 };
  const appHost = new URL(appOrigin).host;
  const send = (ws: WebSocketRoute, event: string, data: unknown) =>
    ws.send(`42${JSON.stringify([event, data])}`);
  const requestIdOf = (message: string): string | undefined =>
    (JSON.parse(message.slice(2)) as [string, { requestId?: string }?])[1]
      ?.requestId;
  let requestId: string | undefined;

  await context.routeWebSocket(
    (url) => url.host !== appHost && url.pathname.startsWith("/socket.io"),
    (ws) => {
      ws.send(
        '0{"sid":"mock","upgrades":[],"pingInterval":25000,"pingTimeout":20000}',
      );
      ws.onMessage((message) => {
        if (typeof message !== "string") return; // audio chunks (binary)
        if (message.startsWith("40")) ws.send('40{"sid":"mock"}');
        else if (message === "2") ws.send("3");
        else if (message.startsWith('42["stt:start"')) {
          stats.starts += 1;
          // Like the real gateway: every event echoes the session's requestId.
          requestId = requestIdOf(message);
          const id = { requestId };
          send(ws, "stt:started", { sessionId: `s${stats.starts}`, ...id });
          const words = phrase.split(" ");
          if (dropFirstSession && stats.starts === 1) {
            setTimeout(
              () =>
                send(ws, "stt:partial", {
                  text: words.slice(0, 2).join(" "),
                  isFinal: false,
                  ...id,
                }),
              400,
            );
            setTimeout(
              () =>
                send(ws, "stt:error", {
                  code: "PROVIDER_CLOSED",
                  message: "The voice connection was interrupted",
                  ...id,
                }),
              900,
            );
          } else if (dropFirstSession && stats.starts === 2) {
            setTimeout(
              () =>
                send(ws, "stt:partial", {
                  text: words.slice(2).join(" "),
                  isFinal: true,
                  ...id,
                }),
              400,
            );
          } else if (stats.starts === 1) {
            setTimeout(
              () =>
                send(ws, "stt:partial", {
                  text: phrase.split(" ").slice(0, 2).join(" "),
                  isFinal: false,
                  ...id,
                }),
              400,
            );
            setTimeout(
              () =>
                send(ws, "stt:partial", { text: phrase, isFinal: true, ...id }),
              900,
            );
          }
        } else if (message.startsWith('42["stt:end"')) {
          stats.ends += 1;
          // The server's transcript covers its own session only.
          const heard = dropFirstSession
            ? phrase.split(" ").slice(2).join(" ")
            : phrase;
          send(ws, "stt:result", {
            fullTranscript: stats.ends === 1 ? heard : "",
            durationMs: 2000,
            wordCount: 4,
            credits: 1,
            requestId: requestIdOf(message) ?? requestId,
          });
        }
      });
    },
  );
  return stats;
}

async function setup(
  context: BrowserContext,
  baseURL: string,
  routes: Record<string, unknown> = {},
): Promise<ApiMock> {
  const api = await mockApi(context, { ...webPageRoutes, ...routes }, baseURL);
  await signInWeb(context, baseURL);
  return api;
}

/** The reply stream (registered after mockApi, so it wins for this path). */
async function replyWith(
  context: BrowserContext,
  baseURL: string,
  events: object[],
): Promise<{ bodies: unknown[] }> {
  const bodies: unknown[] = [];
  const headers = {
    "access-control-allow-origin": baseURL,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "POST,OPTIONS",
  };
  await context.route("**/api/v1/tools/voice-assistant/messages", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers });
    }
    bodies.push(JSON.parse(request.postData() ?? "{}"));
    return route.fulfill({
      status: 201,
      headers: { ...headers, "content-type": "text/event-stream" },
      body: sse(...events),
    });
  });
  return { bodies };
}

const orbButton = (page: Page) => page.locator("[data-robotina-orb]").first();
const orbState = (page: Page) =>
  page.locator("canvas[data-orb-state]").first().getAttribute("data-orb-state");

test.describe("Robotina voice assistant", () => {
  test("a full voice turn: fake mic → STT → spoken reply → listens again", async ({
    context,
    page,
    baseURL,
  }) => {
    await context.grantPermissions(["microphone"]);
    const phrase = "Hola Robotina, ¿cómo estás?";
    await setup(context, baseURL!);
    const stt = await fakeStt(context, baseURL!, phrase);
    const reply = await replyWith(context, baseURL!, [
      {
        type: "start",
        conversationId: "vc-new",
        userMessageId: "m1",
        language: "es",
        voice: { model: "aura-2-celeste-es", name: "Celeste" },
        title: phrase,
      },
      { type: "delta", content: "¡Hola! Estoy muy bien, " },
      { type: "delta", content: "¿y tú?" },
      {
        type: "audio",
        index: 0,
        mimeType: "audio/wav",
        data: toneWav(),
        durationMs: 600,
        text: "¡Hola! Estoy muy bien, ¿y tú?",
      },
      {
        type: "done",
        messageId: "m2",
        content: "¡Hola! Estoy muy bien, ¿y tú?",
        language: "es",
        audioMs: 600,
        credits: 1,
        balance: 1499,
      },
    ]);

    await page.goto("/tools/voice-assistant");
    await expect(
      page.getByRole("heading", { name: "Robotina — AI voice assistant" }),
    ).toBeVisible();

    await orbButton(page).click();
    // The fake STT "hears" the phrase: shown live while listening.
    await expect(page.getByText(phrase).first()).toBeVisible();
    await expect.poll(() => orbState(page)).toBe("listening");

    // End of speech (3 s after the final phrase) → sent as a spoken message.
    await expect.poll(() => stt.ends).toBe(1);
    await expect.poll(() => reply.bodies.length).toBe(1);
    expect(reply.bodies[0]).toMatchObject({
      content: phrase,
      spoken: true,
      model: "deepseek-ai/DeepSeek-V4-Flash",
    });

    // Her answer, in text and out loud (the WAV really plays, ~0.6 s).
    await expect(
      page.getByText("¡Hola! Estoy muy bien, ¿y tú?").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play again" }),
    ).toBeVisible();
    await expect(page.getByText("1 cr", { exact: true })).toBeVisible();

    // Conversation mode: after her last word the mic opens again.
    await expect.poll(() => stt.starts, { timeout: 8000 }).toBe(2);

    // End the conversation: the live voice bar goes away, nothing else is sent.
    await page.getByRole("button", { name: "End conversation" }).click();
    await expect(
      page.getByRole("button", { name: "End conversation" }),
    ).toHaveCount(0);
    await expect(page.locator("canvas[data-orb-state]")).toHaveCount(0);
    expect(reply.bodies).toHaveLength(1);
  });

  test("a dropped Deepgram session doesn't close the mic or lose words", async ({
    context,
    page,
    baseURL,
  }) => {
    await context.grantPermissions(["microphone"]);
    const phrase = "Hola Robotina, ¿cómo estás?";
    await setup(context, baseURL!);
    const stt = await fakeStt(context, baseURL!, phrase, {
      dropFirstSession: true,
    });
    const reply = await replyWith(context, baseURL!, [
      {
        type: "start",
        conversationId: "vc-new",
        userMessageId: "m1",
        language: "es",
        voice: null,
        title: phrase,
      },
      { type: "delta", content: "¡Muy bien!" },
      {
        type: "done",
        messageId: "m2",
        content: "¡Muy bien!",
        language: "es",
        audioMs: 0,
        credits: 1,
        balance: 1499,
      },
    ]);

    await page.goto("/tools/voice-assistant");
    await orbButton(page).click();
    // The provider drops mid-phrase: a new session opens on the same mic…
    await expect.poll(() => stt.starts).toBe(2);
    expect(await orbState(page)).toBe("listening");
    expect(stt.ends).toBe(0);
    // …and the whole phrase (both sessions) is shown and sent.
    await expect(page.getByText(phrase).first()).toBeVisible();
    await expect.poll(() => reply.bodies.length, { timeout: 10_000 }).toBe(1);
    expect(reply.bodies[0]).toMatchObject({ content: phrase, spoken: true });
    await expect(page.getByText("¡Muy bien!").first()).toBeVisible();
    await expect(page.getByText(/voice connection/i)).toHaveCount(0);
  });

  test("typed messages get a written reply; the history opens past talks", async ({
    context,
    page,
    baseURL,
  }) => {
    const api = await setup(context, baseURL!, {
      "/tools/voice-assistant/conversations/vc-2": {
        success: true,
        data: {
          id: "vc-2",
          title: "Tell me a fun fact about octopuses",
          language: "en",
          lastMessage: "They have three hearts and blue blood!",
          messageCount: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Tell me a fun fact about octopuses",
              language: "en",
              spoken: true,
              voice: null,
              audioMs: 0,
              creditsCharged: 0,
              interrupted: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: "m2",
              role: "assistant",
              content: "They have three hearts and blue blood!",
              language: "en",
              spoken: true,
              voice: "aura-2-andromeda-en",
              audioMs: 2400,
              creditsCharged: 1,
              interrupted: false,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    });
    const reply = await replyWith(context, baseURL!, [
      {
        type: "start",
        conversationId: "vc-2",
        userMessageId: "m3",
        language: "en",
        voice: null,
        title: "Tell me a fun fact about octopuses",
      },
      { type: "delta", content: "They can also taste with their arms." },
      {
        type: "done",
        messageId: "m4",
        content: "They can also taste with their arms.",
        language: "en",
        audioMs: 0,
        credits: 1,
        balance: 1498,
      },
    ]);

    await page.goto("/tools/voice-assistant");
    await page
      .getByRole("button", { name: /Tell me a fun fact about octopuses/ })
      .click();
    await expect(
      page.getByText("They have three hearts and blue blood!").first(),
    ).toBeVisible();
    expect(
      api.calls("GET", "/tools/voice-assistant/conversations/vc-2"),
    ).toHaveLength(1);

    const input = page.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    await input.fill("Another one?");
    await input.press("Enter");
    // In the thread (the history row shows it as its last message too).
    await expect(
      page.getByText("They can also taste with their arms.").last(),
    ).toBeVisible();
    expect(reply.bodies[0]).toMatchObject({
      conversationId: "vc-2",
      content: "Another one?",
      spoken: false,
    });
  });

  test("asks to schedule a plan: she creates the session and shows it", async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    await setup(context, baseURL!);
    const action = {
      type: "action",
      id: "a1",
      name: "calendar.create_event",
      args: {
        title: "Grabar el unboxing",
        date: "2026-11-28",
        startTime: "15:00",
        endTime: "16:00",
      },
    };
    const reply = await replyWith(context, baseURL!, [
      {
        type: "start",
        conversationId: "vc-new",
        userMessageId: "m1",
        language: "es",
        voice: null,
        title: "Agenda grabar",
      },
      { type: "delta", content: "Perfecto, lo agendo ahora. " },
      { ...action, status: "running" },
      {
        ...action,
        status: "done",
        summary: "Created",
        data: {
          kind: "calendar-event",
          change: "created",
          event: {
            id: "ev1",
            title: "Grabar el unboxing",
            type: "RECORDING",
            startAt: "2026-11-28T20:00:00.000Z",
            endAt: "2026-11-28T21:00:00.000Z",
          },
          conflicts: [],
          url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
        },
      },
      { type: "delta", content: "¡Listo! Quedó para mañana de 3 a 4." },
      {
        type: "done",
        messageId: "m2",
        content:
          "Perfecto, lo agendo ahora. ¡Listo! Quedó para mañana de 3 a 4.",
        language: "es",
        audioMs: 0,
        credits: 1,
        balance: 1499,
      },
    ]);

    await page.goto("/tools/voice-assistant");
    const input = page.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    await input.fill("Agenda grabar el unboxing mañana de 3 a 4 de la tarde");
    await input.press("Enter");

    await expect(page.getByText("Added to your calendar")).toBeVisible();
    await expect(
      page.getByText("Grabar el unboxing", { exact: true }),
    ).toBeVisible();
    // The browser's time zone travels with the request (dates and times).
    expect(reply.bodies[0]).toMatchObject({
      timeZone: await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    });
    await expectAccessible(page, testInfo, "robotina action card");

    // Opens the planner on that week (it reads ?date= then tidies the URL).
    const opened = page.waitForURL(/\/tools\/content-planner\?date=2026-11-28/);
    await page.getByRole("link", { name: "Open in planner →" }).click();
    await opened;
    await expect(
      page.getByRole("heading", { level: 1, name: "Content Planner" }),
    ).toBeVisible();
  });

  test("deleting a session: she asks first, the user's yes deletes it", async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    await setup(context, baseURL!);
    const session = {
      kind: "calendar-event",
      change: "deleted",
      event: {
        id: "ev1",
        title: "Grabar el unboxing",
        type: "RECORDING",
        startAt: "2026-11-28T20:00:00.000Z",
        endAt: "2026-11-28T21:00:00.000Z",
      },
      conflicts: [],
      url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
    };
    const action = {
      type: "action",
      id: "a1",
      name: "calendar.delete_event",
      args: { eventId: "ev1" },
    };
    const turns = [
      [
        {
          type: "start",
          conversationId: "vc-new",
          userMessageId: "m1",
          language: "es",
          voice: null,
          title: "Borra",
        },
        { ...action, status: "running" },
        {
          ...action,
          status: "needs_confirmation",
          summary: "NOT DONE YET",
          data: session,
        },
        {
          type: "delta",
          content: "¿Seguro que borro la grabación del sábado a las tres?",
        },
        {
          type: "done",
          messageId: "m2",
          content: "¿Seguro que borro la grabación del sábado a las tres?",
          language: "es",
          audioMs: 0,
          credits: 1,
          balance: 1499,
        },
      ],
      [
        {
          type: "start",
          conversationId: "vc-new",
          userMessageId: "m3",
          language: "es",
          voice: null,
          title: "Borra",
        },
        { ...action, id: "a2", status: "running" },
        {
          ...action,
          id: "a2",
          status: "done",
          summary: "Deleted",
          data: session,
        },
        { type: "delta", content: "Listo, la borré." },
        {
          type: "done",
          messageId: "m4",
          content: "Listo, la borré.",
          language: "es",
          audioMs: 0,
          credits: 1,
          balance: 1498,
        },
      ],
    ];
    const headers = {
      "access-control-allow-origin": baseURL!,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "POST,OPTIONS",
    };
    const bodies: Array<Record<string, unknown>> = [];
    await context.route("**/api/v1/tools/voice-assistant/messages", (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers });
      }
      bodies.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({
        status: 201,
        headers: { ...headers, "content-type": "text/event-stream" },
        body: sse(...turns[bodies.length - 1]!),
      });
    });

    await page.goto("/tools/voice-assistant");
    const input = page.getByRole("textbox", {
      name: "Type a message or tap the mic…",
    });
    await input.fill("Borra la grabación del sábado");
    await input.press("Enter");
    await expect(page.getByText("Waiting for your OK to delete")).toBeVisible();
    await expect(page.getByText("Say “yes” to confirm")).toBeVisible();
    await expectAccessible(page, testInfo, "robotina delete confirmation");

    await input.fill("Sí");
    await input.press("Enter");
    await expect(page.getByText("Deleted from your calendar")).toBeVisible();
    // The yes continues the same conversation (it holds the pending delete).
    expect(bodies[1]).toMatchObject({
      conversationId: "vc-new",
      content: "Sí",
    });
  });

  test("model settings: only the text model — the voices are the admin's", async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    await setup(context, baseURL!, {
      // Admin → Voice: Spanish spoken by Estrella, prices per minute.
      "GET /voice/pricing": {
        stt: { model: "nova-3", creditsPerMinute: 60 },
        tts: {
          creditsPerMinute: 120,
          voices: {
            en: {
              model: "aura-2-andromeda-en",
              name: "Andromeda",
              accent: "American",
              gender: "feminine",
            },
            es: {
              model: "aura-2-estrella-es",
              name: "Estrella",
              accent: "Mexican",
              gender: "feminine",
            },
            pt: {
              model: "flux-bianca-pt",
              name: "Bianca",
              accent: "Brazilian",
              gender: "feminine",
            },
          },
        },
      },
    });
    await page.goto("/tools/voice-assistant");
    await expect(
      page.getByText("Voice input 60 cr/min · Reply 1 cr (spoken: 120 cr/min)"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Model settings" }).click();
    await expect(page.getByText(/Her voice is Deepgram/)).toBeVisible();
    await expect(page.getByText("Estrella · Spanish")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Conversation mode" }),
    ).toBeVisible();
    await expectAccessible(page, testInfo, "robotina settings");
  });

  test("Free plan: the minutes left, then an invitation to upgrade", async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    const pricing = {
      stt: { model: "nova-3", creditsPerMinute: 60 },
      freeTier: { minutes: 10, period: "monthly" },
      tts: {
        creditsPerMinute: 120,
        voices: {
          en: {
            model: "aura-2-andromeda-en",
            name: "Andromeda",
            accent: "American",
            gender: "feminine",
          },
          es: {
            model: "aura-2-celeste-es",
            name: "Celeste",
            accent: "Colombian",
            gender: "feminine",
          },
          pt: {
            model: "flux-bianca-pt",
            name: "Bianca",
            accent: "Brazilian",
            gender: "feminine",
          },
        },
      },
    };
    let remainingSeconds = 30;
    await setup(context, baseURL!, {
      "GET /voice/pricing": pricing,
      "GET /voice/allowance": () => ({
        limited: true,
        period: "monthly",
        limitSeconds: 600,
        usedSeconds: 600 - remainingSeconds,
        remainingSeconds,
        exhausted: remainingSeconds === 0,
        resetsAt: "2026-12-01T00:00:00.000Z",
      }),
    });
    // The server refuses the reply: the minutes ran out meanwhile.
    await replyWith(context, baseURL!, [
      {
        type: "error",
        status: 403,
        code: "FREE_LIMIT_REACHED",
        error:
          "You've used all your free minutes with Robotina. Upgrade your plan for unlimited use.",
      },
    ]);

    await page.goto("/tools/voice-assistant");
    await expect(
      page.getByText(
        "Free plan: 1 of 10 minutes with Robotina left this month",
      ),
    ).toBeVisible();

    remainingSeconds = 0;
    await page
      .getByRole("textbox", { name: "Type a message or tap the mic…" })
      .fill("Hola Robotina");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("You've used your 10 free minutes with Robotina"),
    ).toBeVisible();
    const upgrade = page.getByRole("link", {
      name: "Upgrade for unlimited use",
    });
    await expect(upgrade).toHaveAttribute("href", "/credits");
    await expect(
      page.getByRole("textbox", { name: "Type a message or tap the mic…" }),
    ).toBeDisabled();
    await expect(orbButton(page)).toBeDisabled();
    await expectAccessible(page, testInfo, "robotina free minutes used up");

    await upgrade.click();
    await expect(page).toHaveURL(/\/credits$/);
  });

  test("dashboard widget: the orb with its status and a link to the chat", async ({
    context,
    page,
    baseURL,
  }, testInfo) => {
    await setup(context, baseURL!, {
      "GET /user/dashboard-layout": {
        widgets: [{ id: "voice-assistant", visible: true }],
        updatedAt: null,
      },
    });
    await page.goto("/dashboard");
    const widget = page.locator('[data-widget-id="voice-assistant"]');
    await widget.scrollIntoViewIfNeeded();
    await expect(
      widget.getByRole("button", { name: "Talk to Robotina" }),
    ).toBeVisible();
    await expect(widget.getByRole("status")).toHaveText("Tap to talk");
    await expect(
      widget.getByRole("link", { name: "Open chat" }),
    ).toHaveAttribute("href", "/tools/voice-assistant");
    await expectAccessible(page, testInfo, "robotina widget");
  });
});

test.describe("Robotina on a small phone", () => {
  test.use(VIEWPORTS.phoneSmall.use);

  test("no sideways scroll, thumb-sized controls", async ({
    context,
    page,
    baseURL,
  }) => {
    await setup(context, baseURL!);
    await page.goto("/tools/voice-assistant");
    await expect(orbButton(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTarget(
      page.getByRole("button", { name: "Start voice input" }),
    );
    await expectTouchTarget(page.getByRole("button", { name: "Send" }));
    await expectTouchTarget(orbButton(page));
  });
});
