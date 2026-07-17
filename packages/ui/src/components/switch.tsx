"use client";

import * as React from "react";

const Switch = React.forwardRef<
  HTMLInputElement,
  {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    name?: string;
    className?: string;
  }
>(({ checked = false, onCheckedChange, disabled, name, className }, ref) => {
  return (
    <label
      className={`relative inline-flex cursor-pointer items-center ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className ?? ""}`}
    >
      <input
        ref={ref}
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <div className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-primary" />
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
});
Switch.displayName = "Switch";

export { Switch };
