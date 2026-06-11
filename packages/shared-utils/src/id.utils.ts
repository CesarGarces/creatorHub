import { nanoid } from "nanoid";

export function generateId(prefix?: string): string {
  const id = nanoid(24);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateCorrelationId(): string {
  return `corr_${nanoid(16)}`;
}
