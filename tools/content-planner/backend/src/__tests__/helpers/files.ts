import { strToU8, zipSync } from "fflate";
import type { UploadedPlanFile } from "../../ai-planner/document-extractor";

/** A real one-page PDF (Helvetica, one text line per entry). */
export function makePdf(lines: string[]): Buffer {
  const escape = (l: string) => l.replace(/[\\()]/g, (c) => `\\${c}`);
  const content =
    "BT /F1 12 Tf 72 720 Td " +
    lines.map((l, i) => `${i ? "0 -16 Td " : ""}(${escape(l)}) Tj`).join(" ") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

/** A minimal DOCX (zip with word/document.xml) with one paragraph per entry. */
export function makeDocx(
  paragraphs: string[],
  extra: Record<string, Uint8Array> = {},
): Buffer {
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
    .join("");
  const xml = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`;
  return Buffer.from(zipSync({ "word/document.xml": strToU8(xml), ...extra }));
}

export function upload(
  name: string,
  buffer: Buffer | string,
): UploadedPlanFile {
  const data =
    typeof buffer === "string" ? Buffer.from(buffer, "utf8") : buffer;
  return { originalname: name, size: data.length, buffer: data };
}
