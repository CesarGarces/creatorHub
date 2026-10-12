"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";

const CONSENT_KEY = "creator_hub_cookie_consent";

type ConsentValue = "granted" | "essential_only" | null;

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
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

  if (!mounted || !showBanner) {
    return null;
  }

  return (
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
          Usamos cookies y almacenamiento local para mantener tu sesión activa,
          gestionar tu saldo de créditos y optimizar tu experiencia en Creator
          Hub.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto flex-1"
            onClick={() => handleAccept("granted")}
          >
            Aceptar todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={() => handleAccept("essential_only")}
          >
            Solo necesarias
          </Button>
        </div>
        <p className="mt-3 text-center">
          <a
            href="/cookies"
            className="text-xs text-slate-400 hover:text-primary underline transition-colors"
          >
            Política de cookies
          </a>
        </p>
      </div>
    </div>
  );
}
