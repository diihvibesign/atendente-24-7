import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { idSchema, caseUpdateSchema } from "@atendente/contracts";
import { user, audit } from "./context.js";
import { transaction } from "./db.js";
import { ApiError } from "./errors.js";
const columns = `id,status,priority,caller,callback_phone AS "callbackPhone",deceased,location,need,created_at AS "createdAt",updated_at AS "updatedAt",configuration_version AS "configurationVersion",source,notification_status AS "notificationStatus",transfer_status AS "transferStatus"`;
const filters = z
  .object({
    status: z.enum(["open", "contacted", "closed"]).optional(),
    priority: z.enum(["normal", "urgent"]).optional(),
  })
  .strict();
export function caseRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get("/api/v1/cases", async (request) => {
    const actor = user(request);
    const query = filters.parse(request.query);
    return transaction(
      pool,
      actor.tenantId,
      async (db) =>
        (
          await db.query(
            `SELECT ${columns} FROM cases WHERE tenant_id=$1 AND ($2::text IS NULL OR status=$2) AND ($3::text IS NULL OR priority=$3) ORDER BY created_at DESC,id LIMIT 100`,
            [actor.tenantId, query.status ?? null, query.priority ?? null],
          )
        ).rows,
    );
  });
  app.get("/api/v1/cases/:id", async (request) => {
    const actor = user(request);
    const id = idSchema.parse((request.params as { id: string }).id);
    return transaction(pool, actor.tenantId, async (db) => {
      const result = await db.query(
        `SELECT ${columns} FROM cases WHERE tenant_id=$1 AND id=$2`,
        [actor.tenantId, id],
      );
      if (!result.rowCount)
        throw new ApiError(404, "NOT_FOUND", "Atendimento não encontrado.");
      const notes = await db.query(
        'SELECT id,text,created_at AS "createdAt" FROM case_notes WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at,id',
        [actor.tenantId, id],
      );
      return { ...result.rows[0], notes: notes.rows };
    });
  });
  app.patch("/api/v1/cases/:id", async (request) => {
    const actor = user(request);
    const id = idSchema.parse((request.params as { id: string }).id);
    const data = caseUpdateSchema.parse(request.body);
    await transaction(pool, actor.tenantId, async (db) => {
      const result = await db.query(
        "UPDATE cases SET status=$1,updated_at=now() WHERE tenant_id=$2 AND id=$3 RETURNING id",
        [data.status, actor.tenantId, id],
      );
      if (!result.rowCount)
        throw new ApiError(404, "NOT_FOUND", "Atendimento não encontrado.");
      if (data.note)
        await db.query(
          "INSERT INTO case_notes(tenant_id,id,case_id,actor_id,text) VALUES($1,$2,$3,$4,$5)",
          [actor.tenantId, randomUUID(), id, actor.id, data.note],
        );
      await audit(db, actor, "case.updated", id);
    });
    return { ok: true };
  });
}
