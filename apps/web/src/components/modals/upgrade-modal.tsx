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
import { useI18n } from "@/i18n/i18n-provider";
import { usePlanText } from "@/i18n/use-plan-text";
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
  const { t, formatNumber } = useI18n();
  const { planName } = usePlanText();
  const formatUsd = (value: number) =>
    formatNumber(value, { style: "currency", currency: "USD" });
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
      name: planName(plan),
      price: formatUsd(plan.usdAmount),
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
            <DialogTitle>{t("upgrade.title")}</DialogTitle>
            <DialogDescription>{t("upgrade.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {creditPacks.map((plan: any) => (
              <button
                type="button"
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
                    {t("upgrade.bestValue")}
                  </Badge>
                )}
                <div className="text-left">
                  <p className="font-medium text-text">{planName(plan)}</p>
                  <p className="text-sm text-text-muted">
                    {t("upgrade.credits", { count: plan.creditsGiven })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {formatUsd(plan.usdAmount)}
                  </p>
                  <p className="text-xs text-text-dim">
                    {t("upgrade.perCredit", {
                      amount: formatNumber(
                        (plan.usdAmount / plan.creditsGiven) * 100,
                        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                      ),
                    })}
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
              {t("upgrade.rechargeNow")}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                router.push("/pricing");
              }}
            >
              {t("upgrade.subscribe")}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="w-full text-sm text-text-muted hover:text-text transition-colors"
            >
              {t("upgrade.maybeLater")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PayDialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <PayDialogContent className="sm:max-w-md">
          <PayDialogHeader>
            <PayDialogTitle>{t("upgrade.completeTitle")}</PayDialogTitle>
          </PayDialogHeader>
          <div className="p-6">
            <p className="text-sm text-text-muted">
              {t("upgrade.purchasing", {
                plan: selectedPlan.name,
                price: selectedPlan.price,
              })}
            </p>
            {activePreferenceId && (
              <div className="mt-4">
                {/* MercadoPago checkout would render here */}
                <p className="text-xs text-text-dim">
                  {t("upgrade.redirecting")}
                </p>
              </div>
            )}
          </div>
        </PayDialogContent>
      </PayDialog>
    </>
  );
}
