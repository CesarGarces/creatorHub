import { useState } from "react";
import api from "@/lib/api";

export type CheckoutResult = {
  preferenceId: string | null;
  gatewayTxId: string | null;
  redirectUrl: string | null;
};

type CheckoutOptions = {
  onSuccess?: (data: CheckoutResult) => void;
  onError?: (err: unknown) => void;
};

export default function useCheckout() {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  async function checkout(planId: string, options?: CheckoutOptions) {
    setLoadingPlanId(planId);
    try {
      const res = await api.post<{
        redirectUrl?: string;
        gatewayTxId?: string;
        preferenceId?: string;
      }>("/credits/checkout", { planId });

      const result: CheckoutResult = {
        preferenceId: res.preferenceId || null,
        gatewayTxId: res.gatewayTxId || null,
        redirectUrl: res.redirectUrl || null,
      };

      options?.onSuccess?.(result);
      return result;
    } catch (err) {
      options?.onError?.(err);
      throw err;
    } finally {
      setLoadingPlanId(null);
    }
  }

  return { checkout, loadingPlanId } as const;
}
