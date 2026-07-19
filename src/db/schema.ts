import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const statusReservaEnum = pgEnum("status_reserva", [
  "pendente",
  "confirmada",
  "cancelada"
]);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  senha: varchar("senha", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("usuarios_email_unique").on(table.email)]);

export const estudios = pgTable("estudios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  bairro: varchar("bairro", { length: 120 }).notNull(),
  cidade: varchar("cidade", { length: 120 }).notNull(),
  valorDiaria: numeric("valor_diaria", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const reservas = pgTable("reservas", {
  id: uuid("id").defaultRandom().primaryKey(),
  estudioId: uuid("estudio_id").notNull().references(() => estudios.id),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  status: statusReservaEnum("status").default("pendente").notNull(),
  criadaEm: timestamp("criada_em", { withTimezone: true }).defaultNow().notNull(),
  confirmadaEm: timestamp("confirmada_em", { withTimezone: true }),
  canceladaEm: timestamp("cancelada_em", { withTimezone: true })
}, (table) => [
  index("reservas_usuario_id_idx").on(table.usuarioId),
  index("reservas_estudio_id_idx").on(table.estudioId)
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  chave: varchar("chave", { length: 255 }).primaryKey(),
  rota: varchar("rota", { length: 255 }).notNull(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  respostaStatus: integer("resposta_status").notNull(),
  respostaBody: jsonb("resposta_body").notNull(),
  criadaEm: timestamp("criada_em", { withTimezone: true }).defaultNow().notNull()
});

export const reservaEventos = pgTable("reserva_eventos", {
  id: uuid("id").defaultRandom().primaryKey(),
  reservaId: uuid("reserva_id").notNull().references(() => reservas.id),
  statusAnterior: statusReservaEnum("status_anterior"),
  statusNovo: statusReservaEnum("status_novo").notNull(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  criadaEm: timestamp("criada_em", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata")
}, (table) => [index("reserva_eventos_reserva_id_idx").on(table.reservaId)]);

export type Usuario = typeof usuarios.$inferSelect;
export type Estudio = typeof estudios.$inferSelect;
export type Reserva = typeof reservas.$inferSelect;
