import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { acceptInviteSchema, loginSchema } from "@atendente/contracts";
import { ApiError } from "./errors.js";
import { transaction } from "./db.js";
import {
  decryptMfa,
  equal,
  hashPassword,
  hashToken,
  opaqueToken,
  totp,
  verifyPassword,
} from "./security.js";

export type ApiConfig = { origin: string; mfaKey: string; production: boolean };
export async function authRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  config: ApiConfig,
) {
  const cookieName = config.production
    ? "__Host-atendente_session"
    : "atendente_session";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: config.production,
    sameSite: "strict" as const,
  };
  const dummyHash = await hashPassword(opaqueToken());
  app.decorateRequest("actor", null);
  app.decorateRequest("csrfToken", null);
  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/api/")) return;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin !== config.origin
    )
      throw new ApiError(
        403,
        "ORIGIN_REJECTED",
        "Origem da solicitação inválida.",
      );
    const path = request.url.split("?")[0];
    if (path === "/api/v1/auth/login" || path === "/api/v1/auth/activate")
      return;
    const token = request.cookies[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new ApiError(401, "SESSION_REQUIRED", "Entre para continuar.");
    const result = await pool.query(
      `SELECT u.id,u.name,u.email,u.role,u.tenant_id AS "tenantId",t.name AS "tenantName",s.csrf_token AS "csrfToken"
      FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN tenants t ON t.id=u.tenant_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND (u.role='admin' OR t.status='active')`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row)
      throw new ApiError(
        401,
        "SESSION_EXPIRED",
        "Sua sessão expirou. Entre novamente.",
      );
    const { csrfToken, ...actor } = row;
    request.actor = actor;
    request.csrfToken = csrfToken;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const supplied = request.headers["x-csrf-token"];
      if (typeof supplied !== "string" || !equal(supplied, csrfToken))
        throw new ApiError(
          403,
          "CSRF_REJECTED",
          "Atualize a página e tente novamente.",
        );
    }
  });
  app.post(
    "/api/v1/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const data = loginSchema.parse(request.body);
      const result = await transaction(pool, null, async (db) => {
        const found = await db.query(
          `SELECT u.*, t.name AS tenant_name,t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id WHERE u.email=$1 FOR UPDATE OF u`,
          [data.email],
        );
        const record = found.rows[0];
        const correct = await verifyPassword(
          data.password,
          record?.password_hash ?? dummyHash,
        );
        if (
          !record ||
          !correct ||
          !record.active ||
          (record.role === "user" && record.tenant_status !== "active")
        )
          throw new ApiError(
            401,
            "INVALID_CREDENTIALS",
            "E-mail, senha ou código inválido.",
          );
        if (!record.password_hash.startsWith("scrypt:131072:"))
          await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
            await hashPassword(data.password),
            record.id,
          ]);
        if (record.role === "admin") {
          const verifier = totp(
            decryptMfa(record.mfa_secret, config.mfaKey),
            record.email,
          );
          const delta = data.otp
            ? verifier.validate({ token: data.otp, window: 1 })
            : null;
          const step = Math.floor(Date.now() / 30000) + (delta ?? 0);
          if (
            delta === null ||
            (record.last_totp_step !== null &&
              step <= Number(record.last_totp_step))
          )
            throw new ApiError(
              401,
              "INVALID_CREDENTIALS",
              "E-mail, senha ou código inválido.",
            );
          await db.query("UPDATE users SET last_totp_step=$1 WHERE id=$2", [
            step,
            record.id,
          ]);
        }
        const token = opaqueToken();
        const csrfToken = opaqueToken();
        const ttl = record.role === "admin" ? 3600 : 28800;
        await db.query("DELETE FROM sessions WHERE expires_at<now()");
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+$4*interval '1 second')",
          [hashToken(token), record.id, csrfToken, ttl],
        );
        await db.query(
          "INSERT INTO audit_events(id,actor_id,tenant_id,action) VALUES($1,$2,$3,$4)",
          [randomUUID(), record.id, record.tenant_id, "auth.login"],
        );
        return {
          token,
          ttl,
          csrfToken,
          user: {
            id: record.id,
            name: record.name,
            email: record.email,
            role: record.role,
            tenantId: record.tenant_id,
            tenantName: record.tenant_name ?? null,
          },
        };
      });
      reply.setCookie(cookieName, result.token, {
        ...cookieOptions,
        maxAge: result.ttl,
      });
      return { user: result.user, csrfToken: result.csrfToken };
    },
  );
  app.get("/api/v1/auth/me", async (request) => ({
    user: request.actor,
    csrfToken: request.csrfToken,
  }));
  app.post("/api/v1/auth/logout", async (request, reply) => {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      hashToken(request.cookies[cookieName]!),
    ]);
    reply.clearCookie(cookieName, cookieOptions);
    return { ok: true };
  });
  app.post(
    "/api/v1/auth/activate",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request) => {
      const data = acceptInviteSchema.parse(request.body);
      const password = await hashPassword(data.password);
      await transaction(pool, null, async (db) => {
        const result = await db.query(
          `SELECT a.*,u.active FROM access_tokens a JOIN users u ON u.id=a.user_id WHERE a.token_hash=$1 AND a.consumed_at IS NULL AND a.expires_at>now() FOR UPDATE OF a,u`,
          [hashToken(data.token)],
        );
        const record = result.rows[0];
        if (!record || !record.active)
          throw new ApiError(
            400,
            "TOKEN_INVALID",
            "Este link expirou ou já foi utilizado. Solicite outro à administração.",
          );
        await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          password,
          record.user_id,
        ]);
        await db.query(
          "UPDATE access_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
          [record.user_id],
        );
        await db.query("DELETE FROM sessions WHERE user_id=$1", [
          record.user_id,
        ]);
        await db.query(
          "INSERT INTO audit_events(id,actor_id,action) VALUES($1,$2,$3)",
          [randomUUID(), record.user_id, "auth.password_set"],
        );
      });
      return { ok: true };
    },
  );
}
