import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { runMigrations } from "./db/run-migrate.js";
import { runSeed } from "./db/run-seed.js";

const config = loadConfig();

if (config.NODE_ENV === "production") {
  await runMigrations(config);
  await runSeed(config);
}

const app = await buildApp({ config });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Encerrando servidor");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info("Servidor iniciado");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
