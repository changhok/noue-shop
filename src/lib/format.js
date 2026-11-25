export const CURRENCIES = ['USD', 'KRW', 'EUR', 'GBP', 'JPY'];

/** 48 -> "$48", 48.5 -> "$48.50", 48000 (KRW) -> "₩48,000" */
export function formatPrice(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      ...(Number.isInteger(value) ? { minimumFractionDigits: 0 } : {}),
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function slugify(text) {
  return (
    String(text ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

export const AVAILABILITY = {
  in_stock: 'In stock',
  sold_out: 'Sold out',
  coming_soon: 'Coming soon',
};
