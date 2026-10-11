# Evidências da fundação

Execução local em 11/10/2026: Node.js 24.19, pnpm 10.32.1, PostgreSQL 17.9 e Chromium do ambiente. Esta revisão cobre a fundação e os fluxos implementados. Não comprova os gates de telefonia, voz, cobrança ou piloto.

## Checks executados

| Verificação                                     | Resultado                                     | Escopo                                                              |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | Passou, incluindo repetição                   | Dependências com lockfile preservado                                |
| `pnpm setup:local`                              | Passou; `.env` existente preservado           | Configuração local, sem chaves externas                             |
| `docker compose --profile test up -d --wait`    | Dois bancos saudáveis                         | Desenvolvimento persistente e testes descartáveis                   |
| `pnpm db:migrate`                               | Passou, incluindo repetição                   | Migração transacional, checksum e advisory lock                     |
| `pnpm typecheck`                                | Passou                                        | Contratos, API, painel e scripts                                    |
| `pnpm lint` e `pnpm format:check`               | Passaram                                      | Código e documentação                                               |
| `pnpm test`                                     | 17 testes passaram, sem skips                 | Autenticação, MFA, autorização, CSRF, RLS, versões, casos e sessões |
| `pnpm build`                                    | API e painel passaram                         | Build de produção                                                   |
| `pnpm audit`                                    | Nenhuma vulnerabilidade conhecida reportada   | Dependências diretas e transitivas, incluindo desenvolvimento       |
| `CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e` | 2 testes passaram                             | Fluxos user e admin em navegador                                    |
| Readiness HTTP                                  | Passou                                        | Health da API consulta banco; login responde no painel              |
| Lighthouse 13.5.0, desktop                      | Best Practices 100/100; Accessibility 100/100 | Login em build de produção local; nenhum audit com score zero       |
| Squirrelscan 0.0.108                            | Executado; score geral não aprovado           | Login público, HTTP local, sem autenticação, sem publicação         |

A suíte de integração demonstra isolamento nos dois sentidos com IDs conhecidos, RLS em consulta sem filtro de tenant, limpeza do contexto de conexão, FK de ator/caso, rejeição de contato cruzado e de conexão privilegiada. Demonstra também convite de uso único, MFA sem replay, publicação somente com contato verificado, versões imutáveis e conflito de edição, notas/auditoria imutáveis, expiração/logout e revogação de sessões ao desativar o painel.

Os testes de navegador verificam login, fila, detalhe com persistência de status/nota, configuração em rascunho, logout e admin criando convite sem acesso a casos. Axe não encontrou violações nas páginas verificadas: login, fila, detalhe, configuração e admin. A fila não apresentou overflow horizontal em 320, 768, 1024 e 1440 px. Revisão visual usou capturas locais com dados sintéticos; tokens de convite são mascarados.

Lighthouse, axe e ausência de advisories não substituem revisão de segurança, testes manuais de acessibilidade ou validação operacional. A recuperação assistida existe, mas entrega de e-mail e recuperação operacional de MFA ainda exigem validação específica. CI foi configurada; esta evidência não afirma execução remota no GitHub Actions.

## Squirrelscan: resultado e decisões

Binário baixado do release oficial e verificado contra SHA-256 e tamanho do manifesto oficial antes de executar. Auditorias offline, passivas e sem publicação:

```bash
squirrel audit http://localhost:3002/login --level quick --offline --http --passive --no-publish --format llm --output .local/squirrel-quick.txt
squirrel audit http://localhost:3002/login --level full --refresh --offline --http --passive --no-publish --format llm --output .local/squirrel-full.txt
```

O primeiro scan teve score geral 33/100, 102 regras aprovadas, 23 avisos e 2 falhas. Após corrigir hints do teclado móvel, título/descrição e adicionar `robots.txt` que bloqueia rastreamento, o scan final teve score geral **20/100**, 109 regras aprovadas, 22 avisos e 2 falhas. Acessibilidade subiu de 99 para 100 e Core SEO de 69 para 84; Performance permaneceu 94 e o grupo Security 94.

O score geral caiu porque bloquear rastreamento e indexação contraria os critérios de descoberta pública da ferramenta. O painel exige essa configuração nesta fase. Não há aprovação global da auditoria nem meta de score atingida. O modo `full` manteve apenas uma página acessível: não houve crawl dos painéis autenticados. Renderização em nuvem e oito verificações de transporte, HTTPS, HSTS, compressão e cache ficaram fora do scan local. Os fluxos autenticados foram avaliados separadamente com Playwright/axe.

