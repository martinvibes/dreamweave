/**
 * Database — one SQL dialect (Postgres) everywhere.
 *
 *   - Production (Railway): connects to DATABASE_URL (managed Postgres).
 *   - Local / CI: boots pg-mem, an in-process Postgres implemented in JS, so
 *     the EXACT SAME SQL runs with no server to install. pg-mem is a real SQL
 *     engine, not a hand-rolled fake — our repository code is identical in both
 *     modes. (Local data is in-memory and resets on restart; prod persists.)
 */

import { config } from "./config.js";

export interface Db {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  mode: "postgres" | "pg-mem";
}

let singleton: Db | null = null;

export async function getDb(): Promise<Db> {
  if (singleton) return singleton;
  singleton = config.databaseUrl ? await realPostgres() : await memPostgres();
  await migrate(singleton);
  return singleton;
}

async function realPostgres(): Promise<Db> {
  const pg = (await import("pg")).default;
  const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 8,
  });
  return {
    mode: "postgres",
    async query(text, params) {
      const r = await pool.query(text, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
  };
}

async function memPostgres(): Promise<Db> {
  const { newDb } = await import("pg-mem");
  const mem = newDb();
  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  return {
    mode: "pg-mem",
    async query(text, params) {
      const r = await pool.query(text, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
  };
}

/** Idempotent schema. Portable Postgres — no extensions required. */
async function migrate(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      wallet      TEXT,
      handle      TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      owner         TEXT NOT NULL,
      did           TEXT NOT NULL,
      name          TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      title         TEXT NOT NULL,
      price_usdc    BIGINT NOT NULL,
      tags          TEXT NOT NULL DEFAULT '[]',
      reputation    INT NOT NULL DEFAULT 50,
      runtime       TEXT NOT NULL DEFAULT 'platform',
      system_prompt TEXT,
      endpoint_url  TEXT,
      payout_address TEXT,
      jobs_done     INT NOT NULL DEFAULT 0,
      earned_usdc   BIGINT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dreams (
      id             TEXT PRIMARY KEY,
      owner          TEXT NOT NULL,
      goal           TEXT NOT NULL,
      budget_usdc    BIGINT NOT NULL,
      spent_usdc     BIGINT NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'planning',
      chain_dream_id BIGINT,
      tx_open        TEXT,
      tx_close       TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS threads (
      id             TEXT PRIMARY KEY,
      dream_id       TEXT NOT NULL,
      agent_id       TEXT NOT NULL,
      seller_name    TEXT NOT NULL,
      capability_id  TEXT NOT NULL,
      brief          TEXT NOT NULL,
      price_usdc     BIGINT NOT NULL,
      phase          TEXT NOT NULL DEFAULT 'planned',
      cap_order_id   TEXT,
      artifact       TEXT,
      proof_hash     TEXT,
      tee_proof      TEXT,
      settlement_ref TEXT,
      tx_hash        TEXT,
      idx            INT NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
