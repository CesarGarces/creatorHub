"use client";

import { LanguageSelector } from "./language-selector";

/** Language selector pinned to the top-right corner of the sign-in screens. */
export function AuthLanguageSwitcher() {
  return (
    <div className="absolute right-4 top-4 z-20">
      <LanguageSelector />
    </div>
  );
}
