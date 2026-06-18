import { useState } from "react";
import api from "@/lib/api";

export type CheckoutResponse = {
  redirectUrl?: string;
  gatewayUrl?: string;
  gatewayTxId?: string | null;
};

export default function useCheckout() {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  async function checkout(planId: string) {
    setLoadingPlanId(planId);
    try {
      const res = await api.post<CheckoutResponse>("/credits/checkout", {
        planId,
      });
      const redirectUrl = (res as any).redirectUrl || (res as any).gatewayUrl;
      const gatewayTxId = (res as any).gatewayTxId || null;
      if (redirectUrl) {
        try {
          localStorage.setItem(
            "pendingCreditPurchase",
            JSON.stringify({ planId, gatewayTxId, createdAt: Date.now() }),
          );
        } catch {}
        window.location.href = redirectUrl;
      } else {
        throw new Error("No redirect URL returned from checkout");
      }
    } finally {
      setLoadingPlanId(null);
    }
  }

  return { checkout, loadingPlanId } as const;
}
