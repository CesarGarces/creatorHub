import { describe, expect, it } from "vitest";
import { LOCALES } from "../config";
import { getMessages } from "../translate";
import { getLegalDocuments, type LegalDocument } from "../legal";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

const en = flatten(getMessages("en") as unknown as Tree);

describe("UI dictionaries", () => {
  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const other = flatten(getMessages(locale) as unknown as Tree);

    it(`${locale} has exactly the same keys as en`, () => {
      expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
    });

    it(`${locale} keeps every {placeholder} and <tag> from en`, () => {
      const problems: string[] = [];
      for (const [key, source] of Object.entries(en)) {
        const target = other[key] ?? "";
        if (placeholders(source).join() !== placeholders(target).join()) {
          problems.push(`${key}: placeholders differ`);
        }
        if (tags(source).join() !== tags(target).join()) {
          problems.push(`${key}: tags differ`);
        }
      }
      expect(problems).toEqual([]);
    });

    it(`${locale} has no empty translations`, () => {
      const empty = Object.entries(other)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty).toEqual([]);
    });
  }
});

describe("legal documents", () => {
  const shape = (doc: LegalDocument) =>
    doc.sections.map((s) =>
      s.blocks.map((b) =>
        b.type === "ul"
          ? `ul:${b.items.length}`
          : b.type === "table"
            ? `table:${b.headers.length}x${b.rows.length}`
            : b.type,
      ),
    );

  const texts = (doc: LegalDocument) =>
    doc.sections.flatMap((s) =>
      s.blocks.flatMap((b) =>
        b.type === "p" || b.type === "h4"
          ? [b.text]
          : b.type === "ul"
            ? b.items
            : b.type === "table"
              ? b.rows.flat()
              : [],
      ),
    );

  const enDocs = getLegalDocuments("en");

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const docs = getLegalDocuments(locale);
    for (const id of ["privacy", "terms", "cookies"] as const) {
      it(`${locale} ${id} mirrors the English structure and markup`, () => {
        expect(shape(docs[id])).toEqual(shape(enDocs[id]));
        expect(texts(docs[id]).map(tags)).toEqual(texts(enDocs[id]).map(tags));
      });
    }
  }
});
