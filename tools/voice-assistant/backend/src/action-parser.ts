/**
 * Robotina asks to run an action by writing, at the end of her reply:
 *
 *   <action>{"name":"calendar.create_event","args":{…}}</action>
 *
 * `ActionStreamParser` sits between the model stream and the user: text
 * before the tag is shown and spoken as it arrives; the tag itself — even
 * split across chunks — is never shown or spoken; anything after it is
 * dropped (she speaks again once the action has run).
 *
 * Models don't always write the exact format, so the common variations are
 * accepted too: `<action name="calendar.list_events">{…args}</action>`,
 * `<action>calendar.list_events {…}</action>`, arguments at the top level,
 * OpenAI-style `{"function":{"name","arguments":"<json>"}}`, a fenced JSON
 * body, or a missing closing tag.
 */

export const ACTION_OPEN = "<action>";
export const ACTION_CLOSE = "</action>";

export interface ActionCall {
  name: string;
  args: unknown;
}

export interface ParsedStreamEnd {
  /** Text still held back (a tail that turned out not to be a tag). */
  text: string;
  /** The action call, if one was written. */
  action: ActionCall | null;
  /** A tag was written but its content isn't a valid call. */
  malformed: boolean;
  /** What was written inside the tag (for the model, when malformed). */
  raw: string;
}

/** `<action>` or `<action name="…">` — a complete opening tag. */
const OPEN_TAG = /<action(?=[\s>])[^>]*>/i;
/** An opening tag that may still be arriving ("<act", `<action name="x`). */
const PARTIAL_OPEN = /<(a(c(t(i(o(n([\s][^>]*)?)?)?)?)?)?)?$/i;
const NAME_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/i;
const NAME_KEYS = ["name", "action", "tool", "tool_name"] as const;
const ARGS_KEYS = [
  "args",
  "arguments",
  "parameters",
  "params",
  "input",
] as const;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Arguments may come as a JSON string (OpenAI function calling). */
function normalizeArgs(value: unknown): unknown {
  if (typeof value === "string") {
    return parseJsonObject(value) ?? {};
  }
  return value ?? {};
}

/**
 * What's inside an action tag (and the tag's attributes) → call, or null.
 */
export function parseActionCall(
  raw: string,
  attributes = "",
): ActionCall | null {
  const body = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const attrName = /\bname\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
  const leadingName = /^([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)\b/i.exec(body)?.[1];
  const obj = parseJsonObject(body);

  if (obj) {
    const fn =
      obj.function && typeof obj.function === "object"
        ? (obj.function as Record<string, unknown>)
        : null;
    const keyName = NAME_KEYS.map((k) => obj[k]).find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    );
    const name = (
      keyName ??
      (typeof fn?.name === "string" ? fn.name : undefined) ??
      attrName ??
      leadingName
    )?.trim();
    if (!name || !NAME_RE.test(name)) return null;

    const argsKey = ARGS_KEYS.find((k) => k in obj);
    let args: unknown;
    if (argsKey) args = normalizeArgs(obj[argsKey]);
    else if (fn) args = normalizeArgs(fn.arguments ?? fn.parameters);
    else if (keyName) {
      // Arguments written next to the name: {"name":"x.y","date":"…"}
      const rest = { ...obj };
      for (const k of NAME_KEYS) delete rest[k];
      args = rest;
    } else args = obj; // the name came from the tag or the text
    return { name, args };
  }

  const name = (attrName ?? leadingName)?.trim();
  return name && NAME_RE.test(name) ? { name, args: {} } : null;
}

export class ActionStreamParser {
  private held = "";
  private inAction = false;
  private attributes = "";
  private actionText = "";
  private closed = false;

  /** True once an action tag has started (later text is not shown). */
  get sawAction(): boolean {
    return this.inAction || this.closed;
  }

  /** The action's closing tag arrived: the model can stop here. */
  get complete(): boolean {
    return this.closed;
  }

  /** Adds streamed text; returns what can be shown and spoken now. */
  push(delta: string): string {
    if (this.closed) return "";
    if (this.inAction) {
      this.captureAction(delta);
      return "";
    }
    const text = this.held + delta;
    const open = OPEN_TAG.exec(text);
    if (open) {
      this.held = "";
      this.inAction = true;
      this.attributes = open[0];
      this.captureAction(text.slice(open.index + open[0].length));
      return text.slice(0, open.index);
    }
    const partial = PARTIAL_OPEN.exec(text);
    const hold = partial ? partial[0].length : 0;
    this.held = text.slice(text.length - hold);
    return text.slice(0, text.length - hold);
  }

  /** The model finished: the rest of the text and the action, if any. */
  end(): ParsedStreamEnd {
    if (!this.inAction && !this.closed) {
      const text = this.held;
      this.held = "";
      return { text, action: null, malformed: false, raw: "" };
    }
    const action = parseActionCall(this.actionText, this.attributes);
    return {
      text: "",
      action,
      malformed: action === null,
      raw: `${this.attributes}${this.actionText}`.trim(),
    };
  }

  private captureAction(chunk: string): void {
    this.actionText += chunk;
    const close = this.actionText.search(/<\/action\s*>/i);
    if (close !== -1) {
      this.actionText = this.actionText.slice(0, close);
      this.inAction = false;
      this.closed = true;
    }
  }
}

/**
 * She said she'd do something right now ("let me check", "lo busco",
 * "vou verificar"…) — in English, Spanish or Portuguese. Used to catch a
 * reply that announces an action but forgot to write it.
 */
const ANNOUNCEMENT = new RegExp(
  [
    // English
    String.raw`\blet me (quickly )?(check|look|search|see|find|add|create|schedule|pull)`,
    String.raw`\bi(?:'| a)?m (now )?(checking|looking|searching|adding|creating|scheduling|booking)`,
    String.raw`\bi(?:'ll| will) (now )?(check|look|search|add|create|schedule|book)`,
    String.raw`\b(one|just a|give me a) (moment|sec|second)\b`,
    // Spanish
    String.raw`\bd[eé]jame (ver|revisar|buscar|checar|consultar|agendar)`,
    String.raw`\b(lo|la|los|las|te lo|te la) (busco|reviso|agendo|creo|consulto|anoto|apunto)\b`,
    String.raw`\b(voy a|ahora) (buscar|revisar|agendar|crear|consultar|ver|anotar)`,
    String.raw`\bestoy (buscando|revisando|agendando|creando|consultando)`,
    String.raw`\bun (momento|segundo|momentito)\b`,
    // Portuguese
    String.raw`\bdeixa eu (ver|verificar|buscar|checar|conferir|agendar)`,
    String.raw`\bvou (verificar|buscar|ver|agendar|criar|conferir|checar|anotar)`,
    String.raw`\bestou (verificando|buscando|agendando|criando|conferindo)`,
    String.raw`\b(um|s[oó] um) (momento|segundo|minutinho)\b`,
  ].join("|"),
  "i",
);

export function announcesAction(text: string): boolean {
  return ANNOUNCEMENT.test(text);
}
