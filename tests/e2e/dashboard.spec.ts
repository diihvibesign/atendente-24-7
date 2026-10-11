import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { totp } from "../../apps/api/src/security.js";
const accounts = JSON.parse(
  await readFile(".local/demo-accounts.json", "utf8"),
);
async function signIn(page: import("@playwright/test").Page, admin = false) {
  await page.goto("/login");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(admin ? accounts.admin.email : accounts.userA.email);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(admin ? accounts.admin.password : accounts.userA.password);
  if (admin)
    await page
      .getByLabel("Código do autenticador", { exact: false })
      .fill(totp(accounts.admin.totpSecret, accounts.admin.email).generate());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(admin ? /\/admin$/ : /\/app$/);
}
test("login acessível e painel responsivo, com detalhe e persistência", async ({
  page,
}) => {
  const exceptions: string[] = [];
  page.on("pageerror", (error) => exceptions.push(error.message));
  await page.goto("/login");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Fila de atendimento" }),
  ).toBeVisible();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator(".case-row").first().click();
  await page.getByLabel("Status do atendimento").selectOption("contacted");
  await page
    .getByLabel("Nota operacional")
    .fill("Nota sintética do teste de interface.");
  await page.getByRole("button", { name: "Salvar atendimento" }).click();
  await expect(
    page.getByText("Atendimento atualizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Nota sintética do teste de interface.", { exact: true })
      .first(),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".local/screenshots/atendimento.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Atendimento e plantão", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Identidade e plantão" }),
  ).toBeVisible();
  await page
    .getByLabel("Nome usado no atendimento")
    .fill("Funerária Horizonte · demonstração");
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText(/salva como rascunho/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(exceptions).toEqual([]);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("admin acessa empresas e cria convite sem conteúdo de casos", async ({
  page,
}) => {
  await signIn(page, true);
  await expect(
    page.getByRole("heading", { name: "Empresas cadastradas" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Nova funerária" }).click();
  await page
    .getByLabel("Nome da funerária")
    .fill("Empresa sintética de interface");
  await page.getByLabel("Nome do responsável").fill("Responsável de teste");
  await page
    .getByLabel("E-mail do responsável")
    .fill(`e2e-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Criar e gerar convite" }).click();
  await expect(
    page.getByLabel("Link de ativação, válido por 48 horas"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Atendimentos", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".local/screenshots/admin.png",
    fullPage: true,
    mask: [page.getByLabel("Link de ativação, válido por 48 horas")],
  });
});
