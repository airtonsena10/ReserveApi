import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

const config = loadConfig();
const { db, pool } = createDatabase(config);

function databaseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "desconhecido";
  }
}

console.log(`Aplicando migrations em ${databaseHost(config.DATABASE_URL)}...`);

try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations aplicadas com sucesso");
} catch (error) {
  console.error("Falha ao aplicar migrations:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

if (process.exitCode) process.exit(process.exitCode);
