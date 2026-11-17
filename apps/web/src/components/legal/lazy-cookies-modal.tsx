"use client";

import dynamic from "next/dynamic";

/**
 * The cookie banner's policy modal, loaded only when the user opens it: the
 * legal texts (all languages) stay out of every page's first bundle.
 */
export const LazyCookiesModal = dynamic(
  () => import("./legal-modals").then((m) => m.CookiesModal),
  { ssr: false },
);
