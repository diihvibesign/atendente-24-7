# Stack e arquitetura proposta

## Escolha inicial para o MVP

- **Linguagem:** TypeScript em modo estrito.
- **Painel web:** Next.js com React, para as áreas de administração e da funerária.
- **API e eventos de telefonia:** Node.js com Fastify, em serviço separado do painel para isolar webhooks e conexões de mídia em tempo real.
- **Dados:** PostgreSQL gerenciado, com migrações versionadas, backups e região escolhida após avaliação de residência e transferência internacional de dados.
- **Fila e dados efêmeros:** Redis gerenciado com BullMQ para notificações, retentativas e tarefas adiáveis. Redis não será fonte de verdade.
- **Telefonia do piloto:** Twilio Programmable Voice com Media Streams bidirecional por WebSocket. A tarifa pública para número local no Brasil informa US$ 0,0100/min para chamadas recebidas e US$ 4,25/mês pelo número; Media Streams custa US$ 0,0044/min. Chamadas de saída para celular aparecem a US$ 0,0663/min. Os valores são em USD e não incluem IA, impostos ou outros encargos. Confirmar disponibilidade para a cidade/DDD do cliente, condições comerciais e transferência antes de produção.
- **SMS:** decidir separadamente após confirmar preço, entrega no Brasil e regras de remetente. Manter o adaptador de mensagens independente da telefonia, mesmo que o primeiro fornecedor seja Twilio.
- **Integração de telefonia:** encapsular Twilio atrás de uma interface de adaptador. Validar latência em português brasileiro, interrupções, webhooks, transferência para celular, fallback e políticas de gravação/retenção no piloto.
- **Voz/IA:** camada de adaptador para serviço de voz em tempo real. Antes da seleção, testar qualidade em português brasileiro, latência, interrupções, termos de uso, retenção e tratamento de dados.
- **Cobrança:** gateway que aceite recorrência no Brasil e webhooks assinados. A integração permanece atrás de um adaptador.
- **Hospedagem:** contêiner gerenciado que suporte WebSocket, webhooks públicos HTTPS, escala horizontal e segredos gerenciados. Não depender apenas de funções serverless para mídia persistente.
- **Monorepo:** pnpm workspaces com `apps/web`, `apps/api` e `packages/*` compartilhados quando o código for criado.

Twilio é a decisão de fornecedor para o piloto, não uma integração já implementada ou validada em chamadas reais. Validar limites de conexão simultânea, regiões, custo total e disponibilidade de números em piloto.

## Forma do sistema

Começar como monólito modular com dois processos implantáveis: painel e serviço de API/telefonia. Domínios internos: identidade e empresas, configuração de atendimento, chamadas e casos, notificações, planos e cobrança, auditoria. Evitar microsserviços até que métricas demonstrem necessidade.

```text
Pessoa que liga
   -> Operadora / gateway de telefonia
   -> API de voz (webhook + mídia em tempo real)
       -> regras determinísticas de atendimento
       -> adaptador de IA de voz
       -> PostgreSQL (casos, configuração, assinaturas, auditoria)
       -> Redis / fila -> adaptador de SMS

Usuário da funerária -> Painel web -> API autenticada -> PostgreSQL
Gateway de pagamento -> webhook assinado -> API -> assinatura e eventos
```

## Limites importantes

- O banco é a fonte de verdade para casos, regras, usuários e estado de assinatura.
- O modelo de IA não consulta o banco diretamente nem executa ferramentas arbitrárias. A API fornece contexto mínimo e valida toda ação solicitada.
- A decisão de transferência é feita por regras configuradas e versionadas; IA pode coletar uma intenção explícita, sem classificar sozinha o risco.
- O envio de SMS, criação de caso e eventos de cobrança usam fila/outbox e chaves de idempotência.
- Integrações externas ficam em adaptadores; nenhum SDK de provedor deve vazar para os módulos de domínio.

## Caminho de evolução

1. Validar jornadas e protótipo de voz com funerárias.
2. Implementar autenticação, tenants, configuração e casos sem telefonia real.
3. Integrar Twilio Programmable Voice e Media Streams atrás do adaptador; realizar chamadas de teste controladas e verificar transferência/fallback.
4. Adicionar alertas e cobrança em modo de teste.
5. Piloto com monitoração, consentimentos e plano de contingência humana.

Não escolher fornecedor apenas pelo SDK. Comparar disponibilidade no Brasil, suporte a português, portabilidade de número, preço por minuto, qualidade de transferência, SLA, DPA, suboperadores, retenção e processo de exportação/exclusão.
