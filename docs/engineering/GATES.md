# Gates de implementação

Atualizado em 11/10/2026. Referência: [PRD](../product/PRD-IMPLEMENTACAO.md). Status descreve a implementação e a evidência disponível, sem equivaler a aprovação do piloto.

| Requisito / fase                                  | Estado                                   | Evidência ou trabalho restante                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fundação TypeScript / Next / Fastify / PostgreSQL | Implementada                             | Build, tipos, lint e migração; processos locais funcionais                                                                                                                              |
| AUTH-01                                           | Parcial                                  | Login/logout/expiração/cookie/CSRF/limite de tentativas; ativação e reset de uso único. Recuperação assistida; falta e-mail automático e avaliação operacional                          |
| AUTH-02                                           | Implementado localmente                  | MFA obrigatório para admin, segredo criptografado, código não reutilizável, login auditado; distribuição/recuperação de MFA e TLS em staging precisam de revisão                        |
| TEN-01 / TEN-02                                   | Demonstrados para rotas atuais           | Duas empresas, IDs conhecidos, alterações cruzadas, RLS sem filtro, contexto do pool e FK de ator/caso                                                                                  |
| ADMIN-01                                          | Implementado para acesso ao painel       | Criação/consulta/desativação/reativação. Não gerencia telefonia ou estado de cobrança ainda                                                                                             |
| USER-01                                           | Implementado                             | Convite de mesmo papel e revogação com término de sessões. Entrega manual de link; falta e-mail transacional                                                                            |
| ADMIN-02 suporte excepcional                      | Não iniciado                             | Sem endpoint de bypass/admin para casos                                                                                                                                                 |
| CFG-01 / CFG-03                                   | Implementados na fundação                | Horários locais, exceções fechadas, plantão, regras, tentativas/timeout e textos. Versões salvas imutáveis, publicação separada, concorrência por versão                                |
| CFG-02                                            | Gate aplicado; verificação real pendente | Endpoint rejeita contato não verificado ou de outro tenant. Não existe API para navegador marcar verificado; será conectado fluxo por código SMS                                        |
| CASE-01 / CASE-02                                 | Parcial                                  | Lista/detalhe/filtro de status, status e notas auditadas; somente casos sintéticos no local. Falta criação vinculada à chamada real                                                     |
| BILL-03 recebimento Asaas sandbox                 | Parcial                                  | Token, inbox minimizada, idempotência, commit antes do 200 e grants mínimos implementados. Faltam host HTTPS, cadastro/callback real, worker, vínculo seguro com tenant e reconciliação |
| Planos / assinatura / demais BILL-\*              | Não iniciado                             | Sem valores inventados, sem gateway conectado, sem suspensão de chamadas                                                                                                                |
| TEL-_ / AI-_ / SMS-\*                             | Não iniciado                             | Chaves, host HTTPS/WSS, fornecedor de conversa, webhooks, fila/outbox, transferência e delivery ainda precisam de implementação/testes                                                  |
| AUD-01                                            | Parcial                                  | Auditoria imutável de login, tenant, convites, contato, versões, casos e reset; eventos da telefonia ficam para próxima fase                                                            |
| OPS-\*                                            | Parcial                                  | Health real de banco/API; logs mínimos. Faltam health de fornecedores, fila, métricas/alertas e reprocessamento                                                                         |
| LGPD / retenção / backups / piloto                | Pendente                                 | Contratos, base legal, retenção nos fornecedores, backups/restauração e plantão humano precisam ser validados                                                                           |

## Controles antes do próximo gate

- A API recusa conexão de banco com superuser ou `BYPASSRLS`. A configuração de tenant vem da sessão, não do navegador.
- `atendente_app` não altera documentos de configuração, notas ou auditoria depois de criados. A publicação só altera seu marcador de data; novas alterações criam versões.
- Sessões expiram em 1 hora para admin e 8 horas para user. Revogar acesso, desativar painel ou redefinir senha invalida sessões. MFA não desaparece ao redefinir senha.
- Cookies de produção usam prefixo `__Host-`, `HttpOnly`, `Secure` e `SameSite=Strict`. Origin exata e token CSRF protegem mutações. Ambiente local usa HTTP exclusivamente para desenvolvimento.
- Proxy confiável inicial limita-se ao loopback do painel. Antes de múltiplas instâncias, configurar proxies privados explicitamente e mover rate limits para armazenamento compartilhado; não confiar em qualquer `X-Forwarded-For`.
- A busca de casos exibe no máximo 100 registros; tenants, no máximo 200. Paginação/exportação/filtros de data ficam para expansão do painel.
- Publicar configuração não ativa telefonia. A entrega não recebe nem origina chamada, não envia SMS e não cria cobrança.

## Sequência seguinte

1. Escolher ElevenLabs Agents ou Realtime após prova de voz com dados sintéticos; confirmar privacidade, custos e controle de ferramentas.
2. Disponibilizar endpoint HTTPS/WSS de staging, número Twilio e celulares autorizados; provar assinatura e callback.
3. Implementar e testar stream/agent adapter, outbox/fila e configuração capturada no início da chamada.
4. Verificar plantão por código SMS, provar transferência/fallback e entrega de resumo sem duplicação.
5. Implementar planos/Asaas sandbox após decisões comerciais; validar retenção e operação antes do piloto.
