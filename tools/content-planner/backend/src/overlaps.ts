export interface TimeSlot {
  id?: string;
  startAt: Date;
  endAt: Date;
}

/** Half-open intervals: a session ending at 10:00 doesn't clash with one starting at 10:00. */
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * Existing sessions that overlap any of the candidates, in chronological
 * order, without duplicates. Candidates never conflict with themselves.
 */
export function findOverlaps<T extends TimeSlot>(
  candidates: TimeSlot[],
  existing: T[],
): T[] {
  const candidateIds = new Set(
    candidates.map((c) => c.id).filter((id): id is string => !!id),
  );
  return existing
    .filter((e) => !(e.id && candidateIds.has(e.id)))
    .filter((e) => candidates.some((c) => overlaps(c, e)))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
