/**
 * Centralized HPP (Harga Pokok Penjualan) calculation using integer cents.
 *
 * All HPP endpoints (POST /penjualan, POST /transaksi/quick, fix-missing-hpp)
 * MUST use this helper. Uses integer cents for precise calculation — no floating
 * point bugs, no per-unit rounding that compounds over qty.
 *
 * Algorithm: calculate total HPP directly from totalCost and totalQty,
 * with ONE rounding at the total level (not per-unit).
 *
 * Formula: hppTotalCents = Math.round((totalCostCents * qtySold) / totalQty)
 *
 * This handles edge cases correctly:
 * - totalCost=1000, totalQty=3, qtySold=3 → hppTotal=1000 (not 999!)
 * - totalCost=1, totalQty=3, qtySold=1 → hppTotal=0.33
 *
 * Rules:
 * - totalQty MUST be > 0 (otherwise throws)
 * - totalCost MUST be >= 0 (otherwise throws)
 * - qtySold MUST be > 0 integer (otherwise throws)
 * - HPP = 0 is ONLY allowed when item is not inventory (caller should skip)
 * - Conversion to Rupiah string happens ONLY at insert/response time
 */

export interface HppCalculationResult {
  /** Total HPP in integer cents */
  hppTotalCents: number;
  /** Total HPP as Rupiah decimal string (for DB storage) */
  hppTotalStr: string;
  /** Per-unit HPP in cents (for display only, NOT for accounting) */
  hppPerUnitCents: number;
  /** Per-unit HPP as Rupiah decimal string (for display only) */
  hppPerUnitStr: string;
}

/**
 * Calculate HPP total in integer cents.
 *
 * @param totalCost - Total cost of inventory purchases (Rupiah, e.g. 1000.00)
 * @param totalQty - Total quantity purchased (must be > 0)
 * @param qtySold - Quantity being sold (must be > 0 integer)
 * @returns HppCalculationResult with cents and string representations
 * @throws Error if inputs are invalid (totalQty <= 0, totalCost < 0, qtySold <= 0, NaN/Infinity)
 */
export function calculateHppCents(
  totalCost: number,
  totalQty: number,
  qtySold: number,
): HppCalculationResult {
  // ─── Input validation ───────────────────────────────────────────────
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    throw new Error(`totalCost tidak valid: ${totalCost}. Harus >= 0 dan finite.`);
  }
  if (!Number.isFinite(totalQty) || totalQty <= 0) {
    throw new Error(`totalQty tidak valid: ${totalQty}. Harus > 0 dan finite.`);
  }
  if (!Number.isFinite(qtySold) || qtySold <= 0 || !Number.isInteger(qtySold)) {
    throw new Error(`qtySold tidak valid: ${qtySold}. Harus integer > 0.`);
  }

  // ─── Convert to integer cents ───────────────────────────────────────
  const totalCostCents = Math.round(totalCost * 100);
  const totalQtyCents = Math.round(totalQty * 100); // for decimal qty support
  const qtySoldCents = Math.round(qtySold * 100);

  // ─── Calculate total HPP directly (ONE rounding) ────────────────────
  // hppTotalCents = Math.round((totalCostCents * qtySold) / totalQty)
  // This avoids per-unit rounding that compounds over qty.
  const hppTotalCents = Math.round((totalCostCents * qtySold) / totalQty);

  // ─── Per-unit for display only ──────────────────────────────────────
  const hppPerUnitCents = Math.round(totalCostCents / totalQty);

  // ─── Convert to Rupiah strings ──────────────────────────────────────
  const hppTotalStr = (hppTotalCents / 100).toFixed(2);
  const hppPerUnitStr = (hppPerUnitCents / 100).toFixed(2);

  return {
    hppTotalCents,
    hppTotalStr,
    hppPerUnitCents,
    hppPerUnitStr,
  };
}

/**
 * Validate that HPP > 0 for inventory items.
 * HPP = 0 is ONLY allowed for non-inventory items.
 *
 * @param hppTotalCents - Calculated HPP in cents
 * @param itemName - Item name for error message
 * @returns true if valid, throws if HPP <= 0
 */
export function validateHppNotZero(hppTotalCents: number, itemName: string): boolean {
  if (hppTotalCents <= 0) {
    throw new Error(
      `HPP untuk "${itemName}" bernilai nol atau negatif (${hppTotalCents} cents). ` +
      `Periksa data persediaan masuk. Jangan lanjutkan jurnal HPP otomatis.`
    );
  }
  return true;
}
