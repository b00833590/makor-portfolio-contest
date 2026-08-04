export const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK: "Actions",
  CRYPTO: "Crypto",
};

export function signedPct(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function signedCurrency(value: number): string {
  return `${value >= 0 ? "+" : ""}${currencyFormatter.format(value)}`;
}
