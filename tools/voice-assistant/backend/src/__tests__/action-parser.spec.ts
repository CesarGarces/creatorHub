import { describe, expect, it } from "vitest";
import {
  ActionStreamParser,
  announcesAction,
  parseActionCall,
} from "../action-parser";

const CALL =
  '{"name":"calendar.create_event","args":{"title":"Edit","date":"2026-11-28"}}';

/** Feeds `text` in chunks of `size`; returns shown text and the end. */
function run(text: string, size: number) {
  const parser = new ActionStreamParser();
  let shown = "";
  for (let i = 0; i < text.length; i += size) {
    shown += parser.push(text.slice(i, i + size));
  }
  const end = parser.end();
  return { shown: shown + end.text, end, parser };
}

describe("ActionStreamParser", () => {
  it.each([1, 3, 7, 500])(
    "hides the action tag split into chunks of %i",
    (size) => {
      const { shown, end } = run(
        `Perfect, I'm adding it now. <action>${CALL}</action>`,
        size,
      );
      expect(shown).toBe("Perfect, I'm adding it now. ");
      expect(end.action).toEqual({
        name: "calendar.create_event",
        args: { title: "Edit", date: "2026-11-28" },
      });
      expect(end.malformed).toBe(false);
    },
  );

  it("passes normal text through, holding back only a possible tag start", () => {
    const parser = new ActionStreamParser();
    expect(parser.push("Use <b>bold</b> and a <")).toBe(
      "Use <b>bold</b> and a ",
    );
    expect(parser.push("3 heart")).toBe("<3 heart");
    expect(parser.end()).toEqual({
      text: "",
      action: null,
      malformed: false,
      raw: "",
    });
  });

  it("drops anything written after the action", () => {
    const { shown, parser } = run(`Ok. <action>${CALL}</action> Done!`, 4);
    expect(shown).toBe("Ok. ");
    expect(parser.complete).toBe(true);
  });

  it("accepts a missing closing tag and fenced JSON", () => {
    const { end } = run("<action>```json\n" + CALL + "\n```", 5);
    expect(end.action?.name).toBe("calendar.create_event");
  });

  it("flags an unreadable action", () => {
    const { shown, end } = run("Sure <action>{oops}</action>", 3);
    expect(shown).toBe("Sure ");
    expect(end).toEqual({
      text: "",
      action: null,
      malformed: true,
      raw: "<action>{oops}",
    });
  });
});

describe("parseActionCall", () => {
  it("reads name + args, and the alternative keys", () => {
    expect(parseActionCall(CALL)).toEqual({
      name: "calendar.create_event",
      args: { title: "Edit", date: "2026-11-28" },
    });
    expect(
      parseActionCall(
        '{"action":"calendar.list_events","arguments":{"date":"2026-11-28"}}',
      ),
    ).toEqual({ name: "calendar.list_events", args: { date: "2026-11-28" } });
    expect(parseActionCall('{"name":"x.y"}')).toEqual({
      name: "x.y",
      args: {},
    });
  });

  it("returns null for anything else", () => {
    expect(parseActionCall("")).toBeNull();
    expect(parseActionCall("not json")).toBeNull();
    expect(parseActionCall('{"args":{}}')).toBeNull();
  });
});

describe("tolerant action formats", () => {
  const LIST = { name: "calendar.list_events", args: { date: "2026-11-28" } };

  it.each([
    ['<action name="calendar.list_events">{"date":"2026-11-28"}</action>'],
    ['<action>calendar.list_events {"date":"2026-11-28"}</action>'],
    ['<action>{"name":"calendar.list_events","date":"2026-11-28"}</action>'],
    [
      '<action>{"tool":"calendar.list_events","parameters":{"date":"2026-11-28"}}</action>',
    ],
    [
      '<action>{"function":{"name":"calendar.list_events","arguments":"{\\"date\\":\\"2026-11-28\\"}"}}</action>',
    ],
    [
      '<ACTION>{"name":"calendar.list_events","args":{"date":"2026-11-28"}}</ACTION>',
    ],
  ])("reads %s", (written) => {
    for (const size of [1, 4, 100]) {
      const { shown, end } = run(`Un momento. ${written}`, size);
      expect(shown).toBe("Un momento. ");
      expect(end.action).toEqual(LIST);
    }
  });

  it("keeps the raw text of an unreadable action for the model", () => {
    const { end } = run("<action>list the events please</action>", 3);
    expect(end).toMatchObject({
      malformed: true,
      raw: "<action>list the events please",
    });
  });

  it("a lone '<' or an unrelated tag is just text", () => {
    expect(run("I <3 you, <b>really</b>", 2).shown).toBe(
      "I <3 you, <b>really</b>",
    );
    expect(run("<actions> are fun", 3).shown).toBe("<actions> are fun");
  });
});

describe("announcesAction", () => {
  it.each([
    "Ok, let me check your calendar.",
    "I'm checking now, one moment.",
    "Sure! I'll add it right away.",
    "Ok, lo busco en este momento.",
    "Déjame revisar tu agenda.",
    "Voy a buscar tus planes.",
    "Estoy revisando, un momento.",
    "Claro, vou verificar sua agenda.",
    "Deixa eu ver, só um momento.",
  ])("catches %s", (text) => {
    expect(announcesAction(text)).toBe(true);
  });

  it.each([
    "Tomorrow you have two sessions.",
    "Let me know if you need anything else!",
    "¿A qué hora empieza?",
    "Que bom! Como foi seu dia?",
  ])("ignores %s", (text) => {
    expect(announcesAction(text)).toBe(false);
  });
});
