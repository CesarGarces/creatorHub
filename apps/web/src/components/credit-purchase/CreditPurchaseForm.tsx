"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import useCheckout from "@/hooks/useCheckout";
import { CheckoutModal } from "@/components/billing/CheckoutModal";
import { useI18n } from "@/i18n/i18n-provider";
import { usePlanText } from "@/i18n/use-plan-text";

export default function CreditsPage() {
  const { t, formatNumber, formatDate } = useI18n();
  const { planName } = usePlanText();
  const formatUsd = (value: number) =>
    formatNumber(value, { style: "currency", currency: "USD" });
  const { balance } = useCreditsStore();
  const { checkout } = useCheckout();

  const [modalOpen, setModalOpen] = useState(false);
  const [activePreferenceId, setActivePreferenceId] = useState<string | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] = useState({ name: "", price: "" });

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("10");
  const [buyLoading, setBuyLoading] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any[]>("/credits/plans"),
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<any[]>("/credits/transactions"),
  });

  const lifetimeEarned = useMemo(() => {
    if (!transactions) return balance;
    return transactions
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, balance]);

  const handleSubscribe = async (plan: {
    id: string;
    name: string;
    price: number;
  }) => {
    try {
      const result = await checkout(plan.id, {
        onSuccess: (data) => {
          if (data.gatewayTxId) {
            // Guardamos en el almacén local para activar los WebSockets de inmediato
            localStorage.setItem(
              "pendingCreditPurchase",
              JSON.stringify({ gatewayTxId: data.gatewayTxId }),
            );
          }
        },
      });

      // Si el backend nos dio un link de pasarela, lo abrimos en una nueva pestaña del navegador
      if (result?.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Plan checkout failed", err);
    }
  };

  const handleBuyCredits = async () => {
    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount < 10) return;

    setBuyLoading(true);
    try {
      const res = await api.post<{
        redirectUrl?: string;
        gatewayTxId?: string;
        preferenceId?: string;
      }>("/credits/custom-checkout", { amount });

      if (res.gatewayTxId) {
        localStorage.setItem(
          "pendingCreditPurchase",
          JSON.stringify({ gatewayTxId: res.gatewayTxId }),
        );
      }

      setBuyModalOpen(false);

      const paymentUrl =
        res.redirectUrl ||
        `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${res.preferenceId}`;
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Custom checkout failed", err);
    } finally {
      setBuyLoading(false);
    }
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.credits") },
        ]}
      />
      <div className="p-6 space-y-8 max-w-6xl mx-auto animate-fade-in">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Balance Card */}
          <div className="rounded-xl border border-border bg-surface p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-text-muted uppercase tracking-wider">
              {t("credits.currentBalance")}
            </p>
            <p className="mt-3 text-5xl font-bold text-text">
              ⚡ {formatNumber(balance)}
            </p>
            <p className="mt-1 text-sm text-text-dim">
              {t("credits.lifetimeEarned", { count: lifetimeEarned })}
            </p>
            <Button
              variant="glow"
              size="lg"
              className="mt-6"
              onClick={() => {
                setBuyAmount("10");
                setBuyModalOpen(true);
              }}
            >
              {t("credits.buyMore")}
            </Button>
          </div>

          {/* Transaction History */}
          <div className="rounded-xl border border-border bg-surface flex flex-col">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                {t("credits.transactionHistory")}
              </h2>
            </div>
            <div className="flex-1 divide-y divide-border overflow-y-auto max-h-80">
              {transactions?.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-elevated/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${
                        tx.type === "USAGE"
                          ? "bg-error/10 text-error"
                          : tx.type === "PURCHASE"
                            ? "bg-secondary/10 text-secondary"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {tx.type === "USAGE" ? "↓" : "↑"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        {tx.description || tx.type}
                      </p>
                      <p className="text-xs text-text-dim">
                        {formatDate(tx.createdAt, { dateStyle: "short" })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      tx.amount < 0 ? "text-error" : "text-secondary"
                    }`}
                  >
                    {t("credits.amount", {
                      sign: tx.amount > 0 ? "+" : tx.amount < 0 ? "-" : "",
                      count: Math.abs(tx.amount),
                    })}
                  </span>
                </div>
              ))}
              {!transactions && (
                <div className="px-5 py-8 text-center text-sm text-text-dim">
                  {t("credits.noTransactions")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-4">
            {t("credits.subscriptionPlans")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans?.map((plan: any) => (
              <Card
                key={plan.id}
                className="flex flex-col relative overflow-hidden"
              >
                {plan.price > 0 && (
                  <div className="absolute top-0 right-0">
                    <Badge
                      variant="primary"
                      className="rounded-none rounded-bl-lg"
                    >
                      {t("credits.popular")}
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <h3 className="text-lg font-semibold text-text">
                    {planName(plan)}
                  </h3>
                  <p className="text-3xl font-bold text-text">
                    {formatUsd((plan.price || 0) / 100)}
                    <span className="text-sm font-normal text-text-muted">
                      {t("credits.perMonth")}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    {t("credits.creditsPerMonth", {
                      count: plan.creditsPerMonth ?? 0,
                    })}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features?.map((f: string) => (
                      <li
                        key={f}
                        className="flex items-center gap-2 text-sm text-text-muted"
                      >
                        <span className="text-secondary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button
                    variant={plan.price === 0 ? "secondary" : "primary"}
                    {...(plan.price > 0 ? { "data-test": "buy-plan" } : {})}
                    className="w-full"
                    onClick={() => plan.price > 0 && handleSubscribe(plan)}
                  >
                    {plan.price === 0
                      ? t("credits.currentPlan")
                      : t("credits.subscribe")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <CheckoutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        preferenceId={activePreferenceId}
        planName={selectedPlan.name}
        price={selectedPlan.price}
        title={t("credits.checkoutTitleAlt")}
      />

      {/* Buy Credits Modal */}
      <Dialog open={buyModalOpen} onOpenChange={setBuyModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClose={() => setBuyModalOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{t("credits.buyModal.title")}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-muted">
              {t("credits.buyModal.descriptionSimple")}
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                $
              </span>
              <Input
                type="number"
                min={10}
                step="1"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                aria-label={t("credits.buyModal.amountLabel")}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-text-dim">
              {t("credits.buyModal.exactly", {
                count: Math.floor(parseFloat(buyAmount) || 0),
              })}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setBuyModalOpen(false)}
                disabled={buyLoading}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleBuyCredits}
                isLoading={buyLoading}
                disabled={parseFloat(buyAmount) < 10 || buyLoading}
              >
                {t("credits.buyModal.pay", {
                  amount: formatUsd(parseFloat(buyAmount) || 0),
                })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
