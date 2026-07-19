import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { HttpError, parseOrThrow } from "../http.js";

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  senha: z.string().min(6).max(100)
});

export const authRoutes: FastifyPluginAsync<{ db: Database }> = async (app, { db }) => {
  app.post("/login", {
    schema: {
      tags: ["Autenticação"],
      summary: "Autentica um usuário",
      body: {
        type: "object",
        required: ["email", "senha"],
        properties: {
          email: { type: "string", format: "email" },
          senha: { type: "string", minLength: 6 }
        }
      }
    }
  }, async (request) => {
    const input = parseOrThrow(loginSchema, request.body);
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, input.email)).limit(1);

    if (!usuario || !(await bcrypt.compare(input.senha, usuario.senha))) {
      throw new HttpError(401, "E-mail ou senha inválidos", "INVALID_CREDENTIALS");
    }

    const token = await app.jwt.sign({ sub: usuario.id, email: usuario.email }, { expiresIn: "1h" });
    return {
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    };
  });
};
