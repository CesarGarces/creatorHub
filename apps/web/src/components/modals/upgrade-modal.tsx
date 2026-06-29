"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@creator-hub/ui";
import useCheckout from "@/hooks/useCheckout";
import {
  Dialog as PayDialog,
  DialogContent as PayDialogContent,
  DialogHeader as PayDialogHeader,
  DialogTitle as PayDialogTitle,
} from "@creator-hub/ui";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    name: string;
    price: string;
  }>({ name: "", price: "" });
  const [activePreferenceId, setActivePreferenceId] = useState<string | null>(
    null,
  );
  const { checkout } = useCheckout();

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any[]>("/credits/plans"),
    enabled: isOpen,
  });

  const creditPacks =
    plans?.filter((p: any) => p.slug !== "PAY_AS_YOU_GO") || [];

  const handleBuy = async (plan: any) => {
    setSelectedPlan({
      name: plan.name,
      price: `$${plan.usdAmount.toFixed(2)}`,
    });
    setCheckoutOpen(true);
    setActivePreferenceId(null);

    try {
      const result = await checkout(plan.id, {
        onSuccess: (data) => {
          if (data.preferenceId) {
            setActivePreferenceId(data.preferenceId);
          }
        },
        onError: () => setCheckoutOpen(false),
      });
      if (!result.preferenceId && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch {
      setCheckoutOpen(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="max-w-md border border-border"
          onClose={onClose}
        >
          <DialogHeader className="text-center">
            <div className="text-4xl mx-auto">⚡</div>
            <DialogTitle>No credits remaining</DialogTitle>
            <DialogDescription>
              You&apos;ve used all your free credits. Upgrade to continue
              creating amazing thumbnails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {creditPacks.map((plan: any) => (
              <button
                key={plan.id}
                onClick={() => handleBuy(plan)}
                className={`relative flex w-full items-center justify-between rounded-xl border p-4 transition-all cursor-pointer ${
                  selectedPlanId === plan.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-elevated hover:border-border/80"
                }`}
              >
                {plan.slug === "STARTER" && (
                  <Badge
                    variant="accent"
                    size="sm"
                    className="absolute -top-2 right-3"
                  >
                    BEST VALUE
                  </Badge>
                )}
                <div className="text-left">
                  <p className="font-medium text-text">{plan.name}</p>
                  <p className="text-sm text-text-muted">
                    {plan.creditsGiven.toLocaleString()} credits
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    ${plan.usdAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-text-dim">
                    {((plan.usdAmount / plan.creditsGiven) * 100).toFixed(1)}
                    ¢/credit
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              onClick={() => {
                if (selectedPlanId) {
                  const plan = creditPacks.find(
                    (p: any) => p.id === selectedPlanId,
                  );
                  if (plan) handleBuy(plan);
                }
              }}
            >
              Recharge Now
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                router.push("/pricing");
              }}
            >
              Or Subscribe for Unlimited
            </Button>

            <button
              onClick={onClose}
              className="w-full text-sm text-text-muted hover:text-text transition-colors"
            >
              Maybe later
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PayDialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <PayDialogContent className="sm:max-w-md">
          <PayDialogHeader>
            <PayDialogTitle>Complete your purchase</PayDialogTitle>
          </PayDialogHeader>
          <div className="p-6">
            <p className="text-sm text-text-muted">
              Purchasing {selectedPlan.name} plan for {selectedPlan.price}
            </p>
            {activePreferenceId && (
              <div className="mt-4">
                {/* MercadoPago checkout would render here */}
                <p className="text-xs text-text-dim">
                  Redirecting to payment...
                </p>
              </div>
            )}
          </div>
        </PayDialogContent>
      </PayDialog>
    </>
  );
}
