# DreamWeave — deploy

Two services: **API on Railway**, **web on Vercel**.

## 1. API → Railway

1. New Railway project → **Deploy from GitHub repo** → `martinvibes/dreamweave`.
2. Add the **PostgreSQL** plugin (Railway injects `DATABASE_URL` automatically).
3. Set environment variables (Service → Variables):

   Copy every `LLM_*` and `CROO_*` line from your local `.env` (0G keys, CROO
   SDK key + agent id, `CROO_VESSELS` JSON), plus:

   ```
   WEB_ORIGIN=https://<your-vercel-domain>
   PRIVY_APP_ID=cmrb1gi9b000r0cjly6tupaz7
   PRIVY_VERIFY=false   # guest identities; wallet login optional
   ```

   With `CROO_SDK_KEY` set the Weaver provider connects on boot and DreamWeave
   shows **Online** on the store 24/7. Postgres makes births, royalties, and
   proof roots survive restarts (pg-mem locally resets each run).

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

