import { describe, expect, it } from "vitest";
import { findDictionaryIssues } from "@creator-hub/i18n";
import { LOCALES } from "../config";
import { getMessages } from "../translate";
import { getLegalDocuments, type LegalDocument } from "../legal";

const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

describe("UI dictionaries", () => {
  it("every language has the same keys, placeholders and tags as English, with no empty strings", () => {
    const dictionaries = {
      en: getMessages("en"),
      es: getMessages("es"),
      pt: getMessages("pt"),
    };
    expect(findDictionaryIssues(dictionaries)).toEqual([]);
  });
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
