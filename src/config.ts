import "dotenv/config";
import { z } from "zod";

const DEFAULT_JWT_SECRET = "a-string-secret-at-least-32-bits-long";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/reserve_api"),
  JWT_SECRET: z.string().min(16).default(DEFAULT_JWT_SECRET),
  DATABASE_SSL: z.enum(["true", "false"]).optional(),
  PUBLIC_URL: z.string().optional()
});

export type Config = z.infer<typeof envSchema>;

function assertProductionConfig(config: Config): void {
  if (config.NODE_ENV !== "production") return;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL é obrigatória em produção. Vincule o Postgres ao serviço ou defina a variável."
    );
  }

  if (/localhost|127\.0\.0\.1/.test(config.DATABASE_URL)) {
    throw new Error(
      "DATABASE_URL aponta para localhost em produção. Use a URL interna do banco de dados."
    );
  }

  if (!process.env.JWT_SECRET || config.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error(
      "JWT_SECRET é obrigatório em produção. Use uma chave forte com pelo menos 16 caracteres."
    );
  }
}

export function resolvePublicUrl(config: Config): string | undefined {
  const fromConfig = config.PUBLIC_URL?.trim();
  if (fromConfig) {
    try {
      return new URL(fromConfig).origin;
    } catch {
      return undefined;
    }
  }

  const fromRender = process.env.RENDER_EXTERNAL_URL?.trim();
  return fromRender || undefined;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const config = envSchema.parse({ ...process.env, ...overrides });
  assertProductionConfig(config);
  return config;
}
