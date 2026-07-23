const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID_2 = "550e8400-e29b-41d4-a716-446655440001";
const TIMESTAMP = "2026-07-19T12:00:00.000Z";

export const componentExamples: Record<string, unknown> = {
  ErrorResponse: { error: "VALIDATION_ERROR", message: "Dados inválidos" },
  HealthResponse: { status: "ok" },
  LoginRequest: { email: "airton@example.com", senha: "reserva123" },
  LoginResponse: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    usuario: {
      id: UUID,
      nome: "Airton",
      email: "airton@example.com"
    }
  },
  CreateUsuarioRequest: {
    nome: "Airton",
    email: "airton@example.com",
    senha: "reserva123"
  },
  UpdateUsuarioRequest: { nome: "Airton Silva" },
  UsuarioResumo: {
    id: UUID,
    nome: "Airton",
    email: "airton@example.com"
  },
  UsuarioPublico: {
    id: UUID,
    nome: "Airton",
    email: "airton@example.com",
    createdAt: TIMESTAMP
  },
  CreateEstudioRequest: {
    nome: "Studio Centro",
    bairro: "Centro",
    cidade: "São Paulo",
    valorDiaria: 199.9
  },
  UpdateEstudioRequest: { valorDiaria: 249.9 },
  Estudio: {
    id: UUID,
    nome: "Studio Vila Madalena",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
    valorDiaria: "249.90",
    createdAt: TIMESTAMP
  },
  Reserva: {
    id: UUID_2,
    estudioId: UUID,
    usuarioId: UUID,
    status: "pendente",
    criadaEm: TIMESTAMP,
    confirmadaEm: null,
    canceladaEm: null
  },
  ReservaEvento: {
    id: UUID_2,
    reservaId: UUID,
    statusAnterior: null,
    statusNovo: "pendente",
    usuarioId: UUID,
    criadaEm: TIMESTAMP,
    metadata: { ip: "127.0.0.1", userAgent: "Swagger UI" }
  },
  UuidParam: { id: UUID },
  IdempotencyKeyHeader: { "idempotency-key": UUID_2 }
};

export const componentExamplesAlt: Record<string, Record<string, unknown>> = {
  ErrorResponse: {
    notFound: { value: { error: "NOT_FOUND", message: "Recurso não encontrado" } },
    invalidCredentials: { value: { error: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos" } }
  }
};

type OperationExamples = {
  request?: unknown;
  requestHeaders?: Record<string, string>;
  responses?: Record<string, unknown>;
};

export const operationExamples: Record<string, OperationExamples> = {
  healthCheck: {
    responses: { "200": { status: "ok" } }
  },
  login: {
    request: componentExamples.LoginRequest,
    responses: { "200": componentExamples.LoginResponse, "401": { error: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos" } }
  },
  createUsuario: {
    request: componentExamples.CreateUsuarioRequest,
    responses: {
      "201": componentExamples.UsuarioPublico,
      "409": { error: "CONFLICT", message: "Recurso já existente" }
    }
  },
  getMe: {
    responses: { "200": componentExamples.UsuarioPublico }
  },
  updateMe: {
    request: componentExamples.UpdateUsuarioRequest,
    responses: { "200": componentExamples.UsuarioResumo }
  },
  listEstudios: {
    responses: { "200": [componentExamples.Estudio] }
  },
  getEstudio: {
    responses: { "200": componentExamples.Estudio, "404": { error: "NOT_FOUND", message: "Estúdio não encontrado" } }
  },
  createEstudio: {
    request: componentExamples.CreateEstudioRequest,
    responses: { "201": componentExamples.Estudio }
  },
  updateEstudio: {
    request: componentExamples.UpdateEstudioRequest,
    responses: { "200": componentExamples.Estudio }
  },
  criarReserva: {
    responses: { "201": componentExamples.Reserva, "404": { error: "NOT_FOUND", message: "Estúdio não encontrado" } }
  },
  listMinhasReservas: {
    responses: { "200": [componentExamples.Reserva] }
  },
  confirmarReserva: {
    requestHeaders: { "idempotency-key": UUID_2 },
    responses: {
      "200": { ...componentExamples.Reserva as object, status: "confirmada", confirmadaEm: TIMESTAMP },
      "409": { error: "INVALID_STATUS_TRANSITION", message: "Reserva não está pendente" }
    }
  },
  cancelarReserva: {
    responses: {
      "200": { ...componentExamples.Reserva as object, status: "cancelada", canceladaEm: TIMESTAMP },
      "409": { error: "INVALID_STATUS_TRANSITION", message: "Reserva já está cancelada" }
    }
  },
  listReservaEventos: {
    responses: {
      "200": [
        componentExamples.ReservaEvento,
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          reservaId: UUID,
          statusAnterior: "pendente",
          statusNovo: "confirmada",
          usuarioId: UUID,
          criadaEm: "2026-07-19T12:05:00.000Z",
          metadata: { idempotencyKey: UUID_2 }
        }
      ]
    }
  }
};

type OpenApiObject = {
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
  paths?: Record<string, Record<string, Record<string, unknown>>>;
};

function applyJsonExample(content: Record<string, unknown> | undefined, example: unknown) {
  if (!content?.["application/json"]) return;
  const media = content["application/json"] as Record<string, unknown>;
  media.example = example;
}

function applyRequestExample(operation: Record<string, unknown>, example: unknown) {
  const requestBody = operation.requestBody as { content?: Record<string, unknown> } | undefined;
  applyJsonExample(requestBody?.content, example);
}

function applyHeaderExamples(operation: Record<string, unknown>, headers: Record<string, string>) {
  const parameters = operation.parameters as Array<Record<string, unknown>> | undefined;
  if (!parameters) return;

  for (const param of parameters) {
    if (param.in !== "header") continue;
    const name = param.name as string;
    const value = headers[name.toLowerCase()] ?? headers[name];
    if (value !== undefined) param.example = value;
  }
}

function applyResponseExamples(operation: Record<string, unknown>, responses: Record<string, unknown>) {
  const operationResponses = operation.responses as Record<string, Record<string, unknown>> | undefined;
  if (!operationResponses) return;

  for (const [status, example] of Object.entries(responses)) {
    const response = operationResponses[status];
    if (!response) continue;
    applyJsonExample(response.content as Record<string, unknown> | undefined, example);
  }
}

export function enrichOpenApiWithExamples(openapiObject: Record<string, unknown>) {
  const components = openapiObject.components as OpenApiObject["components"];
  const schemas = components?.schemas;
  if (schemas) {
    for (const [name, schema] of Object.entries(schemas)) {
      const example = componentExamples[name];
      if (example !== undefined) schema.example = example;

      const alt = componentExamplesAlt[name];
      if (alt) schema.examples = alt;
    }
  }

  const paths = openapiObject.paths as OpenApiObject["paths"];
  if (paths) {
    for (const pathItem of Object.values(paths)) {
      for (const operation of Object.values(pathItem)) {
        if (!operation || typeof operation !== "object" || !("operationId" in operation)) continue;

        const samples = operationExamples[operation.operationId as string];
        if (!samples) continue;

        if (samples.request) applyRequestExample(operation, samples.request);
        if (samples.requestHeaders) applyHeaderExamples(operation, samples.requestHeaders);
        if (samples.responses) applyResponseExamples(operation, samples.responses);
      }
    }
  }

  return openapiObject;
}
