import pg from "pg";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { defaultRouting } from "../packages/contracts/src/index.js";
import {
  opaqueToken,
  hashPassword,
  newMfa,
  encryptMfa,
} from "../apps/api/src/security.js";
process.loadEnvFile(".env");
if (process.env.NODE_ENV === "production")
  throw new Error("Demonstração proibida em produção.");
const url = process.env.MIGRATION_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Demo aceita apenas banco local.");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const existing = await client.query(
    "SELECT 1 FROM users WHERE email='cliente.a@example.test'",
  );
  if (existing.rowCount) {
    console.log("Demo já existe; dados e credenciais preservados.");
    process.exitCode = 0;
  } else {
    const mfa = newMfa("admin@example.test");
    const accounts = {
      admin: {
        email: "admin@example.test",
        password: opaqueToken(),
        totpSecret: mfa.secret,
      },
      userA: { email: "cliente.a@example.test", password: opaqueToken() },
      userB: { email: "cliente.b@example.test", password: opaqueToken() },
    };
    const key = process.env.MFA_ENCRYPTION_KEY!;
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO users(id,name,email,role,password_hash,mfa_secret) VALUES($1,'Admin de demonstração',$2,'admin',$3,$4)",
      [
        randomUUID(),
        accounts.admin.email,
        await hashPassword(accounts.admin.password),
        encryptMfa(mfa.secret, key),
      ],
    );
    for (const [index, account] of [accounts.userA, accounts.userB].entries()) {
      const tenantId = randomUUID();
      const contactId = randomUUID();
      const name =
        index === 0
          ? "Funerária Horizonte · demonstração"
          : "Funerária Sereno · demonstração";
      await client.query("INSERT INTO tenants(id,name) VALUES($1,$2)", [
        tenantId,
        name,
      ]);
      await client.query(
        "INSERT INTO users(id,tenant_id,name,email,role,password_hash) VALUES($1,$2,'Equipe de demonstração',$3,'user',$4)",
        [
          randomUUID(),
          tenantId,
          account.email,
          await hashPassword(account.password),
        ],
      );
      // Verificação sintética, exclusiva do seed local. Não envia SMS nem comprova posse real.
      await client.query(
        "INSERT INTO contacts(tenant_id,id,name,phone,verified_at) VALUES($1,$2,'Plantão fictício','+5511999990000',now())",
        [tenantId, contactId],
      );
      const configuration = { ...defaultRouting(name), contactId };
      await client.query(
        "INSERT INTO routing_versions(tenant_id,version,configuration,contact_id) VALUES($1,1,$2,$3)",
        [tenantId, configuration, contactId],
      );
      for (const [i, caller] of [
        "Pessoa de exemplo A",
        "Pessoa de exemplo B",
        "Pessoa de exemplo C",
      ].entries()) {
        const known = (value: string) => ({ status: "known", value });
        await client.query(
          `INSERT INTO cases(tenant_id,id,priority,caller,callback_phone,deceased,location,need,configuration_version,source,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,'synthetic',now()-$9*interval '1 hour')`,
          [
            tenantId,
            randomUUID(),
            i === 0 ? "urgent" : "normal",
            known(caller),
            { status: "declined" },
            known("Pessoa falecida de exemplo"),
            known("Hospital de exemplo"),
            known(
              i === 0
                ? "Solicitação explícita de atendimento humano"
                : "Pedido de retorno da equipe",
            ),
            i + 1,
          ],
        );
      }
    }
    await client.query("COMMIT");
    await mkdir(".local", { recursive: true, mode: 0o700 });
    await writeFile(
      ".local/demo-accounts.json",
      JSON.stringify(accounts, null, 2),
      { mode: 0o600 },
    );
    console.log(
      "Demo local criada com dados sintéticos. Credenciais aleatórias em .local/demo-accounts.json; nunca versionar.",
    );
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
