"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { useUiLabels } from "../lib/labels";

const CONSENT_KEY = "creator_hub_cookie_consent";

type ConsentValue = "granted" | "essential_only" | null;

interface CookiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CookieConsentProps {
  CookiesModal?: ComponentType<CookiesModalProps>;
}

export function CookieConsent({ CookiesModal }: CookieConsentProps) {
  const { cookieConsent: labels } = useUiLabels();
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const consent = localStorage.getItem(CONSENT_KEY) as ConsentValue;
    if (consent === null) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = (value: Exclude<ConsentValue, null>) => {
    localStorage.setItem(CONSENT_KEY, value);
    setShowBanner(false);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <div
          className={cn(
            // Inset on both sides on phones; a corner card from `sm`.
            "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 animate-slide-up sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-sm",
            "bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl",
            "overflow-hidden",
          )}
          role="dialog"
          aria-label={labels.ariaLabel}
        >
          <div className="p-5">
            <p className="text-sm text-slate-200 mb-4">{labels.message}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto sm:flex-1 pointer-coarse:h-11"
                onClick={() => handleAccept("granted")}
              >
                {labels.acceptAll}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto sm:flex-1 pointer-coarse:h-11 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => handleAccept("essential_only")}
              >
                {labels.essentialOnly}
              </Button>
            </div>
            <p className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-xs text-slate-400 hover:text-primary underline transition-colors"
              >
                {labels.cookiePolicy}
              </button>
            </p>
          </div>
        </div>
      )}
      {CookiesModal && showModal && (
        <CookiesModal open={showModal} onOpenChange={setShowModal} />
      )}
    </>
  );
}
