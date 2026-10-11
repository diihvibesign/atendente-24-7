# PRD de implementação — Atendente 24/7

- **Versão:** 1.0
- **Status:** base aprovada para iniciar o MVP; integrações e regras comerciais ainda precisam ser validadas
- **Data:** 11/10/2026
- **Produto:** plataforma SaaS de atendimento telefônico para funerárias independentes no Brasil

Este documento transforma a visão do produto em requisitos verificáveis de implementação. Deve orientar design, código, operação, testes e piloto. Ele complementa [o PRD de visão](PRD.md), [a stack](../architecture/STACK.md), [o padrão de implementação](../engineering/IMPLEMENTATION-STANDARDS.md), [a política de voz](../ai/VOICE-ASSISTANT.md), [recorrência e cache](../billing/RECORRENCIA-E-CACHE.md) e [privacidade e segurança](../security/PRIVACIDADE-E-SEGURANCA.md).

## 1. Objetivo do produto

Atender imediatamente chamadas recebidas pela funerária, inclusive fora do horário comercial; acolher quem liga sem simular uma pessoa; coletar informações operacionais com delicadeza; transferir casos que satisfaçam regras de urgência configuradas; e fornecer à equipe humana um resumo útil para retorno.

O sistema apoia a equipe e não substitui decisões humanas, médicas, legais ou comerciais. Estatísticas de mercado, valores de serviço e alegações de retorno sobre investimento ainda são hipóteses e não devem aparecer como fatos em mensagens comerciais sem validação.

## 2. Metas e medidas

Metas iniciais para o piloto, sujeitas a ajuste com dados reais:

| Meta                           | Medida                                                                                        | Alvo inicial                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Atender chamadas válidas       | Chamadas atendidas pela plataforma / chamadas recebidas no número configurado                 | ≥ 99% por mês, excluindo indisponibilidade da operadora e manutenção anunciada |
| Começar a saudação rapidamente | Tempo entre webhook válido da Twilio e início de áudio, p95                                   | ≤ 3 s                                                                          |
| Transferir com segurança       | Transferências solicitadas que chegam ao destino ou entram no fallback, com estado confirmado | 100% com resultado explícito; nunca declarar sucesso sem confirmação           |
| Alertar a funerária            | Tempo do encerramento/escalação ao aceite do provedor SMS, p95                                | ≤ 60 s                                                                         |
| Proteger dados entre clientes  | Incidentes de leitura ou alteração entre tenants                                              | Zero                                                                           |
| Manter transparência           | Chamadas em que o assistente se identifica como digital e não inventa confirmação             | 100% nas avaliações do piloto                                                  |

Latência de operadora, disponibilidade de rede móvel e tempo de resposta do modelo não são controlados integralmente pela plataforma. Medir cada trecho separadamente e não prometer disponibilidade superior à contratada dos fornecedores.

## 3. Usuários e permissões

O produto tem somente dois papéis de acesso:

- **`admin` da plataforma:** cria e administra contas de funerárias, planos, acesso de suporte, integração e operações globais. Acessar conteúdo de casos exige motivo, permissão específica e auditoria.
- **`user` da funerária:** consulta e atualiza apenas dados da própria empresa; configura contatos, horários, regras e alertas; acompanha casos e assinatura.

O contato de plantão não precisa de conta no MVP. Ele recebe chamadas transferidas e alertas SMS para um número verificado pelo `user`. Não criar um terceiro papel público de acesso.

## 4. Escopo do MVP

### Incluído

- Autenticação de usuários e sessões seguras.
- Gestão de tenants, usuários, planos e auditoria pelo `admin`.
- Isolamento de dados por funerária e gestão de configuração pelo `user`.
- Associação de um ou mais números Twilio à funerária, sujeita à disponibilidade de número e regras brasileiras.
- Atendimento de chamadas inbound via Twilio Programmable Voice e áudio bidirecional por Media Streams.
- Assistente em português brasileiro conectado a um serviço de voz em tempo real; OpenAI Realtime é o candidato inicial, atrás de adaptador.
- Coleta estruturada, regras determinísticas de escalonamento e transferência para número de plantão.
- Criação de caso, resumo operacional por SMS para contato verificado e painel de acompanhamento.
- Planos e estado de assinatura; faturamento recorrente em sandbox via Asaas como candidato inicial, atrás de adaptador.
- Medição de minutos e custos por tenant, alertas operacionais, exportação básica de casos e política de retenção.

