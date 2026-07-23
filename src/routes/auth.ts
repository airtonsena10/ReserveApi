import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { HttpError, parseOrThrow } from "../http.js";
import { publicResponses } from "../openapi/responses.js";

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  senha: z.string().min(6).max(100)
});

export const authRoutes: FastifyPluginAsync<{ db: Database }> = async (app, { db }) => {
  app.post("/login", {
    schema: {
      operationId: "login",
      tags: ["Autenticação"],
      summary: "Autentica um usuário",
      description: "Valida e-mail e senha e retorna JWT Bearer válido por 1 hora. Use o token no botão **Authorize** do Swagger UI.",
      body: { $ref: "LoginRequest#" },
      response: publicResponses({
        200: {
          description: "Login bem-sucedido",
          $ref: "LoginResponse#"
        },
        401: {
          description: "Credenciais inválidas",
          $ref: "ErrorResponse#"
        }
      })
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
