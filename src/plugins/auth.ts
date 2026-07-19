import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import type { Config } from "../config.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
}

export const authPlugin = fp<{ config: Config }>(async (app, options) => {
  await app.register(jwt, { secret: options.config.JWT_SECRET });

  app.decorate("authenticate", async (request: FastifyRequest) => {
    await request.jwtVerify();
  });
});
