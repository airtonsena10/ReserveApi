import type { FastifyInstance } from "fastify";

const statusReserva = {
  type: "string",
  enum: ["pendente", "confirmada", "cancelada"],
  description: "Status atual da reserva"
} as const;

export function registerOpenApiSchemas(app: FastifyInstance) {
  app.addSchema({
    $id: "ErrorResponse",
    type: "object",
    required: ["error", "message"],
    description: "Envelope padrão de erro da API",
    properties: {
      error: {
        type: "string",
        description: "Código estável do erro (ex.: VALIDATION_ERROR, NOT_FOUND)"
      },
      message: {
        type: "string",
        description: "Mensagem legível para o cliente"
      }
    }
  });

  app.addSchema({
    $id: "HealthResponse",
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["ok"] }
    }
  });

  app.addSchema({
    $id: "LoginRequest",
    type: "object",
    required: ["email", "senha"],
    properties: {
      email: { type: "string", format: "email" },
      senha: { type: "string", minLength: 6, maxLength: 100 }
    }
  });

  app.addSchema({
    $id: "LoginResponse",
    type: "object",
    required: ["token", "usuario"],
    properties: {
      token: {
        type: "string",
        description: "JWT Bearer — válido por 1 hora"
      },
      usuario: { $ref: "UsuarioResumo#" }
    }
  });

  app.addSchema({
    $id: "CreateUsuarioRequest",
    type: "object",
    required: ["nome", "email", "senha"],
    properties: {
      nome: { type: "string", minLength: 2, maxLength: 120 },
      email: { type: "string", format: "email" },
      senha: { type: "string", minLength: 6, maxLength: 100 }
    }
  });

  app.addSchema({
    $id: "UpdateUsuarioRequest",
    type: "object",
    minProperties: 1,
    properties: {
      nome: { type: "string", minLength: 2, maxLength: 120 },
      senha: { type: "string", minLength: 6, maxLength: 100 }
    }
  });

  app.addSchema({
    $id: "UsuarioResumo",
    type: "object",
    required: ["id", "nome", "email"],
    properties: {
      id: { type: "string", format: "uuid" },
      nome: { type: "string" },
      email: { type: "string", format: "email" }
    }
  });

  app.addSchema({
    $id: "UsuarioPublico",
    type: "object",
    required: ["id", "nome", "email", "createdAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      nome: { type: "string" },
      email: { type: "string", format: "email" },
      createdAt: { type: "string", format: "date-time" }
    }
  });

  app.addSchema({
    $id: "CreateEstudioRequest",
    type: "object",
    required: ["nome", "bairro", "cidade", "valorDiaria"],
    properties: {
      nome: { type: "string", minLength: 2, maxLength: 120 },
      bairro: { type: "string", minLength: 2, maxLength: 120 },
      cidade: { type: "string", minLength: 2, maxLength: 120 },
      valorDiaria: { type: "number", exclusiveMinimum: 0 }
    }
  });

  app.addSchema({
    $id: "UpdateEstudioRequest",
    type: "object",
    minProperties: 1,
    properties: {
      nome: { type: "string", minLength: 2, maxLength: 120 },
      bairro: { type: "string", minLength: 2, maxLength: 120 },
      cidade: { type: "string", minLength: 2, maxLength: 120 },
      valorDiaria: { type: "number", exclusiveMinimum: 0 }
    }
  });

  app.addSchema({
    $id: "Estudio",
    type: "object",
    required: ["id", "nome", "bairro", "cidade", "valorDiaria", "createdAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      nome: { type: "string" },
      bairro: { type: "string" },
      cidade: { type: "string" },
      valorDiaria: { type: "string", description: "Valor decimal com 2 casas" },
      createdAt: { type: "string", format: "date-time" }
    }
  });

  app.addSchema({
    $id: "Reserva",
    type: "object",
    required: ["id", "estudioId", "usuarioId", "status", "criadaEm"],
    properties: {
      id: { type: "string", format: "uuid" },
      estudioId: { type: "string", format: "uuid" },
      usuarioId: { type: "string", format: "uuid" },
      status: statusReserva,
      criadaEm: { type: "string", format: "date-time" },
      confirmadaEm: { type: ["string", "null"], format: "date-time" },
      canceladaEm: { type: ["string", "null"], format: "date-time" }
    }
  });

  app.addSchema({
    $id: "ReservaEvento",
    type: "object",
    required: ["id", "reservaId", "statusNovo", "usuarioId", "criadaEm"],
    properties: {
      id: { type: "string", format: "uuid" },
      reservaId: { type: "string", format: "uuid" },
      statusAnterior: {
        type: ["string", "null"],
        enum: ["pendente", "confirmada", "cancelada", null]
      },
      statusNovo: statusReserva,
      usuarioId: { type: "string", format: "uuid" },
      criadaEm: { type: "string", format: "date-time" },
      metadata: {
        type: ["object", "null"],
        additionalProperties: true,
        description: "Contexto da operação (IP, user-agent, idempotency-key)"
      }
    }
  });

  app.addSchema({
    $id: "UuidParam",
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Identificador UUID do recurso"
      }
    }
  });

  app.addSchema({
    $id: "IdempotencyKeyHeader",
    type: "object",
    required: ["idempotency-key"],
    properties: {
      "idempotency-key": {
        type: "string",
        minLength: 1,
        maxLength: 255,
        description: "Chave única por operação — requisições repetidas retornam a mesma resposta"
      }
    }
  });
}
