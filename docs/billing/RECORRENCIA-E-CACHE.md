# Recorrência, cobrança e cache

Este documento define uma política inicial para orientar implementação. Preço, prazos de carência, cancelamento e tratamento de inadimplência devem ser confirmados comercialmente antes de ativar cobrança.

## Planos e recorrência

- Cada plano possui `plan_id`, nome, moeda, preço em centavos, intervalo (`month` ou `year`), limites e versão. BRL deve ser a moeda inicial se o mercado de lançamento for Brasil.
- Assinatura pertence a um tenant e contém status, ciclo atual, próxima data de cobrança, identificador do gateway e versão do plano contratada.
- Não recalcular períodos históricos quando um plano mudar. Uma alteração futura vale no próximo ciclo, com aceite registrado.
- Não incluir cobrança por minuto excedente no MVP sem medição transparente e aprovação do cliente.
- Preferir checkout hospedado/tokenização do gateway; a plataforma não armazena número de cartão nem CVV.

### Estados

`incomplete -> trialing (opcional) -> active -> past_due -> active | canceled`

O gateway é autoridade de pagamento; o estado local é uma projeção atualizada por webhooks autenticados conforme a especificação do fornecedor. No Asaas, o receptor usa token compartilhado via HTTPS, não assinatura HMAC do corpo. Eventos podem chegar duplicados, atrasados ou fora de ordem. Armazenar ID, horário do provedor, payload minimizado e resultado de processamento para idempotência e auditoria. Reconciliar periodicamente com o gateway.

### Falha, cancelamento e serviço essencial

Proposta para o MVP: avisar o responsável do tenant, permitir atualização segura do pagamento e definir uma carência comercial explícita. Não desligar silenciosamente o atendimento telefônico nem desviar chamadas para caixa postal por inadimplência. Qualquer suspensão deve ter aviso prévio, estado operacional seguro, plano de continuidade e ação auditada. Confirmar viabilidade econômica e contratual antes de impor bloqueios.

Cancelamento deve registrar solicitante, motivo opcional, data efetiva, estado de acesso e regra de dados pós-cancelamento. Revogar credenciais e integrações conforme política; conservar apenas o que for necessário para obrigações legais e disputa, com prazo definido. Reembolsos e notas fiscais seguem o gateway e as regras locais.

## Fluxo de cobrança

1. Criar sessão de checkout no provedor; não receber dados brutos de cartão.
2. Validar a autenticação do webhook conforme o fornecedor e registrar o evento em tabela de entrada/outbox.
3. Deduplicar pelo ID do evento, aplicar transição permitida e registrar auditoria.
4. Processar notificações e atualização de entitlements em fila.
5. Reconciliar divergências por consulta autenticada ao gateway; nunca corrigir a fatura com base só em mensagem do navegador.

## Cache

PostgreSQL é a fonte de verdade. Cache serve para acelerar configuração pouco mutável e dados públicos de plano. Não cachear conteúdo de chamada, transcrição, nome de falecido, telefone, endereço, local do corpo, tokens de acesso ou payload de pagamento.

| Dado                                  | Cache                   | TTL inicial          | Chave e invalidação                                                        |
| ------------------------------------- | ----------------------- | -------------------- | -------------------------------------------------------------------------- |
| Catálogo público de planos            | Redis ou cache HTTP     | 5 min                | `plans:catalog:v{version}`; expirar ao publicar plano                      |
| Configuração de atendimento do tenant | Redis                   | 30 s                 | `tenant:{id}:routing:v{version}`; invalidar na mesma operação de alteração |
| Entitlements do plano                 | Redis opcional          | 30 s                 | `tenant:{id}:entitlements:v{version}`; atualizar por evento de assinatura  |
| Estado de chamada ativa               | Redis, somente efêmero  | até encerrar + 5 min | ID opaco da chamada; remover no encerramento e expirar em falha            |
| Respostas de API com dados de caso    | Sem cache compartilhado | —                    | `Cache-Control: no-store` para respostas autenticadas sensíveis            |

TTL são valores iniciais para teste, não SLOs. Evitar cache local divergente em múltiplas instâncias. Redis não deve guardar a única cópia de estado necessário para retomar chamada; persistir transições importantes no banco. Se Redis ficar indisponível, leitura de configuração deve poder recorrer ao banco e alertar; o fluxo de transferência precisa ter fallback independente.

## Chaves idempotentes e retenção

- Webhook de telefonia: `provider:{provider}:event:{event_id}`.
- Cobrança: `billing:{provider}:event:{event_id}`.
- Operação de envio: ID de outbox, com estado e tentativas.
- Nunca usar telefone ou conteúdo da conversa como chave.
- Definir TTL de deduplicação maior que a janela máxima de reentrega documentada pelos fornecedores. Manter eventos financeiros conforme prazo legal/contábil validado.
- Excluir/redigir payloads brutos após processamento, salvo se houver necessidade documentada e prazo aprovado. Não guardar conteúdo completo do webhook por padrão.
