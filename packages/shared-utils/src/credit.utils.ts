export function calculateCredits(
  baseCost: number,
  multiplier: number = 1,
  discount: number = 0
): number {
  const gross = Math.round(baseCost * multiplier);
  return Math.max(1, gross - Math.round(gross * discount));
}

export function formatCredits(credits: number): string {
  return new Intl.NumberFormat("en-US").format(credits);
}
