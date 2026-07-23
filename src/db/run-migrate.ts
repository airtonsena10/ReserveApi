import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Config } from "../config.js";
import { createDatabase } from "./client.js";

export async function runMigrations(config: Config) {
  const { db, pool } = createDatabase(config);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
