# DreamWeave — deploy

Two services: **API on Railway**, **web on Vercel**.

## 1. API → Railway

1. New Railway project → **Deploy from GitHub repo** → `martinvibes/dreamweave`.
2. Add the **PostgreSQL** plugin (Railway injects `DATABASE_URL` automatically).
3. Set environment variables (Service → Variables):

   ```
   LLM_BASE_URL=https://router-api.0g.ai/v1
   LLM_API_KEY=<your 0G key>
   LLM_MODEL=deepseek-v4-flash
   LLM_PLANNER_MODEL=glm-5.2
   LLM_TEE_PROOFS=1
   WEB_ORIGIN=https://<your-vercel-domain>
   PRIVY_APP_ID=cmrb1gi9b000r0cjly6tupaz7
   PRIVY_VERIFY=true
   # on-chain settlement (optional, once DreamVault is deployed):
   CHAIN_ID=84532
   BASE_RPC_URL=https://sepolia.base.org
   USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
   DREAMVAULT_ADDRESS=<deployed address>
   OPERATOR_PRIVATE_KEY=<operator key>
   SETTLE_ONCHAIN=1
   ```

   `railway.json` already sets `startCommand: npm start` and healthcheck `/health`.
4. Note the public URL, e.g. `https://dreamweave-api.up.railway.app`.

## 2. Web → Vercel

1. New Vercel project → import `martinvibes/dreamweave` → **Root Directory = `frontend`**.
2. Environment variables:

   ```
   VITE_PRIVY_APP_ID=cmrb1gi9b000r0cjly6tupaz7
   VITE_API_BASE=https://dreamweave-api.up.railway.app
   ```

3. `frontend/vercel.json` handles the SPA rewrite. Deploy.

## 3. Privy

In the Privy dashboard for app `cmrb1gi9b000r0cjly6tupaz7`, add both domains
(the Vercel domain and `http://localhost:5173`) to **Allowed origins**.

## 4. On-chain settlement (optional)

Deploy DreamVault to Base Sepolia (needs a funded deployer key — get free test
ETH from a Base Sepolia faucet):

```bash
forge create contracts/DreamVault.sol:DreamVault \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --constructor-args 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

Put the address in `DREAMVAULT_ADDRESS`, set `SETTLE_ONCHAIN=1`, redeploy the API.
