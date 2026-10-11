import type { FastifyRequest } from "fastify";
import type { Actor } from "@atendente/contracts";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { ApiError } from "./errors.js";
declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
    csrfToken: string | null;
  }
}
export function user(request: FastifyRequest) {
  if (
    !request.actor ||
    request.actor.role !== "user" ||
    !request.actor.tenantId
  )
    throw new ApiError(403, "USER_REQUIRED", "Acesso exclusivo da funerária.");
  return request.actor as Actor & { tenantId: string };
}
export function admin(request: FastifyRequest) {
  if (!request.actor || request.actor.role !== "admin")
    throw new ApiError(
      403,
      "ADMIN_REQUIRED",
      "Acesso exclusivo da administração.",
    );
  return request.actor;
}
export async function audit(
  client: pg.PoolClient,
  actor: Actor,
  action: string,
  resourceId: string | null = null,
  tenantId = actor.tenantId,
) {
  await client.query(
    "INSERT INTO audit_events(id,actor_id,tenant_id,action,resource_id) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), actor.id, tenantId, action, resourceId],
  );
}
