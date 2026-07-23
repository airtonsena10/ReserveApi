import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { estudios, idempotencyKeys, reservaEventos, reservas } from "../db/schema.js";
import { HttpError, parseOrThrow } from "../http.js";
import { apiErrors, authResponses } from "../openapi/responses.js";

const paramsSchema = z.object({ id: z.uuid() });
const idempotencyKeySchema = z.string().trim().min(1).max(255);

function metadata(request: FastifyRequest, idempotencyKey?: string) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null,
    ...(idempotencyKey ? { idempotencyKey } : {})
  };
}

export const reservaRoutes: FastifyPluginAsync<{ db: Database }> = async (app, { db }) => {
  app.post("/estudios/:id/reservar", {
    preHandler: app.authenticate,
    schema: {
      operationId: "criarReserva",
      tags: ["Reservas"],
      summary: "Cria uma reserva pendente",
      description: "Reserva o estúdio informado para o usuário autenticado com status inicial `pendente`.",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParam#" },
      response: authResponses({
        201: {
          description: "Reserva criada",
          $ref: "Reserva#"
        },
        404: apiErrors.notFound
      })
    }
  }, async (request, reply) => {
    const { id: estudioId } = parseOrThrow(paramsSchema, request.params);

    const reserva = await db.transaction(async (tx) => {
      const [estudio] = await tx.select({ id: estudios.id }).from(estudios)
        .where(eq(estudios.id, estudioId)).limit(1);
      if (!estudio) throw new HttpError(404, "Estúdio não encontrado", "NOT_FOUND");

      const [created] = await tx.insert(reservas).values({
        estudioId,
        usuarioId: request.user.sub
      }).returning();

      if (!created) throw new Error("Falha ao criar reserva");

      await tx.insert(reservaEventos).values({
        reservaId: created.id,
        statusAnterior: null,
        statusNovo: "pendente",
        usuarioId: request.user.sub,
        metadata: metadata(request)
      });

      return created;
    });

    return reply.status(201).send(reserva);
  });

  app.get("/reservas/minhas", {
    preHandler: app.authenticate,
    schema: {
      operationId: "listMinhasReservas",
      tags: ["Reservas"],
      summary: "Lista as reservas do usuário autenticado",
      description: "Retorna apenas reservas do usuário do token JWT, da mais recente para a mais antiga.",
      security: [{ bearerAuth: [] }],
      response: authResponses({
        200: {
          description: "Lista de reservas do usuário",
          type: "array",
          items: { $ref: "Reserva#" }
        }
      })
    }
  }, async (request) => {
    return db.select().from(reservas)
      .where(eq(reservas.usuarioId, request.user.sub))
      .orderBy(desc(reservas.criadaEm));
  });

  app.post("/reservas/:id/confirmar", {
    preHandler: app.authenticate,
    schema: {
      operationId: "confirmarReserva",
      tags: ["Reservas"],
      summary: "Confirma uma reserva de forma idempotente",
      description: [
        "Transiciona a reserva de `pendente` para `confirmada`.",
        "O header **Idempotency-Key** é obrigatório: requisições repetidas com a mesma chave",
        "retornam a mesma resposta sem duplicar efeitos."
      ].join(" "),
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParam#" },
      headers: { $ref: "IdempotencyKeyHeader#" },
      response: authResponses({
        200: {
          description: "Reserva confirmada (ou resposta reutilizada por idempotência)",
          $ref: "Reserva#"
        },
        404: apiErrors.notFound,
        409: {
          description: "Transição inválida ou Idempotency-Key reutilizada em outra operação",
          $ref: "ErrorResponse#"
        }
      })
    }
  }, async (request, reply) => {
    const { id: reservaId } = parseOrThrow(paramsSchema, request.params);
    const idempotencyKey = parseOrThrow(idempotencyKeySchema, request.headers["idempotency-key"]);
    const rota = `POST /reservas/${reservaId}/confirmar`;

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`);

      const [existing] = await tx.select().from(idempotencyKeys)
        .where(eq(idempotencyKeys.chave, idempotencyKey)).limit(1);

      if (existing) {
        if (existing.rota !== rota || existing.usuarioId !== request.user.sub) {
          throw new HttpError(409, "Idempotency-Key já usada em outra operação", "IDEMPOTENCY_KEY_REUSED");
        }
        return { status: existing.respostaStatus, body: existing.respostaBody };
      }

      const [updated] = await tx.update(reservas).set({
        status: "confirmada",
        confirmadaEm: new Date()
      }).where(and(
        eq(reservas.id, reservaId),
        eq(reservas.usuarioId, request.user.sub),
        eq(reservas.status, "pendente")
      )).returning();

      if (!updated) {
        const [current] = await tx.select().from(reservas).where(and(
          eq(reservas.id, reservaId),
          eq(reservas.usuarioId, request.user.sub)
        )).limit(1);
        if (!current) throw new HttpError(404, "Reserva não encontrada", "NOT_FOUND");
        throw new HttpError(409, "Reserva não está pendente", "INVALID_STATUS_TRANSITION");
      }

      await tx.insert(reservaEventos).values({
        reservaId,
        statusAnterior: "pendente",
        statusNovo: "confirmada",
        usuarioId: request.user.sub,
        metadata: metadata(request, idempotencyKey)
      });

      await tx.insert(idempotencyKeys).values({
        chave: idempotencyKey,
        rota,
        usuarioId: request.user.sub,
        respostaStatus: 200,
        respostaBody: updated
      });

      return { status: 200, body: updated };
    });

    return reply.status(result.status as 200).send(result.body);
  });

  app.post("/reservas/:id/cancelar", {
    preHandler: app.authenticate,
    schema: {
      operationId: "cancelarReserva",
      tags: ["Reservas"],
      summary: "Cancela uma reserva",
      description: "Transiciona a reserva para `cancelada`. Não é possível cancelar uma reserva já cancelada.",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParam#" },
      response: authResponses({
        200: {
          description: "Reserva cancelada",
          $ref: "Reserva#"
        },
        404: apiErrors.notFound,
        409: {
          description: "Reserva já está cancelada",
          $ref: "ErrorResponse#"
        }
      })
    }
  }, async (request) => {
    const { id: reservaId } = parseOrThrow(paramsSchema, request.params);

    return db.transaction(async (tx) => {
      const [current] = await tx.select().from(reservas).where(and(
        eq(reservas.id, reservaId),
        eq(reservas.usuarioId, request.user.sub)
      )).limit(1).for("update");

      if (!current) throw new HttpError(404, "Reserva não encontrada", "NOT_FOUND");
      if (current.status === "cancelada") {
        throw new HttpError(409, "Reserva já está cancelada", "INVALID_STATUS_TRANSITION");
      }

      const [updated] = await tx.update(reservas).set({
        status: "cancelada",
        canceladaEm: new Date()
      }).where(eq(reservas.id, reservaId)).returning();

      await tx.insert(reservaEventos).values({
        reservaId,
        statusAnterior: current.status,
        statusNovo: "cancelada",
        usuarioId: request.user.sub,
        metadata: metadata(request)
      });

      return updated;
    });
  });

  app.get("/reservas/:id/eventos", {
    preHandler: app.authenticate,
    schema: {
      operationId: "listReservaEventos",
      tags: ["Reservas"],
      summary: "Consulta o histórico de uma reserva",
      description: "Trilha de auditoria ordenada cronologicamente. Apenas o dono da reserva pode consultar.",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParam#" },
      response: authResponses({
        200: {
          description: "Eventos da reserva em ordem cronológica",
          type: "array",
          items: { $ref: "ReservaEvento#" }
        },
        404: apiErrors.notFound
      })
    }
  }, async (request) => {
    const { id: reservaId } = parseOrThrow(paramsSchema, request.params);
    const [owned] = await db.select({ id: reservas.id }).from(reservas).where(and(
      eq(reservas.id, reservaId),
      eq(reservas.usuarioId, request.user.sub)
    )).limit(1);
    if (!owned) throw new HttpError(404, "Reserva não encontrada", "NOT_FOUND");

    return db.select().from(reservaEventos)
      .where(eq(reservaEventos.reservaId, reservaId))
      .orderBy(asc(reservaEventos.criadaEm), asc(reservaEventos.id));
  });
};
