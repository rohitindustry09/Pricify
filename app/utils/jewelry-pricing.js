// app/utils/jewelry-pricing.js

/**
 * Parse weight in grams from variant selectedOptions.
 *
 * Looks for an option whose name is like "Weight", "wt", "grams", etc.
 * Then extracts the first number from the value, e.g. "10g", "10 g", "10 grams".
 */
export function parseWeightFromOptions(selectedOptions) {
  if (!Array.isArray(selectedOptions)) return 0;

  const opt = selectedOptions.find((o) => {
    const name = (o?.name || "").toLowerCase();
    return ["weight", "wt", "grams", "gram", "g", "gms"].includes(name);
  });

  if (!opt) return 0;

  // Extract first number from the value
  const match = String(opt.value).match(/([\d.,]+)/);
  if (!match) return 0;

  const num = parseFloat(match[1].replace(",", ""));
  return Number.isNaN(num) ? 0 : num; // assume grams
}

/**
 * Calculate price from:
 *  - weight in grams
 *  - rate per gram (₹/g)
 *  - percentage adjustment (markup / discount)
 *
 * newPrice = (weightGrams * ratePerGram) * (1 + percent/100)
 */
export function calculatePriceFromRate(weightGrams, ratePerGram, percent) {
  const w = Number(weightGrams || 0);
  const r = Number(ratePerGram || 0);
  const p = Number(percent || 0);

  const base = w * r;
  const result = base * (1 + p / 100);
  return Math.round(result * 100) / 100; // 2 decimals
}

/**
 * Simple stats for the selected collections.
 */
export function summarizeSelectedCollections(selectedCollections) {
  const totalCollections = selectedCollections.length;
  const totalProducts = selectedCollections.reduce(
    (sum, c) => sum + (c.products?.length || 0),
    0
  );

  return { totalCollections, totalProducts };
}