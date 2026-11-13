import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Telegraf fake ────────────────────────────────────────────────────
const tg = vi.hoisted(() => ({
  bots: [] as Array<{
    token: string;
    messageHandler?: (ctx: unknown) => void;
    errorHandler?: (err: unknown) => void;
    onLaunchStop?: () => void;
    telegram: {
      getMe: ReturnType<typeof vi.fn>;
      sendMessage: ReturnType<typeof vi.fn>;
    };
    launch: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  getMe: null as null | (() => Promise<{ id: number; username?: string }>),
}));

vi.mock("telegraf", () => ({
  Telegraf: class {
    messageHandler?: (ctx: unknown) => void;
    errorHandler?: (err: unknown) => void;
    onLaunchStop?: () => void;
    telegram = {
      getMe: vi.fn(() =>
        tg.getMe
          ? tg.getMe()
          : Promise.resolve({ id: 42, username: "fan_bot" }),
      ),
      sendMessage: vi.fn(async () => ({})),
    };
    launch = vi.fn((cb: () => void) => {
      this.onLaunchStop = cb;
      return new Promise(() => {});
    });
    stop = vi.fn();
    constructor(public token: string) {
      tg.bots.push(this as never);
    }
    catch(fn: (err: unknown) => void) {
      this.errorHandler = fn;
    }
    on(event: string, fn: (ctx: unknown) => void) {
      if (event === "message") this.messageHandler = fn;
    }
  },
}));

// ─── Baileys fake ─────────────────────────────────────────────────────
const wa = vi.hoisted(() => ({
  sockets: [] as Array<{
    ev: {
      on: (e: string, fn: (arg: never) => void) => void;
      off: (e: string, fn: (arg: never) => void) => void;
      emit: (e: string, arg: unknown) => void;
    };
    user?: { id: string };
    end: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    config: {
      auth: {
        creds: unknown;
        keys: {
          get: (
            type: string,
            ids: string[],
          ) => Promise<Record<string, unknown>>;
          set: (data: Record<string, Record<string, unknown>>) => Promise<void>;
        };
      };
    };
  }>,
}));

vi.mock("@whiskeysockets/baileys", async () => {
  const { EventEmitter } = await import("events");
  const makeWASocket = vi.fn((config: unknown) => {
    const emitter = new EventEmitter();
    const sock = {
      ev: {
        on: (e: string, fn: (...a: unknown[]) => void) => emitter.on(e, fn),
        off: (e: string, fn: (...a: unknown[]) => void) => emitter.off(e, fn),
        emit: (e: string, arg: unknown) => emitter.emit(e, arg),
      },
      user: undefined as undefined | { id: string },
      end: vi.fn(),
      sendMessage: vi.fn(async () => ({})),
      config,
    };
    wa.sockets.push(sock as never);
    return sock;
  });
  return {
    default: makeWASocket,
    DisconnectReason: {
      loggedOut: 401,
      connectionReplaced: 440,
      restartRequired: 515,
    },
    initAuthCreds: () => ({ fresh: true }),
    makeCacheableSignalKeyStore: (store: unknown) => store,
    Browsers: { ubuntu: (name: string) => ["Ubuntu", name, "1"] },
  };
});

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async (qr: string) => `data:image/png;base64,${qr}`),
  },
}));

import { TelegramConnector } from "../connectors/telegram.connector";
import { WhatsAppConnector } from "../connectors/whatsapp.connector";

function events() {
  return { onMessage: vi.fn(), onStatusChange: vi.fn(), onQrCode: vi.fn() };
}

function closeWith(statusCode: number | undefined, message = "closed") {
  const error = Object.assign(new Error(message), { output: { statusCode } });
  return { connection: "close", lastDisconnect: { error } };
}