### Fora do MVP

- Gravação de áudio ou armazenamento integral de transcrições por padrão.
- Diagnóstico, aconselhamento médico/jurídico, estimativa de preço, venda automática ou confirmação de disponibilidade de serviços.
- Escolha autônoma de urgência com base em emoção, sotaque, silêncio ou inferência não confirmada.
- Pagamento por minuto extra ou suspensão automática do atendimento telefônico por inadimplência.
- Integrações com hospitais, cartórios ou órgãos públicos.
- Aplicativos móveis nativos, voice cloning, campanha de marketing e treinamento de modelos com chamadas.

## 5. Jornadas principais

### 5.1 Ativar uma funerária

1. `admin` cria tenant, contato administrativo, plano inicial e estado de assinatura.
2. `user` ativa conta, aceita termos e acessa o painel.
3. `user` configura nome público da funerária, número de plantão, horário, condições de transferência, texto de retorno e destinatários de SMS.
4. A plataforma valida telefone em E.164 por código/fluxo aprovado e registra quem pode receber dados de casos.
5. `admin` provisiona ou associa o número Twilio e faz uma chamada de teste, sem dados reais.
6. A plataforma marca a configuração como `ready` só após validar webhook, stream, destino e rota de fallback.

### 5.2 Chamada normal

1. Twilio envia webhook inbound com número chamado e `CallSid`.
2. API valida a assinatura, deduplica o evento e associa o número ao tenant. Responde rapidamente com instrução TwiML para iniciar Media Stream.
3. O assistente se identifica como digital, explica o uso das informações e oferece ajuda para avisar a equipe.
4. Faz uma pergunta por vez. A pessoa pode recusar qualquer campo, pedir alguém ou encerrar.
5. O serviço salva respostas estruturadas e eventos da chamada; não grava áudio por padrão.
6. O assistente informa o próximo passo configurado sem prometer horário não garantido.
7. A API encerra a chamada, cria/atualiza caso e envia o resumo operacional ao número de plantão.
8. `user` recebe alerta e acompanha o caso no painel para retornar a ligação.

### 5.3 Pedido urgente e transferência

1. O assistente identifica pedido explícito de atendimento humano ou resposta afirmativa a uma pergunta operacional configurada, como pedido imediato de um hospital.
2. API avalia a regra publicada do tenant, horário, destino e disponibilidade; o modelo não decide sozinho.
3. O sistema tenta conectar a pessoa ao contato prioritário e registra `transfer_started`.
4. Só marca `connected` se Twilio confirmar conexão. Se ocupado, sem resposta, timeout ou falha de rede, executa a rota de fallback e informa claramente à pessoa o resultado.
5. Envia alerta prioritário com o resultado e um caso para retorno.

Condições padrão configuráveis: pedido explícito de pessoa; chamada originada/identificada como hospital se a integração permitir; ou resposta clara de que o hospital solicitou atendimento imediato. Não inferir emergência pela voz ou pelo tom emocional.

### 5.4 Inadimplência e cancelamento

O sistema notifica o `user`, registra eventos de cobrança e aplica regras de acesso ao painel. Não desativa chamadas silenciosamente. Qualquer suspensão de telefonia exige aviso, confirmação da rota de contingência e ação auditada. Período de carência, reembolso, impostos e retenção pós-cancelamento são decisões comerciais/jurídicas a confirmar antes de cobrar clientes.

## 6. Requisitos funcionais e critérios de aceite

### Identidade, empresas e administração

- **AUTH-01 (P0):** `user` entra, encerra sessão e recupera acesso. Sessões têm expiração, cookies seguros e proteção contra tentativas repetidas.
- **AUTH-02 (P0):** `admin` usa MFA e ações privilegiadas são auditadas.
- **TEN-01 (P0):** cada registro de cliente pertence a um `tenant_id`; o servidor deriva o tenant da sessão e ignora tenant arbitrário enviado pelo navegador.
- **TEN-02 (P0):** usuários de empresas A e B não conseguem ler, alterar, enumerar ou exportar dados cruzados, inclusive IDs conhecidos.
- **ADMIN-01 (P0):** `admin` cria, edita, desativa e consulta estado operacional de tenants, sem acesso padrão ao conteúdo de conversas.
- **USER-01 (P0):** `user` convida e revoga outros usuários da própria funerária, todos sob o mesmo papel `user`.
- **ADMIN-02 (P1):** suporte privilegiado a casos exige justificativa, duração limitada e trilha de auditoria.

