# Asaas sandbox: URL e cadastro do webhook

Atualizado em 11/10/2026. O Asaas envia eventos para **nossa API**. A URL depende da publicação de um serviço HTTPS; criar a chave de API não exige um webhook cadastrado.

## Estado atual

`POST /webhooks/asaas/events` está implementado com autenticação, persistência minimizada em PostgreSQL e deduplicação. Fica desativado por padrão. Ainda não há host público, cadastro na conta, callback real, worker de cobrança, associação provedor/tenant ou reconciliação.

Eventos aceitos ficam `pending`; receber não altera assinatura, plano, acesso ou telefonia. Habilitar somente para testes do sandbox nesta etapa.

## Preparar a API pública

1. Publique `apps/api` em um serviço com HTTPS e PostgreSQL persistente. Render ou Railway são opções para um processo Node; domínio, região e custos precisam ser definidos. Este repositório não cria nem contrata um host automaticamente.
2. Build na raiz: `pnpm install --frozen-lockfile` e `pnpm --filter @atendente/api build`. Start: `pnpm --filter @atendente/api start`. O start permite configurações injetadas pelo host sem exigir `.env`.
3. Configure `DATABASE_URL` com login sem superuser/bypass, `MFA_ENCRYPTION_KEY`, `APP_ORIGIN` HTTPS e `API_HOST=0.0.0.0`. A API usa `API_PORT`, ou `PORT` fornecida pelo host quando `API_PORT` não estiver definida. Não expor o PostgreSQL publicamente.
4. Rode `pnpm db:migrate` pelo job/operador com `MIGRATION_DATABASE_URL`. O script atual lê `.env`: provisione um arquivo restrito temporário nesse job, sem incluir o segredo no build/commit. A API não deve receber a conexão de migração.
5. Gere 32 bytes aleatórios em hexadecimal e guarde em `ASAAS_WEBHOOK_TOKEN`. É um token próprio do webhook, diferente de `ASAAS_API_KEY`. Use o mesmo valor no servidor e no cadastro do Asaas.
6. Configure `ASAAS_WEBHOOK_ENABLED=true`, reinicie e confirme `/health`: `billingWebhook` deve ser `sandbox_receiving_only`. Isso indica configuração local, não acesso ao Asaas nem entrega real.
7. Confirme HTTPS, certificado, banco disponível e proteção do ingresso. A rota exige POST e token; abrir a URL num navegador não testa entrega. Não cadastrar localhost, GitHub ou uma página de documentação.

O endereço final será a **origem HTTPS real da API**, seguida de `/webhooks/asaas/events`. Ainda não existe uma URL pública para esta instalação. Não colar domínio de exemplo no painel.

## Preencher no painel sandbox

Na área de integrações/webhooks de [sandbox.asaas.com](https://sandbox.asaas.com/), crie uma configuração. Os nomes de menus podem variar:

| Campo                     | Valor                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Nome                      | `Atendente 24/7 — sandbox`                                                                                           |
| URL                       | Origem HTTPS real da API + `/webhooks/asaas/events`                                                                  |
| Versão da API             | `3`                                                                                                                  |
| Token de autenticação     | Mesmo valor de `ASAAS_WEBHOOK_TOKEN`                                                                                 |
| E-mail para alertas       | Endereço operacional que você acompanha                                                                              |
| Envio                     | Sequencial (`SEQUENTIALLY`)                                                                                          |
| Eventos da primeira prova | `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED` |
| Habilitado                | Depois de validar o endpoint                                                                                         |

Não selecionar todos os grupos: o receptor trata envelopes `PAYMENT_*` e `SUBSCRIPTION_*`. Assinaturas precisam de `subscription.id`; pagamentos, `payment.id`. O token é enviado no header `asaas-access-token`, nunca na URL.

Simule uma cobrança **somente no sandbox** e confira a entrega no histórico do Asaas e o registro na caixa de entrada. Prove reentrega, token incorreto e falha de armazenamento. Testes sintéticos não aprovam o gate do callback real. Se a entrega falhar, corrija a causa e utilize o fluxo de reenvio/retomada do painel; salvar configuração não comprova reentrega de eventos antigos.

## Respostas e processamento

- `200`: evento gravado ou reentrega com os mesmos metadados normalizados. Confirma recebimento durável, não processamento da assinatura.
- `401`: token ausente/incorreto.
- `400`: envelope inválido ou grupo fora do escopo.
- `409`: mesmo ID com metadados de recurso/evento divergentes; não sobrescreve o anterior.
- `413`: corpo acima de 64 KiB; validar envelopes reais antes de ampliar o limite.
- `503`: recebimento desativado; não habilitar envios no Asaas nesse estado.
- `500`: falha de persistência ou erro interno; não confirma sucesso.

O token via HTTPS autentica o remetente; não é assinatura HMAC do corpo. Não exigir timestamp recente de reentregas legítimas. O ID durável deduplica eventos, inclusive concorrentes. O hash é dos metadados normalizados, não do corpo bruto. Dados de cartão/pagador e campos de tenant/externalReference não são guardados nem usados para conceder acesso.

A API tem grants apenas para inserir e deduplicar; não há endpoint de consulta desses eventos para clientes. Implementar worker, mapeamento seguro dos recursos para tenants, retenção, reconciliação e observabilidade antes da cobrança completa. Acompanhar eventos pendentes. O rate limit do painel não se aplica à rota; definir proteção no ingresso da hospedagem conforme o volume do fornecedor.

## Acesso e fontes

Nenhum conector Asaas ou de hospedagem está exposto nesta sessão. Credenciais e URL pública estão ausentes. A documentação web retornou bloqueio de rede; `docs.asaas.com` foi adicionado ao rascunho para revisão/publicação, sem comprovar aplicação no runtime.

Campos de cadastro, envio sequencial, eventos e `/v3/webhooks` foram confrontados com o [SDK oficial](https://github.com/asaasdev/asaas-api-sdk-java/tree/0641522019d22bd63eb35dc25d77cdabcc9cc8e7), incluindo `WebhookConfigSaveRequestDto` e `WebhookService`. Não houve inspeção do painel da sua conta. Autenticação/envelope precisam ser confirmados com entrega real em staging antes de aprovar BILL-03.
