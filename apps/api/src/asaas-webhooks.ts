import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { ApiError } from "./errors.js";
import { transaction } from "./db.js";
import { equal, hashToken } from "./security.js";

export type AsaasWebhookConfig = { enabled: boolean; token?: string };
const resourceId = z.string().min(1).max(200);
const envelope = z
  .object({
    id: resourceId,
    event: z.string().regex(/^(PAYMENT|SUBSCRIPTION)_[A-Z0-9_]{1,80}$/),
    dateCreated: z.string().max(80).optional(),
    payment: z
      .object({ id: resourceId, subscription: resourceId.nullish() })
      .nullish(),
    subscription: z.object({ id: resourceId }).nullish(),
  })
  .refine(
    (event) =>
      event.event.startsWith("PAYMENT_")
        ? !!event.payment
        : !!event.subscription,
    { message: "Evento precisa identificar o recurso do provedor." },
  );

export function asaasWebhookRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  config?: AsaasWebhookConfig,
) {
  const enabled = config?.enabled === true;
  if (enabled && !/^[a-f0-9]{64}$/.test(config?.token ?? ""))
    throw new Error("Webhook Asaas exige token próprio de 32 bytes em hex.");
  const expectedHash = enabled ? hashToken(config!.token!) : null;
  app.post(
    "/webhooks/asaas/events",
    {
      bodyLimit: 65536,
      // Evitar o limite do painel para os bursts do provedor. Proteger o ingresso
      // público no host; autenticação abaixo ocorre antes de ler o corpo.
      config: { rateLimit: false },
      onRequest: async (request) => {
        if (!expectedHash)
          throw new ApiError(
            503,
            "WEBHOOK_DISABLED",
            "Recebimento de eventos ainda não habilitado.",
          );
        const supplied = request.headers["asaas-access-token"];
        if (
          typeof supplied !== "string" ||
          supplied.length > 256 ||
          !equal(hashToken(supplied), expectedHash)
        )
          throw new ApiError(401, "WEBHOOK_UNAUTHORIZED", "Token inválido.");
      },
    },
    async (request) => {
      const event = envelope.parse(request.body);
      // Não persistir corpo bruto, dados de cartão, pagador ou externalReference.
      // Não resolver tenant a partir de campos controlados pelo webhook.
      const normalized = {
        eventId: event.id,
        eventType: event.event,
        providerCreatedAt: event.dateCreated ?? null,
        paymentId: event.payment?.id ?? null,
        subscriptionId:
          event.payment?.subscription ?? event.subscription?.id ?? null,
      };
      const fingerprint = hashToken(JSON.stringify(normalized));
      await transaction(pool, null, async (db) => {
        const inserted = await db.query(
          `INSERT INTO billing_webhook_inbox(provider,environment,event_id,event_type,provider_created_at,payment_id,subscription_id,payload_hash)
           VALUES('asaas','sandbox',$1,$2,$3,$4,$5,$6)
           ON CONFLICT (provider,environment,event_id) DO NOTHING RETURNING event_id`,
          [
            normalized.eventId,
            normalized.eventType,
            normalized.providerCreatedAt,
            normalized.paymentId,
            normalized.subscriptionId,
            fingerprint,
          ],
        );
        if (!inserted.rowCount) {
          const previous = await db.query(
            "SELECT payload_hash FROM billing_webhook_inbox WHERE provider='asaas' AND environment='sandbox' AND event_id=$1",
            [normalized.eventId],
          );
          if (previous.rows[0]?.payload_hash !== fingerprint)
            throw new ApiError(
              409,
              "EVENT_CONFLICT",
              "Evento repetido com dados divergentes.",
            );
        }
      });
      // Confirmar somente depois do commit. Eventos ficam pendentes até o worker
      // de cobrança ser implementado; esta rota não altera planos/assinaturas.
      return { received: true };
    },
  );
}
