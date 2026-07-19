import type { FastifyReply } from "fastify";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, "Dados inválidos", "VALIDATION_ERROR");
  }
  return parsed.data;
}

export function sendHttpError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message
    });
  }

  const pgError = error as { code?: string };
  if (pgError.code === "23505") {
    return reply.status(409).send({
      error: "CONFLICT",
      message: "Recurso já existente"
    });
  }

  throw error;
}
