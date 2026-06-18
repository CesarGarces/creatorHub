import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCreditsStore } from "@/store/credits.store";
import { connectSocket } from "@/lib/socket";
import useCheckout from "@/hooks/useCheckout";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  credits: number;
};

export default function CreditPurchaseForm() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { checkout, loadingPlanId } = useCheckout();

  const fetchBalance = useCreditsStore((s) => s.fetchBalance);

  useEffect(() => {
    // If user returns from gateway, poll status (using saved gatewayTxId) and refresh balance
    try {
      const raw = localStorage.getItem("pendingCreditPurchase");
      if (raw) {
        const parsed = JSON.parse(raw);
        const gatewayTxId: string | null = parsed?.gatewayTxId || null;

        if (gatewayTxId) {
          let attempts = 0;
          const maxAttempts = 6;
          const interval = 2000;

          const poll = async () => {
            try {
              const statusRes = await api.get<{ status: string }>(
                `/credits/status/${gatewayTxId}`,
              );
              if (statusRes?.status === "COMPLETED") {
                await fetchBalance();
                localStorage.removeItem("pendingCreditPurchase");
                return;
              }
            } catch {}
            attempts += 1;
            if (attempts < maxAttempts) setTimeout(poll, interval);
          };

          poll();
        } else {
          fetchBalance().catch(() => {});
          localStorage.removeItem("pendingCreditPurchase");
        }
      }
    } catch {}
  }, [fetchBalance]);

  useEffect(() => {
    // Subscribe to real-time notifications
    const socket = connectSocket();
    if (!socket) return;

    const handler = (payload: { gatewayTxId?: string; balance?: number }) => {
      try {
        const raw = localStorage.getItem("pendingCreditPurchase");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (
          parsed?.gatewayTxId &&
          payload?.gatewayTxId === parsed.gatewayTxId
        ) {
          fetchBalance().catch(() => {});
          localStorage.removeItem("pendingCreditPurchase");
        }
      } catch {}
    };

    socket.on("payment:success", handler);
    return () => {
      socket.off("payment:success", handler);
    };
  }, [fetchBalance]);

  useEffect(() => {
    let mounted = true;
    api
      .get<Plan[]>("/credits/plans")
      .then((p) => mounted && setPlans(p))
      .catch((err) => mounted && setError(err.message || "Failed to load"));
    return () => {
      mounted = false;
    };
  }, []);

  // Use `checkout(planId)` from `useCheckout` to start a purchase flow

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!plans) return <div className="p-4">Loading plans…</div>;

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-3">Comprar créditos</h3>
      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex items-center justify-between border p-3 rounded"
          >
            <div>
              <div className="font-medium">{plan.name}</div>
              <div className="text-sm text-gray-500">
                {plan.credits} créditos • ${(plan.priceCents / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <button
                className="btn btn-primary"
                data-test="buy-plan"
                disabled={loadingPlanId !== null && loadingPlanId !== plan.id}
                onClick={() => checkout(plan.id)}
              >
                {loadingPlanId === plan.id ? "Procesando…" : "Comprar"}
              </button>
              {loadingPlanId === plan.id && (
                <div className="text-xs text-yellow-600 mt-1">
                  Estado: PENDING
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
