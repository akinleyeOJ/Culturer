/** Checkout, cart, and order UIs use Polish złoty (PLN). */
export function formatPln(amount: number): string {
  return `PLN ${amount.toFixed(2)}`;
}

/** Stripe PaymentIntent currency for Culturer checkout. */
export const STRIPE_CHECKOUT_CURRENCY = "pln";

/** Parse product `price` from DB whether stored as number or decorated string. */
export function parseLoosePrice(value: string | number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
