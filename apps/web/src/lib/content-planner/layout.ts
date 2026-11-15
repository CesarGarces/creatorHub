import { MINUTES_PER_DAY, addDays } from "./dates";

export interface TimedItem {
  id: string;
  startAt: string;
  endAt: string;
}

export interface PositionedItem<T extends TimedItem> {
  item: T;
  /** Minutes since the day's midnight, clipped to the day. */
  startMinute: number;
  endMinute: number;
  /** Side-by-side placement among overlapping items. */
  column: number;
  columns: number;
  /** The item started on a previous day / continues into the next one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Shortest rendered height, so 5-minute sessions stay clickable. */
export const MIN_VISIBLE_MINUTES = 20;

/**
 * Positions the items that intersect `day` in a time grid. Overlapping
 * items share the width of their cluster in columns (like Google Calendar).
 */
export function layoutDay<T extends TimedItem>(
  items: T[],
  day: Date,
): PositionedItem<T>[] {
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();

  const segments = items
    .map((item) => {
      const start = new Date(item.startAt).getTime();
      const end = new Date(item.endAt).getTime();
      if (end <= dayStart || start >= dayEnd) return null;
      const startMinute = Math.max(0, (start - dayStart) / 60_000);
      const endMinute = Math.min(MINUTES_PER_DAY, (end - dayStart) / 60_000);
      return {
        item,
        startMinute,
        endMinute,
        // Layout uses the visible height so tiny items don't get covered.
        visualEnd: Math.min(
          MINUTES_PER_DAY,
          Math.max(endMinute, startMinute + MIN_VISIBLE_MINUTES),
        ),
        continuesBefore: start < dayStart,
        continuesAfter: end > dayEnd,
        column: 0,
        columns: 1,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort(
      (a, b) =>
        a.startMinute - b.startMinute ||
        b.visualEnd - a.visualEnd ||
        a.item.id.localeCompare(b.item.id),
    );

  // Sweep: a cluster ends when the next item starts after everything so far.
  let cluster: typeof segments = [];
  let clusterEnd = -1;
  const columnEnds: number[] = [];

  const closeCluster = () => {
    for (const s of cluster) s.columns = columnEnds.length;
    cluster = [];
    columnEnds.length = 0;
  };

  for (const s of segments) {
    if (s.startMinute >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= s.startMinute);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = s.visualEnd;
    s.column = column;
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.visualEnd);
  }
  closeCluster();

  return segments.map(({ visualEnd: _visualEnd, ...rest }) => rest);
}
