import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildApp } from "../apps/api/src/app.js";
import { createPool } from "../apps/api/src/db.js";

process.loadEnvFile(".env");
const url = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;
if (
  !url ||
  !ownerUrl ||
  !new URL(url).pathname.endsWith("_test") ||
  new URL(url).pathname !== new URL(ownerUrl).pathname
)
  throw new Error("Webhook exige banco descartável _test.");
const pool = createPool(url);
const owner = new pg.Client({ connectionString: ownerUrl });
const token = randomBytes(32).toString("hex");
const config = {
  origin: "http://localhost:3000",
  mfaKey: randomBytes(32).toString("hex"),
  production: false,
};
let app: Awaited<ReturnType<typeof buildApp>>;
let disabled: Awaited<ReturnType<typeof buildApp>>;
const makeEvent = () => ({
  id: `evt_${randomUUID()}`,
  event: "PAYMENT_CONFIRMED",
  dateCreated: "2026-10-11 12:00:00",
  payment: { id: "pay_synthetic", subscription: "sub_synthetic" },
});
function receive(payload: Record<string, unknown>, supplied = token) {
  return app.inject({
    method: "POST",
    url: "/webhooks/asaas/events",
    headers: { "asaas-access-token": supplied },
    payload,
  });
}
beforeAll(async () => {
  await owner.connect();
  const found = await owner.query(
    "SELECT to_regclass('public.billing_webhook_inbox') AS present",
  );
  if (!found.rows[0].present)
    await owner.query(
      await readFile("migrations/002_asaas_webhook_inbox.sql", "utf8"),
    );
  await owner.query("TRUNCATE billing_webhook_inbox");
  app = await buildApp(pool, {
    ...config,
    asaasWebhook: { enabled: true, token },
  });
  disabled = await buildApp(pool, config);
});
afterAll(async () => {
  if (app) await app.close();
  if (disabled) await disabled.close();
  await pool.end();
  await owner.end();
});
describe("Recebimento Asaas sandbox", () => {
  it("fica fechado por padrão e exige token próprio ao habilitar", async () => {
    expect(
      (
        await disabled.inject({
          method: "POST",
          url: "/webhooks/asaas/events",
          payload: makeEvent(),
        })
      ).statusCode,
    ).toBe(503);
    await expect(
      buildApp(pool, {
        ...config,
        asaasWebhook: { enabled: true, token: "weak" },
      }),
    ).rejects.toThrow("token próprio");
  });
  it("rejeita token ausente/incorreto antes de aceitar dados", async () => {
    for (const supplied of ["", "invalid", "x".repeat(257)])
      expect((await receive(makeEvent(), supplied)).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/asaas/events",
          headers: { "content-type": "application/json" },
          payload: "{invalid-json",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      Number(
        (await owner.query("SELECT count(*) FROM billing_webhook_inbox"))
          .rows[0].count,
      ),
    ).toBe(0);
  });
  it("persiste metadados antes do 200 sem dados de pagador, cartão ou tenant", async () => {
    const event = makeEvent();
    const response = await receive({
      ...event,
      tenantId: randomUUID(),
      externalReference: "tenant_do_navegador",
      payment: {
        ...event.payment,
        customer: "cus_synthetic",
        creditCard: { number: "SYNTHETIC_CARD", ccv: "SYNTHETIC_CCV" },
        customerName: "PAGADOR_SINTETICO",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    const row = (
      await owner.query(
        "SELECT * FROM billing_webhook_inbox WHERE event_id=$1",
        [event.id],
      )
    ).rows[0];
    expect(row).toMatchObject({
      provider: "asaas",
      environment: "sandbox",
      event_type: event.event,
      payment_id: event.payment.id,
      subscription_id: event.payment.subscription,
      state: "pending",
    });
    expect(JSON.stringify(row)).not.toMatch(
      /SYNTHETIC_CARD|SYNTHETIC_CCV|PAGADOR_SINTETICO|tenant_do_navegador|cus_synthetic/,
    );
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("deduplica reentrega concorrente sem criar novo registro", async () => {
    const event = makeEvent();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => receive(event)),
    );
    expect(responses.map((response) => response.statusCode)).toEqual(
      Array(8).fill(200),
    );
    expect(
      Number(
        (
          await owner.query(
            "SELECT count(*) FROM billing_webhook_inbox WHERE event_id=$1",
            [event.id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    expect(
      (await receive({ ...event, ignored: "campo novo" })).statusCode,
    ).toBe(200);
    expect(
      (
        await receive({
          ...event,
          payment: { ...event.payment, id: "pay_different" },
        })
      ).statusCode,
    ).toBe(409);
  });
  it("recusa envelope sem ID ou recurso, tipos fora do escopo e corpo excessivo", async () => {
    for (const event of [
      { ...makeEvent(), id: undefined },
      { ...makeEvent(), payment: undefined },
      { ...makeEvent(), event: "TRANSFER_DONE" },
    ])
      expect((await receive(event)).statusCode).toBe(400);
    expect(
      (await receive({ ...makeEvent(), ignored: "x".repeat(65536) }))
        .statusCode,
    ).toBe(413);
  });
  it("guarda eventos de assinatura e reentregas antigas sem confiar em ordem", async () => {
    const event = {
      id: `evt_${randomUUID()}`,
      event: "SUBSCRIPTION_DELETED",
      dateCreated: "2020-01-01 00:00:00",
      subscription: { id: "sub_synthetic" },
    };
    expect((await receive(event)).statusCode).toBe(200);
    const row = (
      await owner.query(
        "SELECT payment_id,subscription_id,state FROM billing_webhook_inbox WHERE event_id=$1",
        [event.id],
      )
    ).rows[0];
    expect(row).toEqual({
      payment_id: null,
      subscription_id: "sub_synthetic",
      state: "pending",
    });
    expect((await receive(event)).statusCode).toBe(200);
  });
  it("não confirma recebimento quando a gravação falha", async () => {
    await owner.query(
      `CREATE FUNCTION pg_temp.fail_webhook() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='evt_storage_failure' THEN RAISE EXCEPTION 'synthetic storage failure'; END IF; RETURN NEW; END $$`,
    );
    await owner.query(
      "CREATE TRIGGER fail_webhook BEFORE INSERT ON billing_webhook_inbox FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_webhook()",
    );
    try {
      expect(
        (await receive({ ...makeEvent(), id: "evt_storage_failure" }))
          .statusCode,
      ).toBe(500);
      expect(
        Number(
          (
            await owner.query(
              "SELECT count(*) FROM billing_webhook_inbox WHERE event_id='evt_storage_failure'",
            )
          ).rows[0].count,
        ),
      ).toBe(0);
    } finally {
      await owner.query("DROP TRIGGER fail_webhook ON billing_webhook_inbox");
    }
  });
  it("limita os grants da API a inserir e deduplicar eventos", async () => {
    await expect(
      pool.query("UPDATE billing_webhook_inbox SET state='processed'"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      pool.query("DELETE FROM billing_webhook_inbox"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      pool.query("SELECT payment_id FROM billing_webhook_inbox"),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await app.inject("/health")).json().billingWebhook).toBe(
      "sandbox_receiving_only",
    );
    expect((await disabled.inject("/health")).json().billingWebhook).toBe(
      "disabled",
    );
  });
});
