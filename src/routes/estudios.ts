import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { estudios } from "../db/schema.js";
import { HttpError, parseOrThrow } from "../http.js";

const paramsSchema = z.object({ id: z.uuid() });
const estudioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  bairro: z.string().trim().min(2).max(120),
  cidade: z.string().trim().min(2).max(120),
  valorDiaria: z.coerce.number().positive().max(99_999_999.99)
});
const updateSchema = estudioSchema.partial().refine((value) => Object.keys(value).length > 0);

export const estudioRoutes: FastifyPluginAsync<{ db: Database }> = async (app, { db }) => {
  app.get("/", {
    schema: { tags: ["Estúdios"], summary: "Lista estúdios" }
  }, async () => db.select().from(estudios).orderBy(estudios.createdAt));

  app.get("/:id", {
    schema: { tags: ["Estúdios"], summary: "Consulta um estúdio" }
  }, async (request) => {
    const { id } = parseOrThrow(paramsSchema, request.params);
    const [estudio] = await db.select().from(estudios).where(eq(estudios.id, id)).limit(1);
    if (!estudio) throw new HttpError(404, "Estúdio não encontrado", "NOT_FOUND");
    return estudio;
  });

  app.post("/", {
    preHandler: app.authenticate,
    schema: { tags: ["Estúdios"], summary: "Cria um estúdio", security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const input = parseOrThrow(estudioSchema, request.body);
    const [created] = await db.insert(estudios).values({
      ...input,
      valorDiaria: input.valorDiaria.toFixed(2)
    }).returning();
    return reply.status(201).send(created);
  });

  app.patch("/:id", {
    preHandler: app.authenticate,
    schema: { tags: ["Estúdios"], summary: "Atualiza um estúdio", security: [{ bearerAuth: [] }] }
  }, async (request) => {
    const { id } = parseOrThrow(paramsSchema, request.params);
    const input = parseOrThrow(updateSchema, request.body);
    const values = {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.bairro !== undefined ? { bairro: input.bairro } : {}),
      ...(input.cidade !== undefined ? { cidade: input.cidade } : {}),
      ...(input.valorDiaria !== undefined ? { valorDiaria: input.valorDiaria.toFixed(2) } : {})
    };
    const [updated] = await db.update(estudios).set(values).where(eq(estudios.id, id)).returning();
    if (!updated) throw new HttpError(404, "Estúdio não encontrado", "NOT_FOUND");
    return updated;
  });

  app.delete("/:id", {
    preHandler: app.authenticate,
    schema: { tags: ["Estúdios"], summary: "Exclui um estúdio", security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const { id } = parseOrThrow(paramsSchema, request.params);
    const [deleted] = await db.delete(estudios).where(eq(estudios.id, id)).returning({ id: estudios.id });
    if (!deleted) throw new HttpError(404, "Estúdio não encontrado", "NOT_FOUND");
    return reply.status(204).send();
  });
};
