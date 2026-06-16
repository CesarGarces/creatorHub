"use client";

import { Switch } from "@creator-hub/ui";

interface ToggleProps {
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({
  name,
  checked,
  onChange,
  label,
  disabled,
}: ToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <Switch
        name={name}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {label && <span className="text-sm text-text-muted">{label}</span>}
    </label>
  );
}
