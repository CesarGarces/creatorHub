import type { StorageService } from "@creator-hub/storage";

/**
 * Assets store files as `"<bucket>/<key>"` (or, for older rows, a full
 * URL). Returns a URL the browser can load: full URLs as they are, storage
 * references as a short-lived signed URL; `null` when there is nothing to
 * show or signing fails (a missing preview must not fail the request).
 */
export async function resolveStorageRef(
  storage: Pick<StorageService, "getPresignedDownloadUrl">,
  ref: string | null | undefined,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!ref) return null;
  if (/^https?:\/\//.test(ref)) return ref;
  const [bucket, ...rest] = ref.split("/");
  const key = rest.join("/");
  if (!bucket || !key) return null;
  try {
    return await storage.getPresignedDownloadUrl(bucket, key, expiresInSeconds);
  } catch {
    return null;
  }
}