| Achados restantes                                                                                      | Decisão / próximo gate                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falhas: ausência de sitemap e bloqueio em `robots.txt`; avisos de noindex e bloqueio de crawlers de IA | Intencionais para o painel privado. Rever descoberta somente ao criar um site comercial público separado; autenticação/RLS continuam sendo os controles de acesso |
| Canonical, Open Graph e Twitter Cards ausentes                                                         | Fora da entrega do painel. Definir domínio e compartilhamento no site comercial                                                                                   |
| Poucos links, página sem saída, conteúdo curto                                                         | Login com acesso restrito; não inserir conteúdo editorial ou links para dados autenticados para aumentar score                                                    |
| About, autoria, datas e Contact ausentes                                                               | Critérios editoriais sem aplicação no login; canal de suporte operacional precisa ser definido antes do piloto                                                    |
| Política de privacidade ausente, incluindo avisos E-E-A-T e Legal                                      | Pendência real antes do piloto: aprovar base legal, controlador/operador, contatos, retenção e fornecedores e publicar política acessível                         |
| Cadeia crítica de CSS                                                                                  | CSS do painel compartilhado; avaliar desempenho completo em staging. Não há teste de Core Web Vitals de campo nesta entrega                                       |
| JavaScript possivelmente não minificado                                                                | Heurística aponta chunk do Next com economia estimada de 0,0 KB. Build foi de produção; avaliar impacto antes de alterar empacotamento                            |
| `llms.txt`, Markdown alternativo e proporção de texto/HTML                                             | Sem publicação para agentes de busca no painel privado; reavaliar para documentação/site públicos                                                                 |

Relatórios e capturas ficam em `.local/`, ignorados. As decisões acima registram os avisos e as falhas; não os transformam em checks aprovados.

## Skills solicitadas

As fontes foram lidas do GitHub. As revisões estão fixadas abaixo para registrar o conteúdo consultado; as skills não fazem parte das dependências de produção.

| Fonte / skill                                                                                                                                                       | Aplicação nesta entrega                                                                                                                                                       | Revisão consultada                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [squirrelscan: audit-website](https://github.com/squirrelscan/skills/tree/5a4b70c5480b7fb16381b5e44e8a11c9ef81d7fc/skills/audit-website)                            | Scan quick, correções aplicáveis, scan full e decisões sobre critérios de site público                                                                                        | `5a4b70c5480b7fb16381b5e44e8a11c9ef81d7fc`   |
| [web-quality-skills: best-practices](https://github.com/addyosmani/web-quality-skills/tree/afa8da942115f2961fdbfa80807ea0b232ff6c00/skills/best-practices)          | Lighthouse, console, cabeçalhos, dependências e revisão de autenticação/logs/segredos                                                                                         | `afa8da942115f2961fdbfa80807ea0b232ff6c00`   |
| [RigorPilot](https://github.com/lllllllama/rigorpilot-skills/tree/fb3ccdf5aa64b1fa5b1d0463e666a8bc8bc26e01/skills)                                                  | Princípios README-first: comandos documentados, requisitos e limites confrontados com execução. Fluxo de reprodução científica não aplicado: este projeto é uma aplicação web | `fb3ccdf5aa64b1fa5b1d0463e666a8bc8bc26e01`   |
| [agent-skills: frontend-ui-engineering](https://github.com/addyosmani/agent-skills/tree/1be8e34187e34647bb83adc3a1323b26ae6f6abe/skills/frontend-ui-engineering)    | Estados de interface, responsividade, navegação, semântica e revisão visual                                                                                                   | `1be8e34187e34647bb83adc3a1323b26ae6f6abe`   |
| [Caveman](https://github.com/juliusbrussee/caveman/tree/2e08b9177c07bb7249a8a2d1a6758e5db281d002)                                                                   | Comunicação concisa preservando nomes, comandos, números e limites. Não é ferramenta de validação documental; PRD não foi comprimido pelo CLI                                 | `2e08b9177c07bb7249a8a2d1a6758e5db281d002`   |
| [Anthropic: frontend-design](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design)                             | Tipografia local, cores, hierarquia e layout; contrato em INTERFACE.md                                                                                                        | `dbd4588f9e1033efb41dad4bef2f7947c8993d44`   |
| [Supabase: postgres-best-practices](https://github.com/supabase/agent-skills/tree/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices) | RLS com login sem privilégios, índices, transações, grants mínimos e constraints de tenant. Banco local PostgreSQL; serviço Supabase não conectado                            | `c9be0e931b7930f7d02126d04774d904c381e7d7`   |
| cloud-environment-onboarding:setup                                                                                                                                  | Instalação congelada, serviços iniciados, readiness e instruções reutilizáveis no rascunho do ambiente                                                                        | Skill fornecida pela plataforma nesta sessão |

## Limites de entrega

Nenhuma chamada, SMS ou cobrança real foi executada. Sem medição de latência de voz, DDD brasileiro contratado, TLS público, fallback humano validado, consentimento/retenção no fornecedor, backup/restauração ou teste de carga. O piloto permanece bloqueado pelos [gates](GATES.md). A publicação do ambiente de desenvolvimento é distinta da publicação da plataforma e da ativação de uma linha telefônica.
