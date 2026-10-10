export function formatXAF(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

export function discountPercent(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
