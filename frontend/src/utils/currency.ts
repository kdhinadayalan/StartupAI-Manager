export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  SGD: 'S$',
};

export const getCurrencySymbol = (currencyCode?: string): string => {
  if (!currencyCode) return '₹';
  const upper = currencyCode.trim().toUpperCase();
  return CURRENCY_SYMBOLS[upper] || upper;
};

export const formatCurrency = (
  amount: number | null | undefined,
  currencyCode: string = 'INR'
): string => {
  const sym = getCurrencySymbol(currencyCode);
  const num = amount ?? 0;
  return `${sym}${num.toLocaleString()}`;
};
