import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { createDatabase } from "../src/db/client.js";

const databaseUrl = process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgresql://postgres:postgres@localhost:5432/reserve_api_test";

const config: Config = {
  NODE_ENV: "test",  PORT: 3000,
  HOST: "127.0.0.1",
  DATABASE_URL: databaseUrl,
  JWT_SECRET: "segredo-de-testes-com-mais-de-16-caracteres"
};

describe("fluxo de reservas", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tokenAirton: string;
  let tokenSena: string;
  let estudioId: string;

  async function criarUsuario(nome: string) {
    const email = `${nome.toLowerCase()}-${crypto.randomUUID()}@example.com`;
    const response = await app.inject({
      method: "POST",
      url: "/usuarios",
      payload: { nome, email, senha: "reserva123" }
    });
    expect(response.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, senha: "reserva123" }
    });
    expect(login.statusCode).toBe(200);
    return login.json<{ token: string }>().token;
  }

  async function criarReserva(token = tokenAirton) {
    const response = await app.inject({
      method: "POST",
      url: `/estudios/${estudioId}/reservar`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }

  beforeAll(async () => {
    const migrationDatabase = createDatabase(config);
    await migrate(migrationDatabase.db, { migrationsFolder: "drizzle" });
    await migrationDatabase.db.execute(sql`
      truncate table idempotency_keys, reserva_eventos, reservas, estudios, usuarios cascade
    `);
    await migrationDatabase.pool.end();

    app = await buildApp({ config, logger: false });
    await app.ready();
    tokenAirton = await criarUsuario("Airton");
    tokenSena = await criarUsuario("Sena");

    const estudio = await app.inject({
      method: "POST",
      url: "/estudios",
      headers: { authorization: `Bearer ${tokenAirton}` },
      payload: {
        nome: "Studio Centro",
        bairro: "Centro",
        cidade: "São Paulo",
        valorDiaria: 199.9
      }
    });
    expect(estudio.statusCode).toBe(201);
    estudioId = estudio.json<{ id: string }>().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("reutiliza a resposta e gera apenas um evento com a mesma Idempotency-Key", async () => {
    const reservaId = await criarReserva();
    const key = crypto.randomUUID();
    const request = {
      method: "POST" as const,
      url: `/reservas/${reservaId}/confirmar`,
      headers: {
        authorization: `Bearer ${tokenAirton}`,
        "idempotency-key": key
      }
    };

    const first = await app.inject(request);
    const second = await app.inject(request);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());

    const history = await app.inject({
      method: "GET",
      url: `/reservas/${reservaId}/eventos`,
      headers: { authorization: `Bearer ${tokenAirton}` }
    });
    const confirmationEvents = history.json<Array<{ statusNovo: string }>>()
      .filter((event) => event.statusNovo === "confirmada");
    expect(confirmationEvents).toHaveLength(1);
  });

  it("serializa requisições simultâneas com a mesma chave", async () => {
    const reservaId = await criarReserva();
    const key = crypto.randomUUID();
    const request = {
      method: "POST" as const,
      url: `/reservas/${reservaId}/confirmar`,
      headers: {
        authorization: `Bearer ${tokenAirton}`,
        "idempotency-key": key
      }
    };

    const [first, second] = await Promise.all([app.inject(request), app.inject(request)]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
  });

  it("registra criação, confirmação e cancelamento em ordem", async () => {
    const reservaId = await criarReserva();
    const confirm = await app.inject({
      method: "POST",
      url: `/reservas/${reservaId}/confirmar`,
      headers: {
        authorization: `Bearer ${tokenAirton}`,
        "idempotency-key": crypto.randomUUID()
      }
    });
    expect(confirm.statusCode).toBe(200);

    const cancel = await app.inject({
      method: "POST",
      url: `/reservas/${reservaId}/cancelar`,
      headers: { authorization: `Bearer ${tokenAirton}` }
    });
    expect(cancel.statusCode).toBe(200);

    const history = await app.inject({
      method: "GET",
      url: `/reservas/${reservaId}/eventos`,
      headers: { authorization: `Bearer ${tokenAirton}` }
    });
    expect(history.json<Array<{ statusAnterior: string | null; statusNovo: string }>>().map((event) => ({
      de: event.statusAnterior,
      para: event.statusNovo
    }))).toEqual([
      { de: null, para: "pendente" },
      { de: "pendente", para: "confirmada" },
      { de: "confirmada", para: "cancelada" }
    ]);
  });

  it("recusa confirmar novamente com uma chave diferente", async () => {
    const reservaId = await criarReserva();
    const headers = { authorization: `Bearer ${tokenAirton}`, "idempotency-key": crypto.randomUUID() };
    expect((await app.inject({ method: "POST", url: `/reservas/${reservaId}/confirmar`, headers })).statusCode).toBe(200);

    const conflict = await app.inject({
      method: "POST",
      url: `/reservas/${reservaId}/confirmar`,
      headers: { ...headers, "idempotency-key": crypto.randomUUID() }
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("não expõe reservas de outro usuário", async () => {
    const reservaAirton = await criarReserva(tokenAirton);
    await criarReserva(tokenSena);

    const minhas = await app.inject({
      method: "GET",
      url: "/reservas/minhas",
      headers: { authorization: `Bearer ${tokenSena}` }
    });
    const ids = minhas.json<Array<{ id: string }>>().map((reserva) => reserva.id);
    expect(ids).not.toContain(reservaAirton);

    const history = await app.inject({
      method: "GET",
      url: `/reservas/${reservaAirton}/eventos`,
      headers: { authorization: `Bearer ${tokenSena}` }
    });
    expect(history.statusCode).toBe(404);
  });
});
