import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

const config = loadConfig();
const { db, pool } = createDatabase(config);

try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations aplicadas com sucesso");
} finally {
  await pool.end();
}
