"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useUiLabels } from "../lib/labels";
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

/** Lets DialogTitle name its dialog without callers wiring ids. */
const DialogTitleIdContext = React.createContext<string | undefined>(undefined);

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  (
    { className, children, onClose, "aria-label": ariaLabel, ...props },
    ref,
  ) => {
    const labels = useUiLabels();
    const titleId = React.useId();
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

    const overlay = (
      <div
        className="fixed inset-x-0 top-[var(--app-vv-top,0px)] flex h-[var(--app-vvh,100dvh)] items-center justify-center p-3 sm:p-4"
        style={{ zIndex: 99999 }}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        {/* Never taller than the visible viewport (keyboard included): the
            dialog scrolls instead of running off-screen on phones. */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          // Named by its DialogTitle, or by `aria-label` when it has none.
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          className={cn(
            "relative w-full max-h-full overflow-y-auto overscroll-contain bg-surface rounded-xl shadow-2xl",
            className,
          )}
          {...props}
        >
          <DialogTitleIdContext.Provider value={titleId}>
            {children}
          </DialogTitleIdContext.Provider>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex items-center justify-center rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary pointer-coarse:right-2 pointer-coarse:top-2 pointer-coarse:h-11 pointer-coarse:w-11"
            >
              <X className="h-4 w-4 text-text-muted" />
              <span className="sr-only">{labels.close}</span>
            </button>
          )}
        </div>
      </div>
    );

    // Server render and hydration: in place, so a dialog that is open on
    // load (e.g. /terms) is in the first paint instead of waiting for
    // JavaScript. Once mounted it moves to <body>, above everything.
    if (!mounted) return overlay;
    return createPortal(overlay, document.body);
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
        // Keeps titles clear of the close button: on the right from `sm`,
        // symmetric on phones (where titles are centred).
        "flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-0 sm:pr-12 max-sm:px-12 max-sm:pt-5",
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
        // Phones: stacked, full-width, thumb-sized buttons with a gap.
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0 max-sm:gap-2 max-sm:px-5 max-sm:pb-5 pointer-coarse:*:min-h-11",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, id, ...props }, ref) => {
  const contextId = React.useContext(DialogTitleIdContext);
  return (
    <h2
      ref={ref}
      id={id ?? contextId}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-text",
        className,
      )}
      {...props}
    />
  );
});
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
