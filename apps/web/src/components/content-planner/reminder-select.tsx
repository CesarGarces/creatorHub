"use client";

import { Bell } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import {
  REMINDER_OPTIONS,
  reminderOptionKey,
  reminderToValue,
} from "@/lib/content-planner/reminders";
import { SelectField } from "./select-field";

/** "Remind me" picker: none, when it starts, 5 minutes … 1 day before. */
export function ReminderSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <SelectField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
        options={REMINDER_OPTIONS.map((minutes) => ({
          value: reminderToValue(minutes),
          label: t(reminderOptionKey(minutes)),
        }))}
      />
      <Bell
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-text-dim"
      />
    </div>
  );
}
