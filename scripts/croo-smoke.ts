/**
 * Live smoke test: hire ONE real third-party agent on the CROO store,
 * end to end, with real USDC. Run once after funding the wallet and
 * before recording the demo.
 *
 *   npx tsx scripts/croo-smoke.ts
 *   CROO_SMOKE_SERVICE_ID=<serviceId> npx tsx scripts/croo-smoke.ts
 *
 * Default target: "Crypto Fear & Greed Index" (0.05 USDC, informational).
 */
import { hireService } from "../server/src/croo.js";

const serviceId =
  process.env.CROO_SMOKE_SERVICE_ID ?? "738491a2-1220-4168-81fe-656d2ecf4f22";

const t0 = Date.now();
const result = await hireService({
  serviceId,
  requirements: JSON.stringify({
    note: "Smoke test from DreamWeave: return a minimal valid response.",
  }),
  timeoutMs: 5 * 60 * 1000,
});
console.log(`✅ hired ${serviceId} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`   order: ${result.orderId}`);
console.log(`   payTx: ${result.payTxHash ?? "(not surfaced)"}`);
console.log(`   delivery: ${result.deliverableText.slice(0, 400)}`);
process.exit(0);
