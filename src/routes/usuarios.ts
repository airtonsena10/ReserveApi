import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { HttpError, parseOrThrow } from "../http.js";
import { apiErrors, authResponses, publicResponses } from "../openapi/responses.js";

const createSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  senha: z.string().min(6).max(100)
});

const updateSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  senha: z.string().min(6).max(100).optional()
}).refine((value) => Object.keys(value).length > 0);

export const usuarioRoutes: FastifyPluginAsync<{ db: Database }> = async (app, { db }) => {
  app.post("/", {
    schema: {
      operationId: "createUsuario",
      tags: ["Usuários"],
      summary: "Cria um usuário",
      description: "Cadastro público. E-mail deve ser único.",
      body: { $ref: "CreateUsuarioRequest#" },
      response: publicResponses({
        201: {
          description: "Usuário criado",
          $ref: "UsuarioPublico#"
        },
        409: {
          description: "E-mail já cadastrado",
          $ref: "ErrorResponse#"
        }
      })
    }
  }, async (request, reply) => {
    const input = parseOrThrow(createSchema, request.body);
    const [created] = await db.insert(usuarios).values({
      ...input,
      senha: await bcrypt.hash(input.senha, 12)
    }).returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      createdAt: usuarios.createdAt
    });

    return reply.status(201).send(created);
  });

  app.get("/me", {
    preHandler: app.authenticate,
    schema: {
      operationId: "getMe",
      tags: ["Usuários"],
      summary: "Consulta o usuário autenticado",
      security: [{ bearerAuth: [] }],
      response: authResponses({
        200: {
          description: "Perfil do usuário autenticado",
          $ref: "UsuarioPublico#"
        },
        404: apiErrors.notFound
      })
    }
  }, async (request) => {
    const [usuario] = await db.select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      createdAt: usuarios.createdAt
    }).from(usuarios).where(eq(usuarios.id, request.user.sub)).limit(1);

    if (!usuario) throw new HttpError(404, "Usuário não encontrado", "NOT_FOUND");
    return usuario;
  });

  app.patch("/me", {
    preHandler: app.authenticate,
    schema: {
      operationId: "updateMe",
      tags: ["Usuários"],
      summary: "Atualiza o usuário autenticado",
      security: [{ bearerAuth: [] }],
      body: { $ref: "UpdateUsuarioRequest#" },
      response: authResponses({
        200: {
          description: "Usuário atualizado",
          $ref: "UsuarioResumo#"
        },
        404: apiErrors.notFound
      })
    }
  }, async (request) => {
    const input = parseOrThrow(updateSchema, request.body);
    const values = {
      ...input,
      ...(input.senha ? { senha: await bcrypt.hash(input.senha, 12) } : {})
    };
    const [updated] = await db.update(usuarios).set(values).where(eq(usuarios.id, request.user.sub))
      .returning({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email });

    if (!updated) throw new HttpError(404, "Usuário não encontrado", "NOT_FOUND");
    return updated;
  });

  app.delete("/me", {
    preHandler: app.authenticate,
    schema: {
      operationId: "deleteMe",
      tags: ["Usuários"],
      summary: "Exclui o usuário autenticado",
      security: [{ bearerAuth: [] }],
      response: authResponses({
        204: {
          description: "Usuário excluído",
          type: "null"
        },
        404: apiErrors.notFound,
        409: {
          description: "Usuário possui reservas vinculadas",
          $ref: "ErrorResponse#"
        }
      })
    }
  }, async (request, reply) => {
    const [deleted] = await db.delete(usuarios).where(eq(usuarios.id, request.user.sub)).returning({ id: usuarios.id });
    if (!deleted) throw new HttpError(404, "Usuário não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });
};
