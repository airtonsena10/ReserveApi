import { loadConfig } from "../config.js";
import { runMigrations } from "./run-migrate.js";

const config = loadConfig();

function databaseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgresql:/, "http:")).hostname;
  } catch {
    return "desconhecido";
  }
}

console.log(`Aplicando migrations em ${databaseHost(config.DATABASE_URL)}...`);

try {
  await runMigrations(config);
  console.log("Migrations aplicadas com sucesso");
} catch (error) {
  console.error("Falha ao aplicar migrations:", error);
  process.exit(1);
}
