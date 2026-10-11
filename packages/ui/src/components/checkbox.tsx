"use client";

import * as React from "react";
import * as CheckboxPrimitives from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitives.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[4px] border border-border bg-surface shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitives.Indicator
        className={cn(
          "flex items-center justify-center text-text-inverse transition-opacity",
          "data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-0 data-[state=indeterminate]:opacity-100",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  );
});
Checkbox.displayName = CheckboxPrimitives.Root.displayName;

export { Checkbox };
