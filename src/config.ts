import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/reserve_api"),
  JWT_SECRET: z.string().min(16).default("a-string-secret-at-least-32-bits-long")
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return envSchema.parse({ ...process.env, ...overrides });
}
