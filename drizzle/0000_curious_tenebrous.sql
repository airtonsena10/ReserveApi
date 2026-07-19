CREATE TYPE "public"."status_reserva" AS ENUM('pendente', 'confirmada', 'cancelada');--> statement-breakpoint
CREATE TABLE "estudios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"bairro" varchar(120) NOT NULL,
	"cidade" varchar(120) NOT NULL,
	"valor_diaria" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"chave" varchar(255) PRIMARY KEY NOT NULL,
	"rota" varchar(255) NOT NULL,
	"usuario_id" uuid NOT NULL,
	"resposta_status" integer NOT NULL,
	"resposta_body" jsonb NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserva_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"status_anterior" "status_reserva",
	"status_novo" "status_reserva" NOT NULL,
	"usuario_id" uuid NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estudio_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"status" "status_reserva" DEFAULT 'pendente' NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmada_em" timestamp with time zone,
	"cancelada_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(160) NOT NULL,
	"senha" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_eventos" ADD CONSTRAINT "reserva_eventos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_eventos" ADD CONSTRAINT "reserva_eventos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_estudio_id_estudios_id_fk" FOREIGN KEY ("estudio_id") REFERENCES "public"."estudios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reserva_eventos_reserva_id_idx" ON "reserva_eventos" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "reservas_usuario_id_idx" ON "reservas" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "reservas_estudio_id_idx" ON "reservas" USING btree ("estudio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unique" ON "usuarios" USING btree ("email");