import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(
    ".env",
    template.replace(
      "MFA_ENCRYPTION_KEY=",
      `MFA_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
    ),
    { mode: 0o600 },
  );
  console.log(
    ".env local criado; credenciais de fornecedores continuam vazias.",
  );
} else {
  console.log(".env existente preservado.");
}
