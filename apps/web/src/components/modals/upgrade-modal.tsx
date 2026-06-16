"use client";

import { useState } from "react";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@creator-hub/ui";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const creditPacks = [
  { id: "pack-10", amount: 50, price: 10, label: "Starter", popular: false },
  { id: "pack-25", amount: 150, price: 25, label: "Popular", popular: true },
  { id: "pack-50", amount: 400, price: 50, label: "Pro", popular: false },
];

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [selectedPack, setSelectedPack] = useState<string>("pack-10");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md border border-border"
        onClose={onClose}
      >
        <DialogHeader className="text-center">
          <div className="text-4xl mx-auto">⚡</div>
          <DialogTitle>No credits remaining</DialogTitle>
          <DialogDescription>
            You&apos;ve used all your free credits. Upgrade to continue creating
            amazing thumbnails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {creditPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              className={`relative flex w-full items-center justify-between rounded-xl border p-4 transition-all cursor-pointer ${
                selectedPack === pack.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-elevated hover:border-border/80"
              }`}
            >
              {pack.popular && (
                <Badge
                  variant="accent"
                  size="sm"
                  className="absolute -top-2 right-3"
                >
                  BEST VALUE
                </Badge>
              )}
              <div className="text-left">
                <p className="font-medium text-text">{pack.label}</p>
                <p className="text-sm text-text-muted">{pack.amount} credits</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">${pack.price}</p>
                <p className="text-xs text-text-dim">
                  ${((pack.price / pack.amount) * 100).toFixed(1)}¢/credit
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
              console.log("Purchase:", selectedPack);
              onClose();
            }}
          >
            Recharge Now
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              window.location.href = "/pricing";
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
  );
}