### Configuração de atendimento

- **CFG-01 (P0):** `user` configura nome público, horário local, calendário de exceções, número/contato de plantão, tentativa máxima, timeout, texto de fechamento e regras de transferência.
- **CFG-02 (P0):** configuração é validada antes de publicação; não aceitar destino sem confirmação ou formato válido.
- **CFG-03 (P0):** mudanças são versionadas. Chamada ativa continua usando a versão capturada no início; novas chamadas usam versão publicada.
- **CFG-04 (P1):** `user` pode testar pronúncia e texto sem originar chamada real.

### Telefonia Twilio

- **TEL-01 (P0):** webhook inbound valida `X-Twilio-Signature`, método, URL pública e corpo conforme especificação Twilio. Rejeita assinatura inválida.
- **TEL-02 (P0):** `CallSid`/ID do evento são idempotentes; reentrega não cria chamadas ou casos duplicados.
- **TEL-03 (P0):** número Twilio ativo mapeia para exatamente um tenant. Número desconhecido recebe tratamento de fallback e dispara alerta sem expor dados de outro cliente.
- **TEL-04 (P0):** API responde ao webhook dentro do orçamento de latência e inicia Media Streams bidirecional.
- **TEL-05 (P0):** stream valida conexão Twilio, estado da chamada, limite de duração e associação ao tenant; chamadas concluídas encerram recursos e conexões.
- **TEL-06 (P0):** transferência termina ou pausa o stream e conecta com o número de plantão. A implementação deve confirmar o comportamento TwiML/API em chamada de teste antes do piloto.
- **TEL-07 (P0):** callbacks de status registram ringing, in-progress, completed, busy, no-answer, failed e duração de cobrança sem sobrescrever estado terminal por evento atrasado.
- **TEL-08 (P1):** monitorar uso de minutos, falhas por operadora e custo estimado por tenant.

### Assistente de voz e casos

- **AI-01 (P0):** primeira fala informa que é assistente digital da funerária.
- **AI-02 (P0):** uma pergunta por vez; aceita silêncio, recusa, interrupção e pedido de humano sem pressionar.
- **AI-03 (P0):** não fornece preços, promessas, disponibilidade, diagnóstico, orientação jurídica ou confirmação de ação sem evidência de sistema.
- **AI-04 (P0):** coleta dados em campos estruturados: nome e telefone para retorno; nome da pessoa falecida; local atual; relação, cerimônia e urgência somente quando relevantes e voluntariamente informados.
- **AI-05 (P0):** cada campo registra `known`, `declined`, `unknown` ou `not_asked`; valor inferido não é apresentado como confirmado.
- **AI-06 (P0):** ferramenta do modelo não executa SQL, não envia SMS diretamente e não altera regra/assinatura. A API valida tenant, estado e ação permitida.
- **CASE-01 (P0):** caso possui número opaco, tenant, chamada, status, prioridade, dados mínimos, timestamps, versão da configuração e resultado do alerta/transferência.
- **CASE-02 (P0):** `user` vê lista recente, abre detalhe, marca contato realizado e registra notas operacionais sem alterar logs imutáveis.
- **CASE-03 (P1):** filtros por status, data e prioridade e exportação CSV com permissão e auditoria.

### Alertas SMS

- **SMS-01 (P0):** destinatário é número verificado e habilitado pelo `user`; alterações de destinatário exigem nova validação.
- **SMS-02 (P0):** após salvar o caso, envia resumo estruturado de atendimento: nome/contato de quem ligou, pessoa falecida, local informado, necessidade declarada e status de transferência. Não envia áudio ou transcrição integral.
- **SMS-03 (P0):** mensagem longa inclui link autenticado do caso; não colocar conteúdo clínico ou detalhes íntimos desnecessários no link ou em logs do provedor.
- **SMS-04 (P0):** registra `queued`, `sent`, `delivered`, `failed` quando disponível; falha tenta canal alternativo configurado e cria alerta operacional.
- **SMS-05 (P0):** envio é idempotente e tem retentativa limitada; não enviar mensagens duplicadas em reprocessamento.
- **SMS-06 (P1):** `user` define contato secundário e prioridade; limites e custos por segmento são visíveis.

