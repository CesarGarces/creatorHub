"use client";

import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;

/**
 * The current time, updated at the start of every minute (one timer, no
 * per-second renders). Lets a view follow the clock — "now" markers, and a
 * new day after midnight on a dashboard left open.
 */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const timeout = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, MINUTE_MS);
      },
      MINUTE_MS - (Date.now() % MINUTE_MS),
    );
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return now;
}
