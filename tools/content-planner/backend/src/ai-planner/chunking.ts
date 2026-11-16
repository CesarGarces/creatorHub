/**
 * Splits text into ~`size`-character chunks on paragraph, then sentence,
 * boundaries; each chunk repeats the last `overlap` characters of the
 * previous one so an idea cut in two stays retrievable.
 */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  // Pieces no longer than `size`: paragraphs, else sentences, else hard cuts.
  const pieces: string[] = [];
  for (const paragraph of clean.split(/\n{2,}/)) {
    if (paragraph.length <= size) {
      pieces.push(paragraph);
      continue;
    }
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      for (let i = 0; i < sentence.length; i += size) {
        pieces.push(sentence.slice(i, i + size));
      }
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > size) {
      chunks.push(current);
      // slice(-0) would be the whole string: no overlap means no tail.
      const tail = overlap > 0 ? current.slice(-overlap) : "";
      current = tail ? `${tail} ${piece}` : piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
