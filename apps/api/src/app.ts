import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type pg from "pg";
import { ZodError } from "zod";
import { authRoutes, type ApiConfig } from "./auth.js";
import { ApiError } from "./errors.js";
import { tenantRoutes } from "./tenants.js";
import { settingsRoutes } from "./settings.js";
import { caseRoutes } from "./cases.js";
import {
  asaasWebhookRoutes,
  type AsaasWebhookConfig,
} from "./asaas-webhooks.js";
export async function buildApp(
  pool: pg.Pool,
  config: ApiConfig & { asaasWebhook?: AsaasWebhookConfig },
) {
  const role = await pool.query(
    "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
  );
  if (!role.rowCount || role.rows[0].rolsuper || role.rows[0].rolbypassrls)
    throw new Error("API exige conexão sem superuser e sem bypass de RLS.");
  const app = Fastify({
    logger: { level: "info", redact: ["req", "res", "err", "body", "headers"] },
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 16384,
    trustProxy: ["127.0.0.1", "::1"],
  });
  await app.register(cookie);
  await app.register(helmet, { hsts: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({ code: "INVALID_INPUT", message: "Revise os campos enviados." });
    if (error instanceof ApiError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    if ((error as { code?: string }).code === "23505")
      return reply
        .code(409)
        .send({ code: "CONFLICT", message: "Este cadastro já existe." });
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    )
      return reply.code(error.statusCode).send({
        code: "REQUEST_REJECTED",
        message:
          error.statusCode === 429
            ? "Muitas tentativas. Aguarde antes de tentar novamente."
            : "Solicitação inválida.",
      });
    app.log.error({ requestId: request.id, event: "request.failed" });
    return reply.code(500).send({
      code: "INTERNAL_ERROR",
      message: "Não foi possível concluir. Tente novamente.",
    });
  });
  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return {
      status: "ok",
      phase: "foundation",
      telephony: "not_connected",
      billingWebhook: config.asaasWebhook?.enabled
        ? "sandbox_receiving_only"
        : "disabled",
    };
  });
  await authRoutes(app, pool, config);
  tenantRoutes(app, pool, config.origin);
  settingsRoutes(app, pool);
  caseRoutes(app, pool);
  asaasWebhookRoutes(app, pool, config.asaasWebhook);
  return app;
}
