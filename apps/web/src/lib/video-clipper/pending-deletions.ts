/**
 * Analyses the user chose to discard by leaving the page (refresh, close,
 * navigation) while their video was only in memory.
 *
 * While the page unloads nothing can wait for a response, so the id is
 * first written to localStorage and a `keepalive` DELETE is fired. The next
 * visit of the tool finishes whatever didn't complete (`flushPendingDeletions`),
 * so the analysis is gone after a refresh in every case.
 */
import api, { ApiError } from "@/lib/api";

const STORAGE_KEY = "creator_hub.video_clipper.pending_deletions";
const analysisPath = (id: string) => `/tools/video-clipper/analyses/${id}`;

export function readPendingDeletions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writePendingDeletions(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage disabled (private mode…): the keepalive request still runs.
  }
}

function unmark(id: string): void {
  writePendingDeletions(readPendingDeletions().filter((p) => p !== id));
}

/**
 * Discards an analysis while the page goes away: remembered for the next
 * visit, and deleted right now if the browser lets the request finish.
 */
export function discardAnalysisOnLeave(id: string): void {
  const pending = readPendingDeletions();
  if (!pending.includes(id)) writePendingDeletions([...pending, id]);
  void api
    .delete(analysisPath(id), { keepalive: true })
    .then(() => unmark(id))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) unmark(id);
    });
}

/**
 * Deletes the analyses still pending from a previous visit. Already-deleted
 * ones (404) count as done; others stay pending for the next try.
 * Resolves with the ids that are now gone.
 */
export async function flushPendingDeletions(): Promise<string[]> {
  const done: string[] = [];
  for (const id of readPendingDeletions()) {
    try {
      await api.delete(analysisPath(id));
      done.push(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) done.push(id);
    }
  }
  if (done.length) {
    writePendingDeletions(
      readPendingDeletions().filter((id) => !done.includes(id)),
    );
  }
  return done;
}
