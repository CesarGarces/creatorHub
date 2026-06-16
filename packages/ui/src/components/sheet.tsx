"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open, onOpenChange: _onOpenChange, children }: SheetProps) {
  if (!open) return null;
  return <>{children}</>;
}

const SHEET_SIDE_STYLES = {
  top: {
    container: "inset-x-0 top-0 h-auto max-h-[85vh]",
    animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  bottom: {
    container: "inset-x-0 bottom-0 h-auto max-h-[85vh]",
    animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  left: {
    container: "inset-y-0 left-0 w-[85vw] max-w-sm",
    animation: "slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  right: {
    container: "inset-y-0 right-0 w-[85vw] max-w-sm",
    animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const;

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: keyof typeof SHEET_SIDE_STYLES;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => {
    React.useEffect(() => {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }, []);

    if (typeof document === "undefined") return null;

    const sideStyles = SHEET_SIDE_STYLES[side];

    return createPortal(
      <>
        <div
          className="fixed inset-0 bg-black/60 z-[99998]"
          style={{ animation: "fadeIn 0.15s ease-out" }}
        />
        <div
          ref={ref}
          className={cn(
            "fixed bg-surface border-l border-border shadow-2xl z-[99999]",
            sideStyles.container,
            className,
          )}
          style={{ animation: sideStyles.animation }}
          {...props}
        >
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            {children}
          </div>
        </div>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideLeft {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideRight {
            from { opacity: 0; transform: translateX(-100%); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(100%); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-100%); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </>,
      document.body,
    );
  },
);
SheetContent.displayName = "SheetContent";

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-text", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-muted", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
