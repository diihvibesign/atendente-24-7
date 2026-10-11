import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Não foi possível iniciar o Next.js.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