### Planos e cobrança

- **BILL-01 (P0):** planos têm versão, moeda BRL, preço em centavos, ciclo, limites e recursos incluídos.
- **BILL-02 (P0):** assinatura pertence a tenant e mantém histórico de eventos, ciclo atual, próxima cobrança e status do provedor.
- **BILL-03 (P0):** webhooks Asaas em sandbox têm autenticação, idempotência, fila/outbox e reconciliação; estado do navegador não é autoridade de pagamento.
- **BILL-04 (P0):** entitlements são validados no servidor. Mudança de plano registra aceite e data de vigência.
- **BILL-05 (P0):** falha de pagamento gera aviso e estado `past_due`, sem desligar chamada por automação silenciosa.
- **BILL-06 (P1):** `admin` consulta assinatura, pagamentos, uso e falhas de webhook sem ver credenciais ou dados de cartões.
- **BILL-07 (P1):** preços, trial, carência, cancelamento, reembolso, boleto/Pix/cartão e nota fiscal são configuráveis após aprovação comercial.

### Auditoria e operação

- **AUD-01 (P0):** registrar login privilegiado, alteração de tenant/configuração/plano/contato, acesso de suporte, transferência e ação manual sobre caso.
- **OPS-01 (P0):** chamadas têm correlação por IDs opacos; logs não incluem áudio, transcrição, telefone ou nomes.
- **OPS-02 (P0):** fila de eventos falhos pode ser inspecionada e reprocessada por `admin` com auditoria, sem duplicar cobrança/alertas.
- **OPS-03 (P0):** painel operacional mostra saúde de Twilio, IA, SMS, fila e banco sem expor conteúdo sensível.
- **OPS-04 (P1):** alertas por indisponibilidade, timeout de stream, fila crescente, alta taxa de transferência falha, custo anormal e falha de pagamento.

## 7. Regras de conversa e escalonamento

- Assistente se apresenta como digital em toda chamada e não imita voz humana específica.
- Consentimento/aviso verbal informa que a chamada é atendida por assistente digital e que os dados serão usados para encaminhar o atendimento.
- Não exigir que a pessoa conte como ocorreu o falecimento. Não insistir em campos desconhecidos.
- Priorizar pedido explícito para falar com uma pessoa. As outras regras dependem de configuração aprovada pela funerária.
- A resposta do modelo é uma proposta estruturada; regras no backend validam valores permitidos e realizam transferência.
- Se o modelo, a rede ou o serviço de telefonia falhar, encerrar com uma instrução verdadeira e tentar alertar o plantão. Não reproduzir informações de outra chamada.
- Definir e revisar mensagens de contingência e contatos de emergência antes de qualquer piloto real.

## 8. Dados e modelo lógico

Entidades mínimas:

- `Tenant`: empresa, nome público, status, timezone, número(s) associado(s), timestamps.
- `User`: identidade, tenant, papel `admin|user`, status de MFA e timestamps.
- `Plan` / `PlanVersion`: moeda, preço, ciclo, limites e recursos.
- `Subscription` / `BillingEvent`: tenant, provedor, IDs externos, ciclo, estado, eventos idempotentes.
- `RoutingConfigVersion`: horários, contatos verificados, condições, timeout, tentativas e fallback.
- `Call`: `call_id` interno opaco, `CallSid`, tenant, estado, início/fim, resultado, versão de config e custo estimado.
- `Case`: campos estruturados, estado, prioridade, resumo, retorno humano, status de notificação.
- `Notification`: canal, destinatário mascarado, estado do provedor, tentativas e ID idempotente.
- `AuditEvent`: ator, tenant, ação, motivo quando necessário e timestamp.

Todas as entidades de cliente incluem `tenant_id`, quando aplicável, e índices compostos começam por tenant. Usar constraints para evitar relação de caso/chamada entre empresas diferentes. Segredos de provedor não são colunas de texto em `Tenant`; manter referências em armazenamento de segredos. Não persistir áudio bruto nem transcrição completa por padrão.

