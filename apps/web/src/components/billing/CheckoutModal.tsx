"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@creator-hub/ui";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";

const MP_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "";

if (typeof window !== "undefined" && MP_KEY) {
  initMercadoPago(MP_KEY, { locale: "es-CO" });
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferenceId: string | null;
  planName: string;
  price: string;
  title?: string;
}

export function CheckoutModal({
  isOpen,
  onClose,
  preferenceId,
  planName,
  price,
  title = "Complete Payment",
}: CheckoutModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg w-[calc(100%-2rem)]"
        onClose={onClose}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center my-6 mx-6 p-5 rounded-lg bg-surface-elevated/50 border border-border">
          <span className="text-sm text-text-muted">Selected Plan</span>
          <span className="text-lg font-semibold text-primary">{planName}</span>
          <span className="text-2xl font-bold mt-2 text-text">{price}</span>
        </div>

        <div className="mx-6 pb-6">
          {preferenceId && MP_KEY ? (
            <Wallet
              initialization={{ preferenceId }}
              customization={{
                theme: "dark",
                valueProp: "convenience_all",
                customStyle: {
                  buttonBackground: "black",
                  borderRadius: "6px",
                },
              }}
            />
          ) : (
            <div className="text-center py-4 text-text-dim text-sm animate-pulse">
              {!MP_KEY
                ? "Payment configuration missing. Please contact support."
                : "Preparing secure payment environment..."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
