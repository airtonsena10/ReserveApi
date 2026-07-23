import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { enrichOpenApiWithExamples } from "./examples.js";
import { registerOpenApiSchemas } from "./schemas.js";

type RegisterOpenApiOptions = {
  publicUrl?: string;
};

function buildServers(publicUrl?: string) {
  const servers = publicUrl
    ? [{ url: publicUrl.replace(/\/$/, ""), description: "Produção (Render)" }]
    : [];

  servers.push({ url: "http://localhost:3000", description: "Desenvolvimento local" });
  return servers;
}

export async function registerOpenApi(app: FastifyInstance, options: RegisterOpenApiOptions = {}) {
  registerOpenApiSchemas(app);

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Reserve API",
        version: "1.0.0",
        description: [
          "API de reservas de estúdios com **idempotência** e **trilha de auditoria**.",
          "",
          "### Versão",
          "Esta documentação descreve a **v1** da API. Rotas estáveis sem prefixo de versão no path;",
          "breaking changes futuros serão publicados como v2 com migração documentada.",
          "",
          "### Autenticação",
          "1. Crie um usuário em `POST /usuarios` ou use o seed (`airton@example.com` / `reserva123`).",
          "2. Faça login em `POST /auth/login` e copie o `token`.",
          "3. Clique em **Authorize** e informe `Bearer <token>`.",
          "",
          "### Erros",
          "Respostas de erro seguem `{ error: string, message: string }`.",
          "Códigos comuns: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404),",
          "`CONFLICT` / `INVALID_STATUS_TRANSITION` (409), `INTERNAL_ERROR` (500)."
        ].join("\n"),
        contact: {
          name: "Reserve API"
        }
      },
      externalDocs: {
        description: "Demo interativa",
        url: "/"
      },
      servers: buildServers(options.publicUrl),
      tags: [
        { name: "Infraestrutura", description: "Health check e disponibilidade" },
        { name: "Autenticação", description: "Login e emissão de JWT Bearer" },
        { name: "Usuários", description: "Cadastro e perfil do usuário autenticado" },
        { name: "Estúdios", description: "Catálogo e gestão de estúdios" },
        { name: "Reservas", description: "Reservas, confirmação idempotente e auditoria" }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token obtido em POST /auth/login. Informe no Swagger UI via **Authorize**."
          }
        }
      }
    },
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, i) {
        return (json.$id as string | undefined) ?? `def-${i}`;
      }
    },
    transformObject: (documentObject) => {
      if ("openapiObject" in documentObject) {
        return enrichOpenApiWithExamples(documentObject.openapiObject);
      }
      return documentObject.swaggerObject;
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      tryItOutEnabled: true
    },
    staticCSP: true
  });
}
