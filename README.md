# Atendente 24/7

Plataforma de atendimento digital de voz para funerárias independentes no Brasil. O assistente se identifica como digital, acolhe quem liga e encaminha o pedido à equipe humana segundo regras da funerária.

## Implementação atual

Fundação funcional com painéis `admin` e `user`, login, MFA TOTP obrigatório para admin, convites, recuperação assistida, sessões revogáveis, gestão de funerárias e equipe, configuração versionada e acompanhamento de casos. PostgreSQL aplica isolamento por tenant com RLS e constraints; admin não acessa conteúdo de casos por padrão.

**Telefonia, conversa por voz, transferências, SMS e cobrança ainda não estão conectados.** Twilio foi escolhido. ElevenLabs Agents e OpenAI Realtime são candidatos para a conversa. Asaas permanece candidato para cobrança em sandbox. O ambiente local funciona sem chaves externas e não dispara chamadas ou pagamentos.

O receptor Asaas `POST /webhooks/asaas/events` já autentica e guarda eventos sem duplicação, mas permanece desativado. Precisa de hospedagem HTTPS, cadastro e callback real; processamento de assinaturas está pendente. Veja [configuração do webhook sandbox](docs/engineering/ASAAS-WEBHOOK-SETUP.md).

## Iniciar desenvolvimento

Requisitos: Node.js 22.12+ (validado com 24.19), pnpm 10.32.1 e Docker com Compose. Na raiz:

```bash
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

O setup cria `.env` ignorado com chave MFA aleatória e preserva arquivos existentes. PostgreSQL local atende na porta 55432; API na 3001 e painel na 3000. O Compose contém senhas exclusivas de desenvolvimento e expõe o banco apenas no loopback. Fora do desenvolvimento, use segredos gerenciados, TLS e usuários de banco separados.

Para navegar com dados sintéticos:

```bash
pnpm db:demo
```

O comando exige banco local, gera contas admin e duas funerárias e grava credenciais aleatórias em `.local/demo-accounts.json`, com permissão restrita. Cadastre o `totpSecret` do admin em seu autenticador. A verificação do contato nessa demonstração é sintética; não comprova posse de um celular. Reexecutar preserva dados/credenciais. Não use seed de demonstração em staging ou produção.

Para uma instalação sem demo, siga [primeiro administrador e credenciais](docs/engineering/SECRETS-E-CONEXOES.md). Convites geram links de 48 horas para entrega segura. Recuperação de acesso é assistida por operador, com link de 30 minutos; e-mail automático ainda está pendente.

## Verificar mudanças

```bash
docker compose --profile test up -d --wait
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm audit
```

Os testes de integração usam exclusivamente o banco descartável `atendente_test`, na porta 55433, e verificam autenticação, autorização, MFA, RLS, configurações e sessões. Recusam uma URL cujo nome de banco não termine em `_test`.

Para os fluxos de navegador, deixe `pnpm dev` rodando e crie a demo local:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Se o ambiente já tiver Chromium do sistema, use `CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`. Os testes alteram somente dados sintéticos da demo e produzem capturas ignoradas em `.local/screenshots/`. Admin usa códigos de uso único; se repetir o teste no mesmo intervalo de 30 segundos, aguarde um novo código. Validação em navegador inclui axe e larguras de 320, 768, 1024 e 1440 px.

## Estrutura

```text
apps/web            Next.js e React: painéis e ativação de acesso
apps/api            Fastify: autenticação, tenants, configuração e casos
packages/contracts  Schemas runtime e tipos compartilhados
migrations          SQL versionado e grants para atendente_app
scripts             Setup, migrações, bootstrap, recuperação e demo local
tests               Integração PostgreSQL e fluxos Playwright
docs                PRD, decisões, gates e operação
```

`DATABASE_URL` usa login sem superuser/bypass de RLS. `MIGRATION_DATABASE_URL` fica somente com o operador/job de migração. Tokens de sessão e acesso são persistidos por hash; segredos MFA são criptografados. Logs da API não registram corpo, nomes, telefone ou tokens. Dados autenticados não são cacheados.

## Documentação e próximos gates

- [PRD completo de implementação](docs/product/PRD-IMPLEMENTACAO.md)
- [Estado de implementação e gates](docs/engineering/GATES.md)
- [Como conseguir cada credencial](docs/engineering/SECRETS-E-CONEXOES.md)
- [ElevenLabs: criar chave e escolher a voz](docs/engineering/ELEVENLABS-SETUP.md)
- [Asaas: URL e cadastro do webhook sandbox](docs/engineering/ASAAS-WEBHOOK-SETUP.md)
- [Alternativas para voz: ElevenLabs e Realtime](docs/architecture/VOICE-PROVIDERS.md)
- [Verificações e uso das skills solicitadas](docs/engineering/VALIDACAO.md)
- [Contrato de interface](docs/design/INTERFACE.md)
- [Stack](docs/architecture/STACK.md), [padrões](docs/engineering/IMPLEMENTATION-STANDARDS.md) e [decisões](docs/architecture/decisions/)
- [Política de voz e prompts](docs/ai/VOICE-ASSISTANT.md)
- [Recorrência e cache](docs/billing/RECORRENCIA-E-CACHE.md)
- [Segurança e privacidade](docs/security/PRIVACIDADE-E-SEGURANCA.md)

O piloto exige chamadas e fallback reais com números autorizados, destinatários verificados, avaliação de voz, tratamento de dados revisado e operação humana definida. Esta entrega permite desenvolver essas integrações; não autoriza ativação para famílias reais.
