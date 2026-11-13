"use client";

import * as React from "react";

/**
 * Built-in, user-visible text used by shared components.
 *
 * Components fall back to these English defaults, so apps that do not care
 * about localization need no setup. Apps that do can wrap their tree in
 * <UiLabelsProvider labels={...}> with translated values.
 */
export interface UiLabels {
  /** Screen-reader label of dialog close buttons. */
  close: string;
  /** Default ActionConfirmDialog title. */
  confirmAction: string;
  /** Default LoadingSpinner text. */
  generating: string;
  addToFavorites: string;
  removeFromFavorites: string;
  premium: string;
  /** Text of <CreditDisplay>, e.g. "1,500 credits". */
  formatCredits: (balance: number) => string;
  /** Display name for a tool status badge ("beta", "inactive"...). */
  formatToolStatus: (status: string) => string;
  cookieConsent: {
    ariaLabel: string;
    message: string;
    acceptAll: string;
    essentialOnly: string;
    cookiePolicy: string;
  };
}

export const DEFAULT_UI_LABELS: UiLabels = {
  close: "Close",
  confirmAction: "Confirm Action",
  generating: "Generating...",
  addToFavorites: "Add to favorites",
  removeFromFavorites: "Remove from favorites",
  premium: "Premium",
  formatCredits: (balance) => `${balance.toLocaleString()} credits`,
  formatToolStatus: (status) => status,
  cookieConsent: {
    ariaLabel: "Cookie consent",
    message:
      "We use cookies and local storage to keep your session active, manage your credit balance, and optimize your experience on Creator Hub.",
    acceptAll: "Accept all",
    essentialOnly: "Essential only",
    cookiePolicy: "Cookie policy",
  },
};

const UiLabelsContext = React.createContext<UiLabels>(DEFAULT_UI_LABELS);

export function UiLabelsProvider({
  labels,
  children,
}: {
  labels: Partial<UiLabels>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ ...DEFAULT_UI_LABELS, ...labels }),
    [labels],
  );
  return (
    <UiLabelsContext.Provider value={value}>
      {children}
    </UiLabelsContext.Provider>
  );
}

export function useUiLabels(): UiLabels {
  return React.useContext(UiLabelsContext);
}
