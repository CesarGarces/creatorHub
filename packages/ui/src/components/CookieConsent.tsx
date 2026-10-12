"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";

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
            "fixed bottom-4 right-4 z-50 max-w-sm w-full animate-slide-up",
            "bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl",
            "overflow-hidden",
          )}
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="p-5">
            <p className="text-sm text-slate-200 mb-4">
              We use cookies and local storage to keep your session active,
              manage your credit balance, and optimize your experience on
              Creator Hub.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto flex-1"
                onClick={() => handleAccept("granted")}
              >
                Accept all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => handleAccept("essential_only")}
              >
                Essential only
              </Button>
            </div>
            <p className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-xs text-slate-400 hover:text-primary underline transition-colors"
              >
                Cookie policy
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
