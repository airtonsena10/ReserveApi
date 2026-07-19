import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Config } from "../config.js";
import * as schema from "./schema.js";

export function createDatabase(config: Pick<Config, "DATABASE_URL">) {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
