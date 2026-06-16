"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export interface ActionConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  cancelLabel: string;
  title?: string;
  description?: string;
  confirmVariant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "outline"
    | "glow"
    | "link";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function ActionConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  title = "Confirm Action",
  description,
  confirmVariant = "danger",
  isLoading = false,
  icon,
}: ActionConfirmDialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !mounted) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, mounted]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483646,
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2147483647,
          width: "100%",
          maxWidth: "28rem",
          padding: "1.5rem",
          backgroundColor: "var(--color-surface, #121826)",
          border: "1px solid var(--color-border, #1e293b)",
          borderRadius: "0.75rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          {icon && (
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "9999px",
                backgroundColor:
                  confirmVariant === "danger"
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(0,187,217,0.1)",
                color:
                  confirmVariant === "danger"
                    ? "var(--color-error, #ef4444)"
                    : "var(--color-primary, #00bbd9)",
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "var(--color-text, #f1f5f9)",
                margin: 0,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted, #94a3b8)",
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(buttonVariants({ variant: confirmVariant }))}
          >
            {isLoading ? (
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
