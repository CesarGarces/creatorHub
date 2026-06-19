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

function PaymentStatusModal({
  status,
  onClose,
}: {
  status: "success" | "failed" | "pending" | null;
  onClose: () => void;
}) {
  if (!status) return null;

  const config = {
    success: {
      icon: "✅",
      title: "Payment Successful",
      message:
        "Your credits have been added to your account. You are ready to create!",
      bgColor: "bg-success/10",
      borderColor: "border-success/30",
      textColor: "text-success",
    },
    failed: {
      icon: "❌",
      title: "Payment Failed",
      message:
        "We could not process your payment. Please try again or use a different method.",
      bgColor: "bg-error/10",
      borderColor: "border-error/30",
      textColor: "text-error",
    },
    pending: {
      icon: "⏳",
      title: "Processing Payment",
      message: "We are verifying your payment. Credits will be added shortly.",
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
            {status === "success" ? "Start Creating" : "Try Again"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditsPage() {
  const searchParams = useSearchParams();
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
    usdAmount: number;
    creditsGiven: number;
  }) => {
    setSelectedPlan({
      name: plan.name,
      price: `$${plan.usdAmount.toFixed(2)}`,
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
          name: "Pay as you go",
          price: `$${amount.toFixed(2)}`,
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
          Pending
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-success/10 text-success border-success/30 text-[10px]"
      >
        Completed
      </Badge>
    );
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Credits" },
        ]}
      />
      <div className="p-6 space-y-8 max-w-6xl mx-auto animate-fade-in">
        {/* Balance + Transaction History row */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Balance Card */}
          <div className="rounded-xl border border-border bg-surface p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-text-muted uppercase tracking-wider">
              Current Balance
            </p>
            <p className="mt-3 text-5xl font-bold text-text">
              ⚡ {balance.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-text-dim">
              Lifetime: {lifetimeEarned.toLocaleString()} credits earned
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
              Buy More Credits
            </Button>
          </div>

          {/* Transaction History */}
          <div className="rounded-xl border border-border bg-surface flex flex-col">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
                Transaction History
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
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      tx.amount < 0 ? "text-error" : "text-secondary"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount} credits
                  </span>
                </div>
              ))}
              {!transactions && (
                <div className="px-5 py-8 text-center text-sm text-text-dim">
                  No transactions yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Credit Plans</h2>
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
                      Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <h3 className="text-lg font-semibold text-text">
                    {plan.name}
                  </h3>
                  <p className="text-3xl font-bold text-text">
                    ${plan.usdAmount.toFixed(2)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {plan.creditsGiven.toLocaleString()} credits
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-text-muted">{plan.description}</p>
                  <p className="mt-3 text-xs text-text-dim">
                    ${((plan.usdAmount / plan.creditsGiven) * 100).toFixed(1)}¢
                    per credit
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
                      ? "Procesando..."
                      : "Buy Credits"}
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
        title="Get started now"
      />

      {/* Buy Credits Modal */}
      <Dialog open={buyModalOpen} onOpenChange={setBuyModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClose={() => setBuyModalOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>Buy Credits</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-text-muted">
              Enter the amount in dollars (minimum $10). Credits are calculated
              based on the Pay as you go plan rate.
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
                className="pl-7"
              />
            </div>
            <p className="text-xs text-text-dim">
              You will receive approximately{" "}
              {Math.floor((parseFloat(buyAmount) || 0) * 100)} credits
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setBuyModalOpen(false)}
                disabled={buyLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBuyCredits}
                isLoading={buyLoading}
                disabled={parseFloat(buyAmount) < 10 || buyLoading}
              >
                Pay ${(parseFloat(buyAmount) || 0).toFixed(2)}
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
