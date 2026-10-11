import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildApp } from "../apps/api/src/app.js";
import { createPool, transaction } from "../apps/api/src/db.js";
import {
  hashPassword,
  newMfa,
  encryptMfa,
  totp,
  hashToken,
  opaqueToken,
} from "../apps/api/src/security.js";
import {
  defaultRouting,
  type Session,
} from "../packages/contracts/src/index.js";
process.loadEnvFile(".env");
const url = process.env.TEST_DATABASE_URL;
const ownerUrl = process.env.TEST_MIGRATION_DATABASE_URL;
if (
  !url ||
  !ownerUrl ||
  !new URL(url).pathname.endsWith("_test") ||
  new URL(url).pathname !== new URL(ownerUrl).pathname
)
  throw new Error(
    "Configure banco descartável _test em TEST_DATABASE_URL / TEST_MIGRATION_DATABASE_URL.",
  );
const pool = createPool(url);
const owner = new pg.Client({ connectionString: ownerUrl });
const origin = "http://localhost:3000";
const key = randomBytes(32).toString("hex");
const ids = {
  a: randomUUID(),
  b: randomUUID(),
  ua: randomUUID(),
  ub: randomUUID(),
  admin: randomUUID(),
  ca: randomUUID(),
  cb: randomUUID(),
  contactA: randomUUID(),
  contactB: randomUUID(),
};
const password = opaqueToken();
const mfa = newMfa("admin@example.test");
let app: Awaited<ReturnType<typeof buildApp>>;
let a: { cookie: string; session: Session };
let b: { cookie: string; session: Session };
let adm: { cookie: string; session: Session };
async function login(email: string, otp?: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin },
    payload: { email, password, ...(otp ? { otp } : {}) },
  });
  expect(response.statusCode).toBe(200);
  return {
    cookie: response.headers["set-cookie"]!.toString().split(";")[0]!,
    session: response.json<Session>(),
  };
}
function headers(account = a) {
  return {
    origin,
    cookie: account.cookie,
    "x-csrf-token": account.session.csrfToken,
  };
}
beforeAll(async () => {
  await owner.connect();
  const schema = await owner.query(
    "SELECT to_regclass('public.tenants') AS present",
  );
  if (!schema.rows[0].present)
    await owner.query(await readFile("migrations/001_foundation.sql", "utf8"));
  await owner.query(
    "TRUNCATE tenants,users,sessions,access_tokens,contacts,routing_versions,cases,case_notes,audit_events CASCADE",
  );
  await owner.query(
    "INSERT INTO tenants(id,name) VALUES($1,'Empresa A'),($2,'Empresa B')",
    [ids.a, ids.b],
  );
  const hash = await hashPassword(password);
  await owner.query(
    "INSERT INTO users(id,tenant_id,name,email,role,password_hash) VALUES($1,$2,'A','a@example.test','user',$5),($3,$4,'B','b@example.test','user',$5)",
    [ids.ua, ids.a, ids.ub, ids.b, hash],
  );
  await owner.query(
    "INSERT INTO users(id,name,email,role,password_hash,mfa_secret) VALUES($1,'Admin','admin@example.test','admin',$2,$3)",
    [ids.admin, hash, encryptMfa(mfa.secret, key)],
  );
  await owner.query(
    "INSERT INTO contacts(tenant_id,id,name,phone) VALUES($1,$2,'Contato A','+5511999990000'),($3,$4,'Contato B','+5511999990001')",
    [ids.a, ids.contactA, ids.b, ids.contactB],
  );
  for (const [tenant, id] of [
    [ids.a, ids.ca],
    [ids.b, ids.cb],
  ])
    await owner.query(
      "INSERT INTO cases(tenant_id,id,priority,caller,callback_phone,deceased,location,need,source) VALUES($1,$2,'normal',$3,$3,$3,$3,$3,'synthetic')",
      [tenant, id, { status: "not_asked" }],
    );
  app = await buildApp(pool, { origin, mfaKey: key, production: false });
  a = await login("a@example.test");
  b = await login("b@example.test");
});
afterAll(async () => {
  if (app) await app.close();
  await pool.end();
  await owner.end();
});
describe("Identidade e autorização", () => {
  it("exige sessão e recusa senha incorreta sem revelar a conta", async () => {
    expect((await app.inject("/api/v1/cases")).statusCode).toBe(401);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "ausente@example.test", password: "invalid" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("INVALID_CREDENTIALS");
  });
  it("exige MFA do admin e rejeita reutilizar o mesmo código", async () => {
    const absent = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "admin@example.test", password },
    });
    expect(absent.statusCode).toBe(401);
    const otp = totp(mfa.secret, "admin@example.test").generate();
    adm = await login("admin@example.test", otp);
    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "admin@example.test", password, otp },
    });
    expect(replay.statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/api/v1/cases", headers: headers(adm) }))
        .statusCode,
    ).toBe(403);
  });
  it("bloqueia ações admin de user", async () => {
    expect(
      (await app.inject({ url: "/api/v1/admin/tenants", headers: headers() }))
        .statusCode,
    ).toBe(403);
  });
  it("rejeita alterações sem Origin ou CSRF correto", async () => {
    const payload = { status: "contacted" };
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/cases/${ids.ca}`,
          headers: { cookie: a.cookie },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/cases/${ids.ca}`,
          headers: { origin, cookie: a.cookie, "x-csrf-token": "forged" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
  });
  it("cria tenant com convite de uso único e registra auditoria", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/tenants",
      headers: headers(adm),
      payload: {
        name: "Empresa C",
        contactName: "Responsável C",
        email: "c@example.test",
      },
    });
    expect(response.statusCode).toBe(201);
    const { id, activationUrl } = response.json();
    const token = new URLSearchParams(new URL(activationUrl).hash.slice(1)).get(
      "token",
    );
    expect(
      (
        await owner.query(
          "SELECT token_hash FROM access_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1)",
          [id],
        )
      ).rows[0].token_hash,
    ).toBe(hashToken(token!));
    const payload = { token, password: opaqueToken() };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/activate",
          headers: { origin },
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/activate",
          headers: { origin },
          payload,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await owner.query(
          "SELECT count(*)::int n FROM audit_events WHERE tenant_id=$1 AND action='tenant.created'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("isola equipe e impede revogar o próprio acesso", async () => {
    const list = await app.inject({ url: "/api/v1/team", headers: headers() });
    expect(list.json().map((u: { id: string }) => u.id)).toEqual([ids.ua]);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/team/${ids.ub}`,
          headers: headers(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/team/${ids.ua}`,
          headers: headers(),
        })
      ).statusCode,
    ).toBe(409);
  });
});
describe("Isolamento entre funerárias", () => {
  it("filtra listas nos dois sentidos e bloqueia IDs conhecidos", async () => {
    expect(
      (await app.inject({ url: "/api/v1/cases", headers: headers() }))
        .json()
        .map((c: { id: string }) => c.id),
    ).toEqual([ids.ca]);
    expect(
      (await app.inject({ url: "/api/v1/cases", headers: headers(b) }))
        .json()
        .map((c: { id: string }) => c.id),
    ).toEqual([ids.cb]);
    expect(
      (await app.inject({ url: `/api/v1/cases/${ids.cb}`, headers: headers() }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/cases/${ids.cb}`,
          headers: headers(),
          payload: { status: "closed" },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("RLS protege mesmo uma consulta sem filtro de tenant e limpa contexto do pool", async () => {
    const rows = await transaction(
      pool,
      ids.a,
      async (db) => (await db.query("SELECT id FROM cases")).rows,
    );
    expect(rows.map((r) => r.id)).toEqual([ids.ca]);
    const global = await pool.query("SELECT id FROM cases");
    expect(global.rows).toEqual([]);
    await expect(
      transaction(pool, ids.a, (db) =>
        db.query(
          "INSERT INTO cases(tenant_id,id,priority,caller,callback_phone,deceased,location,need,source) VALUES($1,$2,'normal','{}','{}','{}','{}','{}','synthetic')",
          [ids.b, randomUUID()],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("recusa tenant arbitrário e contato de outra empresa", async () => {
    const configuration = defaultRouting("Empresa A");
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload: { expectedVersion: 0, tenantId: ids.b, configuration },
        })
      ).statusCode,
    ).toBe(400);
    configuration.contactId = ids.contactB;
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload: { expectedVersion: 0, configuration },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("constraint impede associar nota a um ator de outro tenant", async () => {
    await expect(
      owner.query(
        "INSERT INTO case_notes(tenant_id,id,case_id,actor_id,text) VALUES($1,$2,$3,$4,'exemplo')",
        [ids.a, randomUUID(), ids.ca, ids.ub],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});
describe("Configuração e casos", () => {
  it("salva versões, detecta edição concorrente e bloqueia publicação sem verificação", async () => {
    const configuration = {
      ...defaultRouting("Empresa A"),
      contactId: ids.contactA,
    };
    const payload = { expectedVersion: 0, configuration };
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload,
        })
      ).json().version,
    ).toBe(1);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/tenant/settings/publish",
          headers: headers(),
          payload: { version: 1 },
        })
      ).json().code,
    ).toBe("CONTACT_UNVERIFIED");
    await owner.query(
      "UPDATE contacts SET verified_at=now() WHERE tenant_id=$1 AND id=$2",
      [ids.a, ids.contactA],
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/tenant/settings/publish",
          headers: headers(),
          payload: { version: 1 },
        })
      ).statusCode,
    ).toBe(200);
    configuration.publicName = "Nome atualizado";
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload: { expectedVersion: 1, configuration },
        })
      ).json().version,
    ).toBe(2);
    const settings = (
      await app.inject({ url: "/api/v1/tenant/settings", headers: headers() })
    ).json();
    expect(settings.latest.version).toBe(2);
    expect(settings.publishedVersion).toBe(1);
    expect(
      (
        await owner.query(
          "SELECT configuration FROM routing_versions WHERE tenant_id=$1 AND version=1",
          [ids.a],
        )
      ).rows[0].configuration.publicName,
    ).toBe("Empresa A");
    await expect(
      transaction(pool, ids.a, (db) =>
        db.query(
          "UPDATE routing_versions SET configuration='{}' WHERE tenant_id=$1",
          [ids.a],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("recusa horários inválidos e campos de conversa sem ampliar permissões", async () => {
    const configuration = defaultRouting("Empresa A");
    configuration.hours = [{ day: 1, opensAt: "18:00", closesAt: "08:00" }];
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/tenant/settings",
          headers: headers(),
          payload: { expectedVersion: 2, configuration },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/cases/${ids.ca}`,
          headers: headers(),
          payload: { status: "contacted", tenantId: ids.b },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("salva status e notas sem alterar registros anteriores e audita", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/cases/${ids.ca}`,
      headers: headers(),
      payload: { status: "contacted", note: "Retorno realizado pela equipe." },
    });
    expect(response.statusCode).toBe(200);
    const detail = (
      await app.inject({ url: `/api/v1/cases/${ids.ca}`, headers: headers() })
    ).json();
    expect(detail.status).toBe("contacted");
    expect(detail.notes[0].text).toBe("Retorno realizado pela equipe.");
    expect(
      (
        await owner.query(
          "SELECT count(*)::int n FROM audit_events WHERE resource_id=$1 AND action='case.updated'",
          [ids.ca],
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      transaction(pool, ids.a, (db) => db.query("DELETE FROM case_notes")),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("rejeita publicação com contato marcado pelo navegador como verificado", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/tenant/contacts",
          headers: headers(),
          payload: { name: "Plantão", phone: "+5511999990000", verified: true },
        })
      ).statusCode,
    ).toBe(400);
  });
});
describe("Sessões e operação", () => {
  it("recusa conexão privilegiada da aplicação", async () => {
    const privileged = createPool(ownerUrl!);
    try {
      await expect(
        buildApp(privileged, { origin, mfaKey: key, production: false }),
      ).rejects.toThrow("sem superuser");
    } finally {
      await privileged.end();
    }
  });
  it("expira sessões e remove sessão no logout", async () => {
    const expired = opaqueToken();
    await owner.query(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()-interval '1 minute')",
      [hashToken(expired), ids.ua, opaqueToken()],
    );
    expect(
      (
        await app.inject({
          url: "/api/v1/auth/me",
          headers: { cookie: `atendente_session=${expired}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: headers(b),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/api/v1/auth/me", headers: headers(b) }))
        .statusCode,
    ).toBe(401);
  });
  it("desativar tenant revoga sessões e bloqueia novo login", async () => {
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/tenants/${ids.a}`,
          headers: headers(adm),
          payload: { status: "inactive" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/api/v1/cases", headers: headers() }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          headers: { origin },
          payload: { email: "a@example.test", password },
        })
      ).statusCode,
    ).toBe(401);
  });
});
