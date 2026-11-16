import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { BadRequestException } from "@nestjs/common";
import {
  docxXmlToText,
  extractDocument,
  FILE_LIMITS,
  jsonToText,
  normalizeWhitespace,
} from "../ai-planner/document-extractor";
import { makeDocx, makePdf, upload } from "./helpers/files";

describe("extractDocument", () => {
  it("reads PDF text", async () => {
    const doc = await extractDocument(
      upload(
        "brief.pdf",
        makePdf(["Studio tour video", "Film B-roll on Monday (2 hours)"]),
      ),
    );
    expect(doc).toMatchObject({
      name: "brief.pdf",
      kind: "pdf",
      truncated: false,
    });
    expect(doc.text).toBe("Studio tour video\nFilm B-roll on Monday (2 hours)");
  });

  it("reads DOCX paragraphs and decodes XML entities", async () => {
    const doc = await extractDocument(
      upload(
        "Plan.DOCX",
        makeDocx(["Intro &amp; hook", "Edición final &#8212; 3h"]),
      ),
    );
    expect(doc.kind).toBe("docx");
    expect(doc.text).toBe("Intro & hook\nEdición final — 3h");
  });

  it("reads TXT and Markdown (dropping a BOM) and normalises whitespace", async () => {
    expect(
      (
        await extractDocument(
          upload("notes.txt", "\uFEFFLine one\r\n\r\n\r\n\r\nLine   two"),
        )
      ).text,
    ).toBe("Line one\n\nLine two");
    const md = await extractDocument(
      upload("idea.md", "# Title\n- shoot\n- edit"),
    );
    expect(md).toMatchObject({ kind: "md", text: "# Title\n- shoot\n- edit" });
  });

  it("turns JSON into readable path: value lines", async () => {
    const doc = await extractDocument(
      upload(
        "plan.json",
        JSON.stringify({
          title: "Tour",
          steps: [{ name: "Shoot", hours: 3 }, { name: "Edit" }],
          empty: "",
        }),
      ),
    );
    expect(doc.text).toBe(
      "title: Tour\nsteps[0].name: Shoot\nsteps[0].hours: 3\nsteps[1].name: Edit",
    );
  });

  it("rejects unsupported, oversized, fake and empty files by name", async () => {
    const expectBad = async (
      file: ReturnType<typeof upload>,
      message: string,
    ) => {
      const error = await extractDocument(file).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(message);
    };
    await expectBad(
      upload("virus.exe", "MZ"),
      'Unsupported file type: "virus.exe". Use PDF, DOCX, TXT, JSON or MD.',
    );
    await expectBad(
      { ...upload("big.txt", "x"), size: FILE_LIMITS.maxBytes + 1 },
      '"big.txt" is larger than 5 MB',
    );
    await expectBad(upload("fake.pdf", "hello"), 'Couldn\'t read "fake.pdf"');
    await expectBad(upload("fake.docx", "hello"), 'Couldn\'t read "fake.docx"');
    await expectBad(
      upload("broken.json", "{nope"),
      'Couldn\'t read "broken.json"',
    );
    await expectBad(
      upload("blank.md", " \n\n "),
      '"blank.md" has no readable text',
    );
  });

  it("refuses a DOCX whose body would inflate past the limit (zip bomb)", async () => {
    const huge = strToU8("a".repeat(FILE_LIMITS.maxDocxXmlBytes + 1));
    const bomb = Buffer.from(zipSync({ "word/document.xml": huge }));
    expect(bomb.length).toBeLessThan(FILE_LIMITS.maxBytes); // small on disk
    await expect(extractDocument(upload("bomb.docx", bomb))).rejects.toThrow(
      'Couldn\'t read "bomb.docx"',
    );
  });

  it("keeps at most 60k characters per file", async () => {
    const doc = await extractDocument(
      upload("long.txt", "word ".repeat(20_000)),
    );
    expect(doc.truncated).toBe(true);
    expect(doc.text.length).toBe(FILE_LIMITS.maxCharsPerFile);
  });
});

describe("text helpers", () => {
  it("keeps DOCX tabs and breaks", () => {
    expect(
      docxXmlToText(
        "<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>",
      ),
    ).toBe("A\tB\nC\n");
  });

  it("limits JSON depth and skips empty values", () => {
    let deep: unknown = "bottom";
    for (let i = 0; i < 12; i++) deep = { level: deep };
    expect(jsonToText(deep)).toEqual([]);
    expect(jsonToText([null, "", 0, false])).toEqual(["[2]: 0", "[3]: false"]);
  });

  it("normalises whitespace", () => {
    expect(normalizeWhitespace("  a \t b \n\n\n\n c  ")).toBe("a b\n\nc");
  });
});
