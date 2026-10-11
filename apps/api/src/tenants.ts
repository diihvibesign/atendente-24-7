import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import {
  tenantSchema,
  tenantStateSchema,
  inviteSchema,
  idSchema,
} from "@atendente/contracts";
import { admin, user, audit } from "./context.js";
import { transaction } from "./db.js";
import { hashToken, opaqueToken } from "./security.js";
import { ApiError } from "./errors.js";

async function invite(
  db: pg.PoolClient,
  tenantId: string,
  name: string,
  email: string,
  origin: string,
) {
  const id = randomUUID();
  const token = opaqueToken();
  await db.query(
    "INSERT INTO users(id,tenant_id,name,email,role) VALUES($1,$2,$3,$4,'user')",
    [id, tenantId, name, email],
  );
  await db.query(
    "INSERT INTO access_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'invite',now()+interval '48 hours')",
    [hashToken(token), id],
  );
  return { id, activationUrl: `${origin}/ativar#token=${token}` };
}
export function tenantRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  origin: string,
) {
  app.get("/api/v1/admin/tenants", async (request) => {
    admin(request);
    return (
      await pool.query(
        `SELECT t.id,t.name,t.status,t.created_at AS "createdAt",t.published_version AS "publishedVersion",(SELECT count(*)::int FROM users u WHERE u.tenant_id=t.id AND u.active) AS "usersCount" FROM tenants t ORDER BY t.created_at DESC LIMIT 200`,
      )
    ).rows;
  });
  app.post("/api/v1/admin/tenants", async (request, reply) => {
    const actor = admin(request);
    const data = tenantSchema.parse(request.body);
    const result = await transaction(pool, null, async (db) => {
      const id = randomUUID();
      await db.query("INSERT INTO tenants(id,name) VALUES($1,$2)", [
        id,
        data.name,
      ]);
      const activation = await invite(
        db,
        id,
        data.contactName,
        data.email,
        origin,
      );
      await audit(db, actor, "tenant.created", id, id);
      return { id, activationUrl: activation.activationUrl };
    });
    reply.code(201);
    return result;
  });
  app.patch("/api/v1/admin/tenants/:id", async (request) => {
    const actor = admin(request);
    const id = idSchema.parse((request.params as { id: string }).id);
    const data = tenantStateSchema.parse(request.body);
    await transaction(pool, null, async (db) => {
      const result = await db.query(
        "UPDATE tenants SET status=$1 WHERE id=$2 RETURNING id",
        [data.status, id],
      );
      if (!result.rowCount)
        throw new ApiError(404, "NOT_FOUND", "Funerária não encontrada.");
      if (data.status === "inactive")
        await db.query(
          "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1)",
          [id],
        );
      await audit(db, actor, `tenant.${data.status}`, id, id);
    });
    return { ok: true };
  });
  app.get("/api/v1/team", async (request) => {
    const actor = user(request);
    return (
      await pool.query(
        "SELECT id,name,email,active,(password_hash IS NOT NULL) AS activated FROM users WHERE tenant_id=$1 ORDER BY created_at LIMIT 100",
        [actor.tenantId],
      )
    ).rows;
  });
  app.post("/api/v1/team/invites", async (request, reply) => {
    const actor = user(request);
    const data = inviteSchema.parse(request.body);
    const result = await transaction(pool, actor.tenantId, async (db) => {
      const activation = await invite(
        db,
        actor.tenantId,
        data.name,
        data.email,
        origin,
      );
      await audit(db, actor, "user.invited", activation.id);
      return activation;
    });
    reply.code(201);
    return result;
  });
  app.delete("/api/v1/team/:id", async (request) => {
    const actor = user(request);
    const id = idSchema.parse((request.params as { id: string }).id);
    if (id === actor.id)
      throw new ApiError(
        409,
        "SELF_REVOKE",
        "Peça a outra pessoa da equipe para revogar seu acesso.",
      );
    await transaction(pool, actor.tenantId, async (db) => {
      const result = await db.query(
        "UPDATE users SET active=false WHERE id=$1 AND tenant_id=$2 AND role='user' RETURNING id",
        [id, actor.tenantId],
      );
      if (!result.rowCount)
        throw new ApiError(404, "NOT_FOUND", "Usuário não encontrado.");
      await db.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await db.query(
        "UPDATE access_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
        [id],
      );
      await audit(db, actor, "user.revoked", id);
    });
    return { ok: true };
  });
}
