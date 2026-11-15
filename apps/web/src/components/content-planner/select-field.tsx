import { useId } from "react";
import { cn } from "@creator-hub/ui";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  /** Extra options rendered under an <optgroup> heading (skipped when empty). */
  groups?: { label: string; options: SelectOption[] }[];
}

/** Native <select> styled like the shared <Input>. */
export function SelectField({
  label,
  options,
  groups = [],
  className,
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-text-muted"
      >
        {label}
      </label>
      <select
        id={fieldId}
        className={cn(
          "block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text shadow-sm transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups
          .filter((g) => g.options.length > 0)
          .map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </div>
  );
}
