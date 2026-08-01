/**
 * Price Formatting Utility
 *
 * Centralized utility for formatting prices consistently across the application.
 * Ensures consistent currency display with proper decimal places.
 */

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || Number.isNaN(Number(price))) {
    return "0.00";
  }

  const numPrice = typeof price === "string" ? parseFloat(price) : price;

  if (Number.isNaN(numPrice)) {
    return "0.00";
  }

  return numPrice.toFixed(2);
}
