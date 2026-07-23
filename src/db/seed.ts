import { loadConfig } from "../config.js";
import { runSeed } from "./run-seed.js";

const config = loadConfig();

try {
  await runSeed(config);
  console.log("Seed concluído. Usuários: sena@example.com e airton@example.com; senha: reserva123");
} catch (error) {
  console.error("Falha ao executar seed:", error);
  process.exit(1);
}
