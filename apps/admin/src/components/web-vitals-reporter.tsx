"use client";

import { useReportWebVitals } from "next/web-vitals";

type ReportFn = Parameters<typeof useReportWebVitals>[0];

/**
 * Field (real-user) Core Web Vitals: CLS, LCP, INP, FCP and TTFB of every
 * page view, measured by the `web-vitals` library bundled with Next.js.
 *
 * Each metric is
 * - dispatched as a `creatorhub:web-vital` DOM event (the e2e performance
 *   suite reads it), and
 * - sent with `navigator.sendBeacon` to `NEXT_PUBLIC_WEB_VITALS_ENDPOINT`
 *   when that variable is set at build time — point it at the log/metrics
 *   collector. Unset: nothing leaves the browser.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;
const APP = "admin";

// Module-level so the hook subscribes once (it re-subscribes on a new fn).
const report: ReportFn = (metric) => {
  const detail = {
    app: APP,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    path: window.location.pathname,
  };
  window.dispatchEvent(new CustomEvent("creatorhub:web-vital", { detail }));
  if (!ENDPOINT) return;
  const body = JSON.stringify(detail);
  const sent = navigator.sendBeacon?.(
    ENDPOINT,
    new Blob([body], { type: "application/json" }),
  );
  if (!sent) {
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
  }
};

/** Renders nothing; mount once in the root layout. */
export function WebVitalsReporter() {
  useReportWebVitals(report);
  return null;
}
