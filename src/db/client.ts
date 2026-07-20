import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import type { Config } from "../config.js";
import * as schema from "./schema.js";

function resolveSsl(config: Pick<Config, "DATABASE_URL" | "DATABASE_SSL">): PoolConfig["ssl"] {
  if (config.DATABASE_SSL === "false") return undefined;
  if (config.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (/sslmode=(require|verify-full|verify-ca|prefer)/i.test(config.DATABASE_URL)) {
    return { rejectUnauthorized: false };
  }
  if (/\.render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(config.DATABASE_URL)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function createDatabase(config: Pick<Config, "DATABASE_URL" | "DATABASE_SSL">) {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: resolveSsl(config)
  });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
