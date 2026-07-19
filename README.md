# Reserve API

API REST de reservas de estúdios com **idempotência** na confirmação e **auditoria** completa de mudanças de status. 

## Stack

- Node.js + TypeScript
- Fastify
- Drizzle ORM + PostgreSQL
- Zod (validação)
- Vitest (testes de integração)
- Docker + docker-compose
- Swagger/OpenAPI
- GitHub Actions (lint + build + testes)

## Diferenciais

### Idempotência

`POST /reservas/:id/confirmar` exige o header `Idempotency-Key`. A chave, a rota, o usuário, o status HTTP e o corpo da resposta ficam persistidos em `idempotency_keys`. Requisições repetidas com a mesma chave devolvem a resposta original, sem reprocessar a confirmação.

Um advisory lock transacional (`pg_advisory_xact_lock`) serializa requisições concorrentes com a mesma chave, evitando corrida entre duas confirmações simultâneas.

### Auditoria (event log)

Toda transição de status gera um registro em `reserva_eventos`:

- criação → `pendente`
- confirmação → `pendente` → `confirmada`
- cancelamento → `confirmada` ou `pendente` → `cancelada`

Cada evento registra quem fez a ação, quando ocorreu e metadados (IP, user-agent, idempotency key).

## Executar com Docker

```bash
docker compose up --build
```

| Recurso | URL |
|---------|-----|
| Interface de demo | http://localhost:3000/ |
| Swagger | http://localhost:3000/docs |
| Health check | http://localhost:3000/health |

O container aplica migrations e seed automaticamente na subida.

### Usuários do seed

| E-mail | Senha |
|--------|-------|
| `airton@example.com` | `reserva123` |
| `sena@example.com` | `reserva123` |

Também são criados 3 estúdios de exemplo (São Paulo, Belo Horizonte e Curitiba).

## Executar localmente

Requisitos: Node.js 24+ e PostgreSQL.

```bash
npm install
cp .env.example .env   # ou crie o .env manualmente
npm run db:migrate
npm run db:seed
npm run dev
```

### Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NODE_ENV` | Ambiente (`development`, `test`, `production`) | `development` |
| `PORT` | Porta da API | `3000` |
| `HOST` | Host de bind | `0.0.0.0` |
| `DATABASE_URL` | Connection string do PostgreSQL | `postgresql://postgres:postgres@localhost:5432/reserve_api` |
| `JWT_SECRET` | Segredo do JWT (mín. 16 caracteres) | valor de desenvolvimento |
| `TEST_DATABASE_URL` | Banco usado nos testes | igual a `DATABASE_URL` |

Exemplo de `.env`:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reserve_api
JWT_SECRET=troque-esta-chave-em-producao-com-32-caracteres
```

## Interface web

Acesse http://localhost:3000/ para:

- fazer login
- listar estúdios e criar reservas
- confirmar e cancelar reservas
- testar idempotência (botão "Confirmar 2x")
- visualizar o histórico de auditoria
- inspecionar a última resposta da API

## Endpoints

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| `POST` | `/auth/login` | Autentica e retorna JWT | — |
| `POST` | `/usuarios` | Cria usuário | — |
| `GET` | `/usuarios/me` | Consulta usuário logado | JWT |
| `PATCH` | `/usuarios/me` | Atualiza usuário logado | JWT |
| `DELETE` | `/usuarios/me` | Remove usuário logado | JWT |
| `GET` | `/estudios` | Lista estúdios | — |
| `GET` | `/estudios/:id` | Consulta um estúdio | — |
| `POST` | `/estudios` | Cria estúdio | JWT |
| `PATCH` | `/estudios/:id` | Atualiza estúdio | JWT |
| `DELETE` | `/estudios/:id` | Remove estúdio | JWT |
| `POST` | `/estudios/:id/reservar` | Cria reserva `pendente` | JWT |
| `GET` | `/reservas/minhas` | Lista reservas do usuário | JWT |
| `POST` | `/reservas/:id/confirmar` | Confirma reserva (idempotente) | JWT + `Idempotency-Key` |
| `POST` | `/reservas/:id/cancelar` | Cancela reserva | JWT |
| `GET` | `/reservas/:id/eventos` | Histórico de auditoria | JWT |
| `GET` | `/health` | Health check | — |

## Fluxo de uso

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"airton@example.com","senha":"reserva123"}'

# 2. Reservar (substitua TOKEN e ESTUDIO_ID)
curl -X POST http://localhost:3000/estudios/ESTUDIO_ID/reservar \
  -H "Authorization: Bearer TOKEN"

# 3. Confirmar com idempotência
curl -X POST http://localhost:3000/reservas/RESERVA_ID/confirmar \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: $(uuidgen)"

# 4. Consultar auditoria
curl http://localhost:3000/reservas/RESERVA_ID/eventos \
  -H "Authorization: Bearer TOKEN"
```

Repetir a confirmação com a **mesma** `Idempotency-Key` retorna a resposta original. Usar a chave em outra reserva ou outro usuário retorna `409 Conflict`.

## Modelo de dados

```
usuarios ──┬── reservas ──── reserva_eventos
           │       │
           │       └── estudios
           └── idempotency_keys
```

Estados de reserva: `pendente` → `confirmada` | `cancelada`.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor com hot reload |
| `npm run build` | Compila TypeScript |
| `npm start` | Inicia build de produção |
| `npm test` | Testes de integração |
| `npm run lint` | ESLint |
| `npm run db:generate` | Gera migration a partir do schema |
| `npm run db:migrate` | Aplica migrations |
| `npm run db:seed` | Popula usuários e estúdios |

## Testes

Os testes são de integração e usam PostgreSQL real:

```bash
createdb reserve_api_test   # se necessário
npm test
```

A suíte cobre:

- idempotência sequencial e simultânea
- unicidade do evento de confirmação
- ordem correta da auditoria
- regras de transição de status
- isolamento de reservas entre usuários

## CI

O workflow em `.github/workflows/ci.yml` executa lint, build e testes a cada push/PR, com PostgreSQL como serviço.

## Deploy

Use o `Dockerfile` incluído. Configure `DATABASE_URL` e um `JWT_SECRET` forte. Em produção, execute `npm run db:migrate:prod` antes de subir a aplicação.

