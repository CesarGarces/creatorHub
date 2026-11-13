/**
 * Test helpers for fetch-based providers and gateways.
 */

/** A JSON `Response`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A plain-text error `Response`. */
export function errorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

/**
 * A streaming `Response` emitting the given SSE `data:` payloads. The raw
 * text is re-chunked at arbitrary byte boundaries (`chunkSize`) so parsers
 * must buffer partial lines correctly.
 */
export function sseResponse(
  events: Array<unknown | "[DONE]">,
  chunkSize = 7,
): Response {
  const text = events
    .map((e) => `data: ${e === "[DONE]" ? "[DONE]" : JSON.stringify(e)}\n\n`)
    .join("");
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

/** An OpenAI-style streaming delta chunk. */
export function delta(content: string, finishReason?: string) {
  return {
    choices: [
      {
        delta: { content },
        ...(finishReason ? { finish_reason: finishReason } : {}),
      },
    ],
  };
}

/** Collects all items from an async generator. */
export async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) items.push(item);
  return items;
}
