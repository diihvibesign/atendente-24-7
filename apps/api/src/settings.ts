import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import {
  contactSchema,
  saveRoutingSchema,
  publishRoutingSchema,
} from "@atendente/contracts";
import { user, audit } from "./context.js";
import { transaction } from "./db.js";
import { ApiError } from "./errors.js";
export function settingsRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get("/api/v1/tenant/settings", async (request) => {
    const actor = user(request);
    return transaction(pool, actor.tenantId, async (db) => {
      const versions = await db.query(
        'SELECT version,configuration,published_at AS "publishedAt",created_at AS "createdAt" FROM routing_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1',
        [actor.tenantId],
      );
      const contacts = await db.query(
        "SELECT id,name,phone,(verified_at IS NOT NULL) AS verified FROM contacts WHERE tenant_id=$1 ORDER BY created_at",
        [actor.tenantId],
      );
      const tenant = await db.query(
        "SELECT published_version FROM tenants WHERE id=$1",
        [actor.tenantId],
      );
      return {
        latest: versions.rows[0] ?? null,
        publishedVersion: tenant.rows[0].published_version,
        contacts: contacts.rows,
      };
    });
  });
  app.post("/api/v1/tenant/contacts", async (request, reply) => {
    const actor = user(request);
    const data = contactSchema.parse(request.body);
    const result = await transaction(pool, actor.tenantId, async (db) => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO contacts(tenant_id,id,name,phone) VALUES($1,$2,$3,$4)",
        [actor.tenantId, id, data.name, data.phone],
      );
      await audit(db, actor, "contact.created", id);
      return { id, ...data, verified: false };
    });
    reply.code(201);
    return result;
  });
  app.patch("/api/v1/tenant/settings", async (request) => {
    const actor = user(request);
    const data = saveRoutingSchema.parse(request.body);
    return transaction(pool, actor.tenantId, async (db) => {
      await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        actor.tenantId,
      ]);
      const existing = await db.query(
        "SELECT coalesce(max(version),0)::int AS version FROM routing_versions WHERE tenant_id=$1",
        [actor.tenantId],
      );
      if (existing.rows[0].version !== data.expectedVersion)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "Outra pessoa alterou a configuração. Recarregue antes de salvar.",
        );
      if (data.configuration.contactId) {
        const contact = await db.query(
          "SELECT id FROM contacts WHERE tenant_id=$1 AND id=$2",
          [actor.tenantId, data.configuration.contactId],
        );
        if (!contact.rowCount)
          throw new ApiError(
            400,
            "CONTACT_INVALID",
            "Escolha um contato da sua funerária.",
          );
      }
      const version = data.expectedVersion + 1;
      await db.query(
        "INSERT INTO routing_versions(tenant_id,version,configuration,contact_id) VALUES($1,$2,$3,$4)",
        [
          actor.tenantId,
          version,
          data.configuration,
          data.configuration.contactId,
        ],
      );
      await audit(db, actor, "routing.saved");
      return { version };
    });
  });
  app.post("/api/v1/tenant/settings/publish", async (request) => {
    const actor = user(request);
    const data = publishRoutingSchema.parse(request.body);
    await transaction(pool, actor.tenantId, async (db) => {
      await db.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [
        actor.tenantId,
      ]);
      const result = await db.query(
        `SELECT r.version,c.verified_at FROM routing_versions r LEFT JOIN contacts c ON c.tenant_id=r.tenant_id AND c.id=r.contact_id WHERE r.tenant_id=$1 AND r.version=$2`,
        [actor.tenantId, data.version],
      );
      if (!result.rowCount)
        throw new ApiError(404, "NOT_FOUND", "Versão não encontrada.");
      if (!result.rows[0].verified_at)
        throw new ApiError(
          409,
          "CONTACT_UNVERIFIED",
          "Verifique o contato de plantão antes de publicar. A verificação por SMS ainda precisa ser conectada.",
        );
      await db.query(
        "UPDATE routing_versions SET published_at=coalesce(published_at,now()) WHERE tenant_id=$1 AND version=$2",
        [actor.tenantId, data.version],
      );
      await db.query("UPDATE tenants SET published_version=$1 WHERE id=$2", [
        data.version,
        actor.tenantId,
      ]);
      await audit(db, actor, "routing.published");
    });
    return { ok: true };
  });
}
