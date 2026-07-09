/**
 * USDC money helpers. USDC has 6 decimals; we keep amounts as bigint base units
 * to avoid float rounding in escrow accounting.
 */

import type { UsdcAmount } from "../cap/types.js";

const DECIMALS = 6n;
const SCALE = 10n ** DECIMALS;

/** Parse a decimal USDC string ("2.50") into base units (2_500000n). */
export function usdc(amount: string): UsdcAmount {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`invalid USDC amount: ${amount}`);
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > Number(DECIMALS)) {
    throw new Error(`USDC supports at most ${DECIMALS} decimals: ${amount}`);
  }
  const fracPadded = (frac + "0".repeat(Number(DECIMALS))).slice(0, Number(DECIMALS));
  return BigInt(whole) * SCALE + BigInt(fracPadded);
}

/** Format base units back to a human "12.34" string. */
export function formatUsdc(amount: UsdcAmount): string {
  const whole = amount / SCALE;
  const frac = amount % SCALE;
  const fracStr = frac.toString().padStart(Number(DECIMALS), "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
