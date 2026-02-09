export type CurrencyCode = 'EUR' | 'GBP';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: '€',
  GBP: '£',
};

/** Format a number as currency string: €12.50 or £12.50 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'EUR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? CURRENCY_SYMBOLS.EUR;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Get the currency symbol only: € or £ */
export function currencySymbol(currency: CurrencyCode = 'EUR'): string {
  return CURRENCY_SYMBOLS[currency] ?? '€';
}
