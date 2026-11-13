"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

function PaymentStatusModal({
  status,
  onClose,
}: {
  status: "success" | "failed" | "pending" | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!status) return null;

  const config = {
    success: {
      icon: "✅",
      title: t("credits.paymentStatus.success.title"),
      message: t("credits.paymentStatus.success.message"),
      bgColor: "bg-success/10",
      borderColor: "border-success/30",
      textColor: "text-success",
    },
    failed: {
      icon: "❌",
      title: t("credits.paymentStatus.failed.title"),
      message: t("credits.paymentStatus.failed.message"),
      bgColor: "bg-error/10",
      borderColor: "border-error/30",
      textColor: "text-error",
    },
    pending: {
      icon: "⏳",
      title: t("credits.paymentStatus.pending.title"),
      message: t("credits.paymentStatus.pending.message"),
      bgColor: "bg-warning/10",
      borderColor: "border-warning/30",
      textColor: "text-warning",
    },
  };

  const c = config[status];

  return (
    <Dialog open={!!status} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onClose={onClose}>
        <div
          className={`flex flex-col items-center p-6 rounded-lg ${c.bgColor} border ${c.borderColor}`}
        >
          <span className="text-4xl mb-3">{c.icon}</span>
          <DialogTitle className={`text-lg font-semibold ${c.textColor}`}>
            {c.title}
          </DialogTitle>
          <p className="mt-2 text-sm text-text-muted text-center">
            {c.message}
          </p>
          <Button variant="primary" className="mt-4" onClick={onClose}>
            {status === "success"
              ? t("credits.paymentStatus.startCreating")
              : t("credits.paymentStatus.tryAgain")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditsPage() {
  const searchParams = useSearchParams();
  const { t, formatNumber, formatDate } = useI18n();
  const { planName, planDescription } = usePlanText();
  const formatUsd = (value: number) =>
    formatNumber(value, { style: "currency", currency: "USD" });
  const { balance, fetchBalance } = useCreditsStore();
  const { checkout, loadingPlanId } = useCheckout();

  const [modalOpen, setModalOpen] = useState(false);
  const [activePreferenceId, setActivePreferenceId] = useState<string | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] = useState({ name: "", price: "" });

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState("10");
  const [buyLoading, setBuyLoading] = useState(false);

  // Payment status modal
  const [paymentStatus, setPaymentStatus] = useState<
    "success" | "failed" | "pending" | null
  >(null);
  const processedParamsRef = useRef(false);

  // Check URL params from MercadoPago redirect
  useEffect(() => {
    if (processedParamsRef.current) return;

    const collectionStatus = searchParams.get("collection_status");
    const status = searchParams.get("status");
    const paymentStatusParam = collectionStatus || status;

    if (paymentStatusParam) {
      processedParamsRef.current = true;

      if (paymentStatusParam === "approved") {
        setPaymentStatus("success");
        fetchBalance();
      } else if (
        paymentStatusParam === "rejected" ||
        paymentStatusParam === "failed"
      ) {
        setPaymentStatus("failed");
      } else {
        setPaymentStatus("pending");
      }

      // Clean all MercadoPago params from URL to prevent re-showing on refresh
      const cleanUrl = new URL(window.location.href);
      const mpParams = [
        "collection_status",
        "status",
        "payment_id",
        "collection_id",
        "preference_id",
        "merchant_order_id",
      ];
      mpParams.forEach((p) => cleanUrl.searchParams.delete(p));
      window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search);
    }
  }, [searchParams, fetchBalance]);

  // Listen for WebSocket payment events
  useEffect(() => {
    const handlePaymentEvent = (event: CustomEvent) => {
      const { status } = event.detail || {};
      if (status === "success") {
        setPaymentStatus("success");
        fetchBalance();
      } else if (status === "failed") {
        setPaymentStatus("failed");
      } else if (status === "pending") {
        setPaymentStatus("pending");
      }
    };

    window.addEventListener(
      "payment:success",
      handlePaymentEvent as EventListener,
    );
    window.addEventListener(
      "payment:failed",
      handlePaymentEvent as EventListener,
    );
    window.addEventListener(
      "payment:pending",
      handlePaymentEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        "payment:success",
        handlePaymentEvent as EventListener,
      );
      window.removeEventListener(
        "payment:failed",
        handlePaymentEvent as EventListener,
      );
      window.removeEventListener(
        "payment:pending",
        handlePaymentEvent as EventListener,
      );
    };
  }, [fetchBalance]);

  const { data: allPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any[]>("/credits/plans"),
  });

  const plans = allPlans?.filter((p) => p.slug !== "PAY_AS_YOU_GO");
  const paygPlan = allPlans?.find((p) => p.slug === "PAY_AS_YOU_GO");

  // Calculate credits for custom amount using the real PAY_AS_YOU_GO plan rate
  const calculatedCredits = useMemo(() => {
    const amount = parseFloat(buyAmount) || 0;
    if (amount <= 0) return 0;
    if (paygPlan) {
      return Math.floor((amount / paygPlan.usdAmount) * paygPlan.creditsGiven);
    }
    return Math.floor(amount * 100);
  }, [buyAmount, paygPlan]);

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
    slug?: string;
    name: string;
    usdAmount: number;
    creditsGiven: number;
  }) => {
    setSelectedPlan({
      name: planName(plan),
      price: formatUsd(plan.usdAmount),
    });
    setModalOpen(true);
    setActivePreferenceId(null);

    try {
      const result = await checkout(plan.id, {
        onSuccess: (data) => {
          if (data.preferenceId) {
            setActivePreferenceId(data.preferenceId);
          }
        },
        onError: () => setModalOpen(false),
      });
      if (!result.preferenceId && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch {
      setModalOpen(false);
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

      if (res.preferenceId) {
        setSelectedPlan({
          name: paygPlan
            ? planName(paygPlan)
            : t("credits.planCatalog.PAY_AS_YOU_GO.name"),
          price: formatUsd(amount),
        });
        setActivePreferenceId(res.preferenceId);
        setBuyModalOpen(false);
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Checkout failed", err);
    } finally {
      setBuyLoading(false);
    }
  };

  function getPaymentStatusBadge(tx: any) {
    if (tx.type !== "PURCHASE" || !tx.referenceId) return null;
    if (tx.description?.toLowerCase().includes("pending")) {
      return (
        <Badge
          variant="outline"
          className="bg-warning/10 text-warning border-warning/30 text-[10px]"
        >
          {t("credits.pending")}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-success/10 text-success border-success/30 text-[10px]"
      >
        {t("credits.completed")}
      </Badge>
    );
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.credits") },
        ]}
      />
      <div className="p-6 space-y-8 max-w-6xl mx-auto animate-fade-in">
        {/* Balance + Transaction History row */}
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text">
                          {tx.description || tx.type}
                        </p>
                        {getPaymentStatusBadge(tx)}
                      </div>
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
            {t("credits.creditPlans")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans?.map((plan: any) => (
              <Card
                key={plan.id}
                className="flex flex-col relative overflow-hidden"
              >
                {plan.slug === "STARTER" && (
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
                    {formatUsd(plan.usdAmount)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {t("credits.planCredits", { count: plan.creditsGiven })}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-text-muted">
                    {planDescription(plan)}
                  </p>
                  <p className="mt-3 text-xs text-text-dim">
                    {t("credits.perCredit", {
                      amount: formatNumber(
                        (plan.usdAmount / plan.creditsGiven) * 100,
                        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                      ),
                    })}
                  </p>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={loadingPlanId === plan.id}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {loadingPlanId === plan.id
                      ? t("credits.processing")
                      : t("credits.buyCredits")}
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
        title={t("credits.checkoutTitle")}
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
              {t("credits.buyModal.description")}
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
              {t("credits.buyModal.approximately", {
                count: calculatedCredits,
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

      {/* Payment Status Modal */}
      <PaymentStatusModal
        status={paymentStatus}
        onClose={() => setPaymentStatus(null)}
      />
    </>
  );
}
