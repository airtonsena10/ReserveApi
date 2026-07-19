import fastifyStatic from "@fastify/static";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import path from "node:path";
import type { Config } from "./config.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";
import { HttpError } from "./http.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { estudioRoutes } from "./routes/estudios.js";
import { reservaRoutes } from "./routes/reservas.js";
import { usuarioRoutes } from "./routes/usuarios.js";

type BuildAppOptions = {
  config?: Config;
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const { db, pool } = createDatabase(config);
  const app = Fastify({ logger: options.logger ?? config.NODE_ENV !== "test" });

  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Reserve API",
        description: "API de reservas com idempotência e trilha de auditoria",
        version: "1.0.0"
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
        }
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(authPlugin, { config });

  await app.register(authRoutes, { prefix: "/auth", db });
  await app.register(usuarioRoutes, { prefix: "/usuarios", db });
  await app.register(estudioRoutes, { prefix: "/estudios", db });
  await app.register(reservaRoutes, { db });

  app.get("/health", {
    schema: { tags: ["Infraestrutura"], summary: "Verifica a saúde da API" }
  }, async () => {
    await db.execute("select 1");
    return { status: "ok" };
  });

  const publicDir = path.join(process.cwd(), "public");
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/"
  });

  app.get("/", async (_request, reply) => reply.sendFile("index.html"));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }

    const knownError = error as { code?: string; statusCode?: number; validation?: unknown };
    if (knownError.validation) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", message: "Dados inválidos" });
    }
    if (knownError.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" || knownError.statusCode === 401) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Autenticação necessária" });
    }
    if (knownError.code === "23505") {
      return reply.status(409).send({ error: "CONFLICT", message: "Recurso já existente" });
    }
    if (knownError.code === "23503") {
      return reply.status(409).send({ error: "RESOURCE_IN_USE", message: "Recurso está em uso" });
    }

    request.log.error(error);
    return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Erro interno do servidor" });
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return app;
}
