import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import {
  emailSchema,
  passwordSchema,
} from "../packages/contracts/src/index.js";
import { hashPassword, newMfa, encryptMfa } from "../apps/api/src/security.js";
process.loadEnvFile(".env");
const email = emailSchema.parse(process.argv[2]);
const password = passwordSchema.parse(process.env.ADMIN_BOOTSTRAP_PASSWORD);
const key = process.env.MFA_ENCRYPTION_KEY;
if (!key || !/^[a-f0-9]{64}$/.test(key))
  throw new Error("MFA_ENCRYPTION_KEY necessária");
const mfa = newMfa(email);
const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await client.connect();
try {
  await client.query(
    "INSERT INTO users(id,name,email,role,password_hash,mfa_secret) VALUES($1,'Administrador',$2,'admin',$3,$4)",
    [
      randomUUID(),
      email,
      await hashPassword(password),
      encryptMfa(mfa.secret, key),
    ],
  );
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(".local/admin-mfa.txt", mfa.uri, { mode: 0o600 });
  console.log(
    "Admin criado. Cadastre o URI de .local/admin-mfa.txt no autenticador por canal seguro e remova o arquivo após cadastrar.",
  );
} finally {
  await client.end();
}
