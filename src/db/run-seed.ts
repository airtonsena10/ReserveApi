import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import type { Config } from "../config.js";
import { createDatabase } from "./client.js";
import { estudios, usuarios } from "./schema.js";

export async function runSeed(config: Config) {
  const { db, pool } = createDatabase(config);

  try {
    const senha = await bcrypt.hash("reserva123", 12);

    await db.insert(usuarios).values([
      { nome: "Sena", email: "sena@example.com", senha },
      { nome: "Airton", email: "airton@example.com", senha }
    ]).onConflictDoNothing({ target: usuarios.email });

    const [resultado] = await db.select({ total: count() }).from(estudios);
    if (resultado?.total === 0) {
      await db.insert(estudios).values([
        { nome: "Studio Vila Madalena", bairro: "Vila Madalena", cidade: "São Paulo", valorDiaria: "249.90" },
        { nome: "Studio Savassi", bairro: "Savassi", cidade: "Belo Horizonte", valorDiaria: "189.00" },
        { nome: "Studio Batel", bairro: "Batel", cidade: "Curitiba", valorDiaria: "219.50" }
      ]);
    }
  } finally {
    await pool.end();
  }
}
