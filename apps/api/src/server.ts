import { buildApp } from "./app.js";
import { createPool } from "./db.js";
const url = process.env.DATABASE_URL;
const key = process.env.MFA_ENCRYPTION_KEY;
const origin = process.env.APP_ORIGIN;
if (!url || !key || !/^[a-f0-9]{64}$/.test(key) || !origin)
  throw new Error(
    "Configure DATABASE_URL, APP_ORIGIN e MFA_ENCRYPTION_KEY (32 bytes hex).",
  );
const production = process.env.NODE_ENV === "production";
if (production && !origin.startsWith("https://"))
  throw new Error("APP_ORIGIN deve usar HTTPS em produção.");
const pool = createPool(url);
const app = await buildApp(pool, { origin, mfaKey: key, production });
await app.listen({
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.API_HOST ?? "127.0.0.1",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