## 9. Interfaces de API e eventos

Rotas iniciais sugeridas; contrato final deve ser versionado e validado por schemas:

- `POST /webhooks/twilio/voice/inbound` — valida assinatura, associa número, cria estado idempotente e retorna TwiML.
- `POST /webhooks/twilio/voice/status` — atualiza estado de chamada e entrega conforme eventos do provedor.
- `GET /ws/twilio/media` — WebSocket bidirecional autenticado e amarrado ao estado da chamada.
- `POST /webhooks/asaas/events` — valida autenticação, registra evento e responde rapidamente.
- `GET /api/v1/cases` / `GET /api/v1/cases/:id` / `PATCH /api/v1/cases/:id` — acesso autenticado e tenant-scoped.
- `GET /api/v1/tenant/settings` / `PATCH /api/v1/tenant/settings` — leitura e publicação versionada de configurações.
- `GET /api/v1/admin/tenants` / `POST /api/v1/admin/tenants` — acesso exclusivo `admin` e auditoria.

Webhooks devem confirmar recebimento rapidamente e delegar processamento a uma fila/outbox. Validar tamanho de payload, assinatura, timestamp, replay, limites de taxa e origem. Nunca confiar em campo de tenant vindo de webhook sem associação com número/conta previamente validada.

## 10. Integrações e ferramentas

| Integração                                | Decisão para o MVP                                                                          | Necessidade de conexão                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Twilio Programmable Voice + Media Streams | Escolhido para chamadas do piloto                                                           | Conta Twilio, Account SID, Auth Token, número brasileiro/DDD e telefone de plantão para testes                        |
| OpenAI Realtime                           | Candidato inicial para voz; validar qualidade, latência, voz em pt-BR e tratamento de dados | Conta/API key de desenvolvimento. Usar adaptador para permitir troca                                                  |
| Asaas                                     | Candidato para cobrança recorrente brasileira; começar no sandbox                           | Conta sandbox e chave de API; validar meios de pagamento, webhooks e políticas antes de produção                      |
| PostgreSQL + Redis                        | Necessários para estado durável e eventos/fila                                              | Desenvolvimento local via Docker; host gerenciado e credenciais só na fase de staging                                 |
| Hospedagem com WebSocket público          | Necessária para Twilio alcançar webhook HTTPS e stream WSS                                  | Selecionar host e URL TLS antes do primeiro teste de chamada real                                                     |
| E-mail transacional                       | Não bloqueia fluxo de chamada; necessário para recuperação de acesso e avisos de cobrança   | Selecionar fornecedor na fase de onboarding; não pedir credenciais antes disso                                        |
| Notion                                    | Destino desejado para documentação                                                          | O conector não está exposto como ferramenta nesta execução; documentos permanecem locais até ser possível sincronizar |
| GitHub                                    | Repositório atual já está associado à tarefa                                                | Usuário autorizou atualizações diretas no repositório ao iniciar a implementação                                      |

Valores de API devem ser inseridos somente nas configurações seguras do ambiente, nunca no chat, PRD, `.env` versionado ou logs. `VOICE_AI_API_KEY` é o nome interno proposto para a chave do provedor de voz, evitando nomes reservados pelo ambiente. Segredos de desenvolvimento e produção devem ser separados.

## 11. Requisitos não funcionais

- **Disponibilidade:** executar API/stream em processo de longa duração com suporte a WebSocket; não depender de função serverless que encerra conexões de mídia.
- **Escala:** múltiplas instâncias devem compartilhar estado durável; afinidade de chamadas deve ser explícita ou reconstruível.
- **Resiliência:** timeouts por provedor, limite de tentativas, backoff com jitter, circuit breaker e rota humana de contingência.
- **Integridade:** estados de chamada são transições permitidas; webhook repetido ou fora de ordem não reabre chamada concluída.
- **Segurança:** TLS, cookies seguros, MFA para `admin`, mínimo privilégio, rate limiting, rotação de segredos e auditoria.
- **Privacidade:** minimização e retenção configurável; sem áudio/transcrição padrão; explicar suboperadores e destino de dados antes de chamadas reais.
- **Acessibilidade:** painel responsivo, navegação por teclado, contraste e formulários compatíveis com tecnologias assistivas.
- **Idioma:** painel e assistente em português brasileiro no MVP; timezone por tenant, padrão `America/Sao_Paulo`.
- **Auditoria:** eventos financeiros e administrativos imutáveis em relação a alterações comuns; correções são novos eventos.
- **Observabilidade:** logs estruturados sem PII, métricas por etapa e rastreamento com IDs opacos.

