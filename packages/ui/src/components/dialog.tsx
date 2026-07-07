"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange: _onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return <>{children}</>;
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onClose, ...props }, ref) => {
    const mounted = React.useSyncExternalStore(
      () => () => {},
      () => true,
      () => false,
    );

    React.useEffect(() => {
      if (!mounted) return;
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose?.();
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [mounted, onClose]);

    React.useEffect(() => {
      if (mounted) {
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.body.style.overflow = "";
      };
    }, [mounted]);

    if (!mounted) return null;

    return createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 99999 }}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div
          ref={ref}
          className={cn(
            "relative bg-surface rounded-xl shadow-2xl overflow-hidden",
            className,
          )}
          {...props}
        >
          {children}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <X className="h-4 w-4 text-text-muted" />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);
DialogContent.displayName = "DialogContent";

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-text",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-muted", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
