import { BadRequestException } from "@nestjs/common";
import { strFromU8, unzipSync } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

/** What users can attach to describe a plan or idea. */
export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
  ".json",
  ".md",
] as const;
export type DocumentKind = "pdf" | "docx" | "txt" | "json" | "md";

export const FILE_LIMITS = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  /** Text kept per file after extraction (the rest is dropped). */
  maxCharsPerFile: 60_000,
  /** Guard against zip bombs: the DOCX body XML may not inflate beyond this. */
  maxDocxXmlBytes: 20 * 1024 * 1024,
} as const;

/** The fields of an uploaded file (multer memory storage). */
export interface UploadedPlanFile {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}

export interface ExtractedDocument {
  name: string;
  kind: DocumentKind;
  text: string;
  truncated: boolean;
}

function kindOf(name: string): DocumentKind | null {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  const ext = match ? `.${match[1]!.toLowerCase()}` : "";
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext.slice(1) as DocumentKind)
    : null;
}

/** Collapses runs of blank lines/spaces and trims. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1] === "x" || code[1] === "X"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    },
  );
}

/** Text of a DOCX body (word/document.xml): paragraphs, breaks and tabs kept. */
export function docxXmlToText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:(br|cr)\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** JSON → "path: value" lines, so a model can read what it describes. */
export function jsonToText(value: unknown, path = "", depth = 0): string[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => jsonToText(v, `${path}[${i}]`, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      jsonToText(v, path ? `${path}.${k}` : k, depth + 1),
    );
  }
  if (value === null || value === undefined || value === "") return [];
  return [path ? `${path}: ${String(value)}` : String(value)];
}

async function readPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function readDocx(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (f) =>
      f.name === "word/document.xml" &&
      f.originalSize <= FILE_LIMITS.maxDocxXmlBytes,
  });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("word/document.xml missing or too large");
  return docxXmlToText(strFromU8(xml));
}

/**
 * Plain text of an uploaded PDF, DOCX, TXT, JSON or Markdown file. Rejects
 * unsupported, oversized, empty or unreadable files with a 400 that names
 * the file.
 */
export async function extractDocument(
  file: UploadedPlanFile,
): Promise<ExtractedDocument> {
  const name = file.originalname || "file";
  const kind = kindOf(name);
  if (!kind) {
    throw new BadRequestException(
      `Unsupported file type: "${name}". Use PDF, DOCX, TXT, JSON or MD.`,
    );
  }
  if (
    file.size > FILE_LIMITS.maxBytes ||
    file.buffer.length > FILE_LIMITS.maxBytes
  ) {
    throw new BadRequestException(`"${name}" is larger than 5 MB`);
  }

  let raw: string;
  try {
    switch (kind) {
      case "pdf":
        if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
          throw new Error("not a PDF");
        }
        raw = await readPdf(file.buffer);
        break;
      case "docx":
        if (file.buffer.subarray(0, 2).toString("latin1") !== "PK") {
          throw new Error("not a DOCX");
        }
        raw = readDocx(file.buffer);
        break;
      case "json": {
        const parsed: unknown = JSON.parse(
          file.buffer.toString("utf8").replace(/^\uFEFF/, ""),
        );
        raw = jsonToText(parsed).join("\n");
        break;
      }
      default:
        raw = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
    }
  } catch {
    throw new BadRequestException(`Couldn't read "${name}"`);
  }

  const text = normalizeWhitespace(raw);
  if (!text) {
    throw new BadRequestException(`"${name}" has no readable text`);
  }
  const truncated = text.length > FILE_LIMITS.maxCharsPerFile;
  return {
    name,
    kind,
    text: truncated ? text.slice(0, FILE_LIMITS.maxCharsPerFile) : text,
    truncated,
  };
}