beforeEach(() => {
  tg.bots.length = 0;
  tg.getMe = null;
  wa.sockets.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Telegram ─────────────────────────────────────────────────────────

describe("TelegramConnector", () => {
  function privateMessage(overrides: Record<string, unknown> = {}) {
    return {
      message: { message_id: 7, date: 1_700_000_000, text: "  Hi there!  " },
      from: {
        id: 1,
        is_bot: false,
        username: "fan",
        first_name: "Big",
        last_name: "Fan",
      },
      chat: { id: 555, type: "private" },
      ...overrides,
    };
  }

  it("validates credentials", async () => {
    await expect(new TelegramConnector().connect({}, events())).rejects.toThrow(
      "Telegram credentials must include a botToken",
    );
  });

  it("validates the token with getMe, launches long polling and reports CONNECTED", async () => {
    const ev = events();
    const connector = new TelegramConnector();

    const result = await connector.connect({ botToken: "123:ABC" }, ev);

    expect(tg.bots[0]!.token).toBe("123:ABC");
    expect(tg.bots[0]!.launch).toHaveBeenCalled();
    expect(result).toEqual({ externalIdentity: "@fan_bot" });
    expect(ev.onStatusChange).toHaveBeenCalledWith({
      status: "CONNECTED",
      externalIdentity: "@fan_bot",
    });
    expect(connector.isConnected()).toBe(true);
  });

  it("fails fast on an invalid token without launching", async () => {
    tg.getMe = () => Promise.reject(new Error("401: Unauthorized"));

    await expect(
      new TelegramConnector().connect({ botToken: "bad" }, events()),
    ).rejects.toThrow("401: Unauthorized");
    expect(tg.bots[0]!.launch).not.toHaveBeenCalled();
  });

  it("normalizes private text messages", async () => {
    const ev = events();
    await new TelegramConnector().connect({ botToken: "t" }, ev);

    tg.bots[0]!.messageHandler!(privateMessage());

    expect(ev.onMessage).toHaveBeenCalledWith({
      externalMessageId: "7",
      externalUserId: "555",
      username: "fan",
      displayName: "Big Fan",
      text: "Hi there!",
      receivedAt: 1_700_000_000_000,
    });
  });

  it.each([
    ["group chats", { chat: { id: 9, type: "group" } }],
    ["other bots", { from: { id: 2, is_bot: true } }],
    ["non-text messages", { message: { message_id: 8, date: 1, sticker: {} } }],
    ["blank text", { message: { message_id: 8, date: 1, text: "   " } }],
  ])("ignores %s", async (_label, overrides) => {
    const ev = events();
    await new TelegramConnector().connect({ botToken: "t" }, ev);

    tg.bots[0]!.messageHandler!(privateMessage(overrides));

    expect(ev.onMessage).not.toHaveBeenCalled();
  });

  it("reports runtime errors and marks itself disconnected", async () => {
    const ev = events();
    const connector = new TelegramConnector();
    await connector.connect({ botToken: "t" }, ev);

    tg.bots[0]!.errorHandler!(new Error("409: Conflict"));

    expect(connector.isConnected()).toBe(false);
    expect(ev.onStatusChange).toHaveBeenLastCalledWith({
      status: "ERROR",
      error: "409: Conflict",
    });
  });

  it("splits replies longer than Telegram's 4096-char limit", async () => {
    const connector = new TelegramConnector();
    await connector.connect({ botToken: "t" }, events());

    await connector.sendMessage("555", "a".repeat(4096) + "b".repeat(10));

    const sent = tg.bots[0]!.telegram.sendMessage.mock.calls;
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(["555", "a".repeat(4096)]);
    expect(sent[1]).toEqual(["555", "b".repeat(10)]);
  });

  it("refuses to send while disconnected and disconnects idempotently", async () => {
    const connector = new TelegramConnector();
    await expect(connector.sendMessage("1", "hi")).rejects.toThrow(
      "not connected",
    );

    await connector.connect({ botToken: "t" }, events());
    tg.bots[0]!.stop.mockImplementation(() => {
      throw new Error("Bot is not running!");
    });
    await connector.disconnect();
    await connector.disconnect();

    expect(connector.isConnected()).toBe(false);
  });

  it("tears down the previous bot when reconnecting", async () => {
    const connector = new TelegramConnector();
    await connector.connect({ botToken: "t1" }, events());
    await connector.connect({ botToken: "t2" }, events());

    expect(tg.bots[0]!.stop).toHaveBeenCalled();
    expect(tg.bots[1]!.token).toBe("t2");
  });
});

// ─── WhatsApp ─────────────────────────────────────────────────────────

describe("WhatsAppConnector", () => {
  async function nextSocket(index: number) {
    await vi.waitFor(() => expect(wa.sockets.length).toBeGreaterThan(index));
    return wa.sockets[index]!;
  }

  async function connected(ev = events(), creds: unknown = {}) {
    const connector = new WhatsAppConnector();
    const promise = connector.connect(creds, ev);
    const sock = await nextSocket(0);
    sock.user = { id: "573001112233:12@s.whatsapp.net" };
    sock.ev.emit("connection.update", { connection: "open" });
    const result = await promise;
    return { connector, sock, ev, result };
  }

  it("connects with stored credentials and reports the phone number", async () => {
    const { connector, result, ev } = await connected();

    expect(result).toEqual({ externalIdentity: "573001112233@s.whatsapp.net" });
    expect(connector.isConnected()).toBe(true);
    expect(ev.onStatusChange).toHaveBeenCalledWith({
      status: "CONNECTED",
      externalIdentity: "573001112233@s.whatsapp.net",
    });
    await connector.disconnect();
  });

  it("sends QR codes as data URLs during pairing", async () => {
    const ev = events();
    const connector = new WhatsAppConnector();
    const promise = connector.connect({}, ev);
    const sock = await nextSocket(0);

    sock.ev.emit("connection.update", { qr: "QR-PAYLOAD" });

    await vi.waitFor(() =>
      expect(ev.onQrCode).toHaveBeenCalledWith(
        "data:image/png;base64,QR-PAYLOAD",
      ),
    );
    sock.user = { id: "1@s.whatsapp.net" };
    sock.ev.emit("connection.update", { connection: "open" });
    await promise;
    await connector.disconnect();
  });

  it("reconnects with the saved credentials after pairing (515 restart)", async () => {
    const connector = new WhatsAppConnector();
    const promise = connector.connect({}, events());
    const first = await nextSocket(0);

    first.ev.emit("connection.update", { isNewLogin: true });
    const second = await nextSocket(1);
    second.user = { id: "999@s.whatsapp.net" };
    second.ev.emit("connection.update", { connection: "open" });

    await expect(promise).resolves.toEqual({
      externalIdentity: "999@s.whatsapp.net",
    });
    // The same auth state object is reused so freshly saved creds apply.
    expect(second.config.auth.creds).toBe(first.config.auth.creds);
    await connector.disconnect();
  });

  it("fails when the QR code is not scanned in time", async () => {
    vi.useFakeTimers();
    const connector = new WhatsAppConnector();
    const promise = connector.connect({}, events());
    const assertion = expect(promise).rejects.toThrow(
      /QR was not scanned in time/,
    );

    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
  });

  it("fails when the connection closes during the first attempt", async () => {
    const connector = new WhatsAppConnector();
    const promise = connector.connect({}, events());
    const sock = await nextSocket(0);

    sock.ev.emit("connection.update", closeWith(500, "stream errored"));

    await expect(promise).rejects.toThrow("Connection closed: stream errored");
  });

  it("restores stored auth state, dropping null and NaN keys", async () => {
    const { connector, sock } = await connected(events(), {
      authState: {
        creds: { me: "stored" },
        keys: { "pre-key": { "1": { k: 1 }, "2": null, "3": Number.NaN } },
      },
    });

    expect(sock.config.auth.creds).toEqual({ me: "stored" });
    expect(await sock.config.auth.keys.get("pre-key", ["1", "2", "3"])).toEqual(
      { "1": { k: 1 } },
    );
    await connector.disconnect();
  });

  it("persists sanitized credentials whenever they change", async () => {
    const updater = vi.fn(async () => {});
    const connector = new WhatsAppConnector();
    connector.setSessionUpdater(updater);
    const promise = connector.connect(
      { authState: { creds: { counter: Number.NaN, ok: 1 }, keys: {} } },
      events(),
    );
    const sock = await nextSocket(0);
    sock.user = { id: "1@s.whatsapp.net" };
    sock.ev.emit("connection.update", { connection: "open" });
    await promise;

    await sock.config.auth.keys.set({ session: { abc: { v: 1 } } });
    sock.ev.emit("creds.update", {});

    await vi.waitFor(() => expect(updater).toHaveBeenCalled());
    expect(updater).toHaveBeenCalledWith({
      authState: {
        creds: { counter: 0, ok: 1 },
        keys: { session: { abc: { v: 1 } } },
      },
    });
    await connector.disconnect();
  });

  describe("incoming messages", () => {
    function upsert(messages: unknown[], type = "notify") {
      return { type, messages };
    }
    function msg(
      remoteJid: string,
      text: string | undefined,
      extra: Record<string, unknown> = {},
    ) {
      return {
        key: { remoteJid, id: "MSG1", fromMe: false },
        message:
          text === undefined ? { imageMessage: {} } : { conversation: text },
        pushName: "Fan",
        messageTimestamp: 1_700_000_000,
        ...extra,
      };
    }

    it("normalizes direct text messages (including extended text)", async () => {
      const { connector, sock, ev } = await connected();

      sock.ev.emit(
        "messages.upsert",
        upsert([
          msg("573009998877@s.whatsapp.net", "  hola  "),
          {
            ...msg("12345@lid", undefined),
            message: { extendedTextMessage: { text: "link https://x.com" } },
          },
        ]),
      );

      expect(ev.onMessage).toHaveBeenNthCalledWith(1, {
        externalMessageId: "MSG1",
        externalUserId: "573009998877@s.whatsapp.net",
        username: "573009998877",
        displayName: "Fan",
        text: "hola",
        receivedAt: 1_700_000_000_000,
      });
      expect(ev.onMessage.mock.calls[1]![0]).toMatchObject({
        username: "12345",
        text: "link https://x.com",
      });
      await connector.disconnect();
    });

    it.each([
      ["history syncs", upsert([msg("1@s.whatsapp.net", "hi")], "append")],
      ["status broadcasts", upsert([msg("status@broadcast", "hi")])],
      [
        "own messages",
        upsert([
          {
            ...msg("1@s.whatsapp.net", "hi"),
            key: { remoteJid: "1@s.whatsapp.net", fromMe: true },
          },
        ]),
      ],
      ["group chats", upsert([msg("12036@g.us", "hi")])],
      ["non-text messages", upsert([msg("1@s.whatsapp.net", undefined)])],
      [
        "messages to self",
        upsert([msg("573001112233@s.whatsapp.net", "note to self")]),
      ],
    ])("ignores %s", async (_label, payload) => {
      const { connector, sock, ev } = await connected();

      sock.ev.emit("messages.upsert", payload);

      expect(ev.onMessage).not.toHaveBeenCalled();
      await connector.disconnect();
    });
  });

  describe("after connecting", () => {
    it("requires a rescan when logged out, without reconnecting", async () => {
      const { connector, sock, ev } = await connected();

      sock.ev.emit("connection.update", closeWith(401));

      expect(connector.isConnected()).toBe(false);
      expect(ev.onStatusChange).toHaveBeenLastCalledWith({
        status: "REQUIRES_RESCAN",
        error: "Session expired — scan QR again",
      });
      await connector.disconnect();
    });

    it("stops reconnecting when another device replaces the session", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { connector, sock, ev } = await connected();

      sock.ev.emit("connection.update", closeWith(440));
      await vi.advanceTimersByTimeAsync(600_000);

      expect(ev.onStatusChange.mock.calls.at(-1)![0]).toMatchObject({
        status: "REQUIRES_RESCAN",
      });
      expect(wa.sockets).toHaveLength(1);
      await connector.disconnect();
    });

    it("reconnects after transient drops with exponential backoff", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { connector, sock, ev } = await connected();

      sock.ev.emit("connection.update", closeWith(500));
      expect(ev.onStatusChange).toHaveBeenLastCalledWith({
        status: "DISCONNECTED",
        error: "Connection closed (500), reconnecting…",
      });

      await vi.advanceTimersByTimeAsync(2_900);
      expect(wa.sockets).toHaveLength(1); // first retry after 3s
      await vi.advanceTimersByTimeAsync(200);
      expect(wa.sockets).toHaveLength(2);

      const retry = wa.sockets[1]!;
      retry.user = { id: "573001112233@s.whatsapp.net" };
      retry.ev.emit("connection.update", { connection: "open" });
      await vi.waitFor(() => expect(connector.isConnected()).toBe(true));
      await connector.disconnect();
    });

    it("ignores the expected 515 restart on an active socket", async () => {
      const { connector, sock, ev } = await connected();
      const calls = ev.onStatusChange.mock.calls.length;

      sock.ev.emit("connection.update", closeWith(515));

      expect(ev.onStatusChange.mock.calls.length).toBe(calls);
      expect(connector.isConnected()).toBe(true);
      await connector.disconnect();
    });

    it("splits long replies and refuses to send when disconnected", async () => {
      const { connector, sock } = await connected();

      await connector.sendMessage("1@s.whatsapp.net", "x".repeat(5000));
      expect(sock.sendMessage).toHaveBeenCalledTimes(2);
      expect(sock.sendMessage.mock.calls[1]).toEqual([
        "1@s.whatsapp.net",
        { text: "x".repeat(904) },
      ]);

      await connector.disconnect();
      await expect(
        connector.sendMessage("1@s.whatsapp.net", "hi"),
      ).rejects.toThrow("not connected");
      expect(sock.end).toHaveBeenCalled();
    });
  });
});
