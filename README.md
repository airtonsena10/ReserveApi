# 📅 Reserve API

API REST de reservas de estúdios com **idempotência** na confirmação e **auditoria** completa de mudanças de status.

[![Deploy](https://img.shields.io/badge/🚀_Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://reserve-api-19z6.onrender.com/)
[![Swagger](https://img.shields.io/badge/📘_Swagger-OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://reserve-api-19z6.onrender.com/docs)


**[Demo ao vivo](https://reserve-api-19z6.onrender.com/)** · **[Documentação Swagger](https://reserve-api-19z6.onrender.com/docs)** · **[Health check](https://reserve-api-19z6.onrender.com/health)**

---

## 🎯 Problema que o projeto resolve

Imagine o seguinte cenário:

> Um cliente clica em **"Confirmar reserva"**. A internet trava por 2 segundos, sem resposta na tela. Ele clica de novo. Nos bastidores, o app também tenta reenviar automaticamente após o timeout.
>
> **Resultado sem proteção:** o servidor recebe 2 ou 3 requisições de confirmação para a mesma reserva. Se cada confirmação gera uma cobrança, um e-mail ou um evento de auditoria, o cliente é cobrado duas vezes e o histórico fica poluído — e ninguém sabe dizer, depois, quem confirmou o quê e quando.

Esse é um problema comum em qualquer API que expõe uma ação **não repetível** (pagamento, confirmação, envio). As duas causas raiz são:

| Causa | Consequência |
|-------|---------------|
| Requisição reenviada (timeout, retry, duplo clique) | Ação executada mais de uma vez |
| Falta de trilha de auditoria | Impossível saber quem/quando/o quê mudou o status |

## ✅ Solução proposta

O Reserve API resolve isso com duas garantias arquiteturais, aplicadas ao domínio de reservas de estúdios:

| Garantia | Como funciona | Onde ver no código |
|----------|----------------|----------------------|
| **Idempotência** | O cliente envia um header `Idempotency-Key` único por tentativa. A 1ª requisição executa e salva a resposta; as seguintes com a **mesma chave** recebem a resposta salva, sem repetir a ação | `src/routes/reservas.ts`, tabela `idempotency_keys` |
| **Auditoria** | Toda mudança de status (`pendente` → `confirmada`/`cancelada`) grava um evento com usuário, data e metadados | tabela `reserva_eventos` |

Na prática, isso significa:

- Confirmar a mesma reserva 10 vezes com a mesma chave → **1 única confirmação real**, 10 respostas idênticas
- Qualquer transição de status é rastreável: quem fez, quando, de onde (IP/user-agent)
- Requisições concorrentes com a mesma chave são serializadas por um **advisory lock** no PostgreSQL, evitando corrida entre duas confirmações simultâneas

Além disso, o projeto entrega a base completa para chegar nesse resultado:

- Autenticação JWT e CRUD de usuários
- Gestão de estúdios e reservas com fluxo `pendente → confirmada | cancelada`
- Documentação interativa com Swagger/OpenAPI
- Interface web de demonstração para ver a idempotência funcionando na prática

## Funcionalidades

- **Autenticação JWT** — login seguro com bcrypt
- **CRUD de estúdios** — listagem pública, gestão autenticada
- **Reservas** — criar, confirmar, cancelar e listar minhas reservas
- **Idempotência** — advisory lock + persistência de respostas
- **Auditoria** — histórico completo de transições de status
- **Demo UI** — teste visual de login, reservas e idempotência
- **Swagger** — explore e teste todos os endpoints

## 🖥️ Interface

### Demo web
![Demo](public/screenshots/demo.png)
*Interface para login, reservas, teste de idempotência e histórico de auditoria*

### Swagger / OpenAPI
![Swagger](public/screenshots/swagger.png)
*Documentação interativa com autenticação JWT e todos os endpoints*

## 🚀 Tecnologias Utilizadas

### Backend
- **Node.js 24** — runtime JavaScript
- **TypeScript** — tipagem estática
- **Fastify** — framework HTTP de alta performance
- **Drizzle ORM** — migrations e queries type-safe
- **PostgreSQL** — banco relacional
- **Zod** — validação de variáveis de ambiente e payloads
- **bcryptjs** — hash de senhas
- **JWT** — autenticação stateless

### DevOps & Qualidade
- **Docker** — containerização multi-stage
- **Vitest** — testes de integração
- **ESLint** — linting
- **GitHub Actions** — CI (lint + build + testes)
- **Render** — deploy em produção
- **Swagger UI** — documentação OpenAPI

## 📁 Estrutura do Projeto

```
src/
├── app.ts              # Montagem Fastify, rotas, Swagger, erros
├── server.ts           # Bootstrap do servidor
├── config.ts           # Variáveis de ambiente (Zod)
├── http.ts             # Erros HTTP padronizados
├── db/
│   ├── schema.ts       # Tabelas Drizzle
│   ├── client.ts       # Pool PostgreSQL + SSL
│   ├── migrate.ts      # Runner de migrations
│   └── seed.ts         # Dados iniciais
├── plugins/
│   └── auth.ts         # Plugin JWT
└── routes/
    ├── auth.ts         # POST /auth/login
    ├── usuarios.ts     # CRUD de usuários
    ├── estudios.ts     # CRUD de estúdios + reservar
    └── reservas.ts     # Confirmar, cancelar, eventos

public/
├── index.html          # Interface de demo
└── screenshots/        # Capturas para o README

drizzle/                # Migrations SQL
tests/                  # Testes de integração
```

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
cp .env.example .env
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
| `DATABASE_SSL` | Força SSL (`true`/`false`). Auto em hosts como Render | auto |
| `JWT_SECRET` | Segredo do JWT (mín. 16 caracteres) | valor de desenvolvimento |
| `PUBLIC_URL` | URL pública da API (Swagger). No Render, `RENDER_EXTERNAL_URL` é usada automaticamente | auto |
| `TEST_DATABASE_URL` | Banco usado nos testes | igual a `DATABASE_URL` |

Exemplo de `.env`:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reserve_api
JWT_SECRET=troque-esta-chave-em-producao-com-32-caracteres
```

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
curl -X POST https://reserve-api-19z6.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"airton@example.com","senha":"reserva123"}'

# 2. Reservar (substitua TOKEN e ESTUDIO_ID)
curl -X POST https://reserve-api-19z6.onrender.com/estudios/ESTUDIO_ID/reservar \
  -H "Authorization: Bearer TOKEN"

# 3. Confirmar com idempotência
curl -X POST https://reserve-api-19z6.onrender.com/reservas/RESERVA_ID/confirmar \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: $(uuidgen)"

# 4. Consultar auditoria
curl https://reserve-api-19z6.onrender.com/reservas/RESERVA_ID/eventos \
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
| `npm run db:seed:prod` | Seed via build de produção (Docker) |

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

## 🚀 Deploy

### Produção (Render)

[![Live Demo](https://img.shields.io/badge/Demo-reserve--api--19z6.onrender.com-46E3B7?style=flat-square&logo=render&logoColor=white)](https://reserve-api-19z6.onrender.com/)
[![Swagger](https://img.shields.io/badge/Docs-Swagger_UI-85EA2D?style=flat-square&logo=swagger&logoColor=black)](https://reserve-api-19z6.onrender.com/docs)

**Start command no Render:** `npm run start:prod` (aplica migrations, seed e sobe a API).

Usuários demo criados automaticamente no seed: `airton@example.com` / `sena@example.com` — senha `reserva123`.

## 🔒 Segurança

- **Autenticação JWT** obrigatória nas rotas protegidas
- **Hash bcrypt** para senhas
- **Validação Zod** no env e payloads
- **Idempotency-Key** evita confirmações duplicadas
- **SSL automático** para Postgres em hosts como Render
- **Validação de produção** — bloqueia `localhost` e secrets padrão

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'feat: minha feature'`)
4. Push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## 📝 Sobre este projeto

Projeto pessoal de estudo, construído explorando back-end (Node.js, Fastify, PostgreSQL) com foco em aplicar na prática conceitos como idempotência, auditoria e deploy em produção. Feedbacks e sugestões são bem-vindos.

---

Desenvolvido com ❤️ usando Fastify, Drizzle e PostgreSQL
