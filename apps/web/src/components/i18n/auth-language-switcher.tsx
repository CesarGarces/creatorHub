"use client";

import { LanguageSelector } from "./language-selector";

/** Language selector pinned to the top-right corner of the sign-in screens. */
export function AuthLanguageSwitcher() {
  return (
    <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20">
      <LanguageSelector />
    </div>
  );
}
