import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { emailSchema } from "../packages/contracts/src/index.js";
import { hashToken, opaqueToken } from "../apps/api/src/security.js";
process.loadEnvFile(".env");
const email = emailSchema.parse(process.argv[2]);
const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  const result = await client.query(
    "SELECT id,tenant_id FROM users WHERE email=$1 AND active FOR UPDATE",
    [email],
  );
  if (!result.rowCount) throw new Error("Conta ativa não encontrada.");
  const account = result.rows[0];
  const token = opaqueToken();
  await client.query(
    "UPDATE access_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
    [account.id],
  );
  await client.query(
    "INSERT INTO access_tokens(token_hash,user_id,kind,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
    [hashToken(token), account.id],
  );
  await client.query(
    "INSERT INTO audit_events(id,tenant_id,action,resource_id) VALUES($1,$2,'auth.reset_issued_by_operator',$3)",
    [randomUUID(), account.tenant_id, account.id],
  );
  await client.query("COMMIT");
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(
    ".local/reset-link.txt",
    `${process.env.APP_ORIGIN}/ativar#token=${token}`,
    { mode: 0o600 },
  );
  console.log(
    "Link de 30 minutos salvo em .local/reset-link.txt. Confirme a identidade antes de entregar por canal seguro. MFA admin continua obrigatório.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