## 12. Segurança, consentimento e retenção

- Exibir e dizer que a chamada usa assistente digital; informar finalidade operacional antes de coletar dados.
- Mapear controlador, operador, base legal, suboperadores e transferências internacionais com assessoria de LGPD antes do piloto.
- Coletar o mínimo suficiente para retorno. Não solicitar CPF, pagamento, endereço residencial ou narrativa do falecimento.
- Resumo SMS enviado apenas a contato verificado do cliente, com dados operacionais necessários e sem áudio/transcrição. Oferecer link autenticado para detalhes adicionais.
- Criptografar transporte e armazenamento, mascarar telefone em logs e métricas e restringir acesso de suporte.
- Definir prazos de retenção por categoria e processo de exclusão/solicitação de titular antes de importar casos reais.
- Red team de prompts, isolamento entre tenants, validação de webhooks, replay, permissões e falha de fornecedor antes do piloto.

## 13. Dependências, bloqueios e decisões a fechar

1. Conectar credenciais de sandbox de Twilio e serviço de voz; selecionar um número de teste e um telefone de plantão.
2. Confirmar número local, DDD, portabilidade, preço final, transferência para celular e disponibilidade SMS na conta Twilio.
3. Validar se OpenAI Realtime atende latência, interrupção de fala, qualidade de português e requisitos contratuais; manter o código independente do fornecedor.
4. Criar app público de staging com HTTPS/WSS, PostgreSQL e Redis; testar fluxo sem dados reais.
5. Confirmar condições de assinatura, preços, limites, carência, cancelamento e gateway de cobrança antes de ativar Asaas.
6. Definir contatos de plantão e regras de urgência reais com funerárias piloto.
7. Obter revisão jurídica de aviso verbal, base legal, SMS, retenção e contratos com fornecedores.
8. Disponibilizar ferramenta Notion nesta execução para mover a documentação ao local solicitado.

## 14. Plano de entrega

### Fase 0 — validação operacional

Revisar jornada, textos, regras de urgência, números brasileiros, custos e consentimento com uma funerária parceira. Provar uma chamada Twilio de teste e transferência manual.

### Fase 1 — fundação do produto

Monorepo TypeScript, autenticação, papéis, tenants, migrações, auditoria, configuração de tenant, layouts admin/user e ambiente local Docker.

### Fase 2 — telefonia e conversa

Webhooks assinados, idempotência, WebSocket Twilio, integração Realtime por adaptador, coleta estruturada, interrupção, encerramento e fluxo de fallback.

### Fase 3 — despacho humano

Regras de transferência, tentativas/timeout, status confiável de chamada, criação de caso, SMS resumo e painel operacional.

### Fase 4 — planos e cobrança

Planos versionados, entitlements, medição por tenant, webhooks Asaas sandbox, reconciliação e experiência de inadimplência segura.

### Fase 5 — piloto e produção

Revisão LGPD/contratos, alertas, backups, SLOs, testes com números autorizados, suporte operacional e publicação gradual.

## 15. Critério de pronto para piloto

O piloto só começa quando: isolamento de tenants foi demonstrado; webhook e assinatura são validados; chamadas são atendidas e encerradas corretamente; transferência e fallback foram testados em celular brasileiro; falha do modelo não deixa a pessoa sem próximo passo; SMS chega ao número verificado sem duplicação; gravação permanece desativada; logs não expõem dados; consentimento e retenção foram revisados; suporte humano e operação noturna têm responsável definido.

## 16. Decisões comerciais ainda abertas

Não definir valores de plano com base em comparações em dólares ou médias de serviços funerários não validadas no Brasil. Fazer entrevistas e modelar custo real por chamada: operadora, número, stream, IA, SMS, impostos, suporte e chamadas transferidas. Só então fechar limites de minutos, margem, preço, período de cobrança e política de excedentes.
