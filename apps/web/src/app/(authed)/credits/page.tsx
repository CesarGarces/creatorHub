"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, Button, Badge, CreditDisplay } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";

export default function CreditsPage() {
  const { balance, fetchBalance } = useCreditsStore();

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<any[]>("/credits/plans"),
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<any[]>("/credits/transactions"),
  });

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Credits" },
        ]}
      />
      <div className="p-6 space-y-8 max-w-5xl animate-fade-in">
        {/* Balance Card */}
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-text-muted uppercase tracking-wider">Current Balance</p>
          <p className="mt-2 text-5xl font-bold text-text">⚡ {balance.toLocaleString()}</p>
          <p className="mt-1 text-sm text-text-dim">
            Lifetime: {(balance + 3760).toLocaleString()} credits earned
          </p>
          <Button variant="glow" size="lg" className="mt-6">
            Buy More Credits
          </Button>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Subscription Plans</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans?.map((plan: any) => (
              <Card key={plan.id} className="flex flex-col relative overflow-hidden">
                {plan.price > 0 && (
                  <div className="absolute top-0 right-0">
                    <Badge variant="primary" className="rounded-none rounded-bl-lg">Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
                  <p className="text-3xl font-bold text-text">
                    ${((plan.price || 0) / 100).toFixed(2)}
                    <span className="text-sm font-normal text-text-muted">/mo</span>
                  </p>
                  <p className="text-sm text-text-muted">{plan.creditsPerMonth} credits/month</p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features?.map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-text-muted">
                        <span className="text-secondary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button
                    variant={plan.price === 0 ? "secondary" : "primary"}
                    className="w-full"
                  >
                    {plan.price === 0 ? "Current Plan" : "Subscribe"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Transaction History</h2>
          <div className="rounded-xl border border-border bg-surface divide-y divide-border">
            {transactions?.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm ${
                    tx.type === "USAGE" ? "bg-error/10 text-error" :
                    tx.type === "PURCHASE" ? "bg-secondary/10 text-secondary" :
                    "bg-primary/10 text-primary"
                  }`}>
                    {tx.type === "USAGE" ? "↓" : "↑"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{tx.description || tx.type}</p>
                    <p className="text-xs text-text-dim">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${
                  tx.amount < 0 ? "text-error" : "text-secondary"
                }`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} credits
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
    </>
  );
}
