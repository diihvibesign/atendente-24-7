# Requisitos do produto

## Problema

Funerárias independentes têm equipes pequenas e podem deixar chamadas sem resposta durante a noite ou enquanto atendem outra família. O produto pretende atender imediatamente, acolher com respeito e preparar um retorno humano com contexto suficiente.

As estatísticas de ligações fora do horário, valores médios de serviço e retorno sobre assinatura apresentados na hipótese inicial são premissas comerciais, não fatos verificados. Validar por entrevistas, dados de clientes e fontes antes de usá-los em publicidade, precificação ou projeções.

## Usuários e acessos

- **Admin da plataforma (`admin`)**: gerencia contas de funerárias, planos, status de integração e suporte. Acesso a dados de casos deve ser excepcional, justificado e auditado.
- **Usuário da funerária (`user`)**: configura horários, contatos de plantão e regras de encaminhamento; consulta seus casos; atualiza seus dados cadastrais. Só acessa a própria empresa.
- **Pessoa que liga**: não precisa criar conta. Recebe acolhimento por telefone e pode optar por não responder alguma pergunta.

Toda consulta e alteração deve ser limitada ao `tenant_id` da funerária autenticada. Um administrador não deve herdar acesso irrestrito a conteúdo de chamadas por padrão.

## Jornada principal

1. A operadora encaminha a chamada ao número configurado. O webhook valida a assinatura do provedor e cria um identificador idempotente de chamada.
2. O assistente atende, identifica-se como assistente digital da funerária e oferece condolências com linguagem simples e calma.
3. Em ritmo pausado, pede somente os dados relevantes: nome e telefone de retorno, relação com a pessoa falecida se necessário, nome da pessoa falecida, local atual e necessidade declarada de atendimento imediato.
4. Pergunta sobre a cerimônia apenas se isso ajudar o próximo passo. Permite que a pessoa não responda ou peça para falar com alguém.
5. Regras determinísticas da funerária decidem entre transferir para o plantonista ou concluir com expectativa de retorno. A IA não toma essa decisão sozinha.
6. O sistema registra o caso e envia ao plantonista um alerta curto, preferencialmente com identificador e link autenticado. Evitar dados sensíveis no corpo de SMS.
7. A equipe da funerária retorna a ligação e atualiza o caso no painel.

## Escopo do MVP

- Cadastro de funerárias e usuários, autenticação e isolamento por empresa.
- Configuração de número, plantonistas, janela de transferência, horário de retorno e regras explícitas de escalonamento.
- Recebimento de chamada e uma integração de telefonia escolhida após validar disponibilidade, preço e requisitos no Brasil.
- Conversa de voz com coleta estruturada, encerramento respeitoso e transferência conforme regras.
- Registro do caso, alerta ao plantonista e painel de acompanhamento.
- Planos recorrentes, status de assinatura e histórico de eventos de cobrança.
- Auditoria de ações administrativas e trilha operacional da chamada sem gravação padrão.

## Fora do MVP

- O assistente não vende ou recomenda pacotes, não dá estimativas de preço, não confirma disponibilidade de serviços nem promete horário de retorno.
- Sem gravação de chamadas, clonagem de voz, análise emocional, campanhas de marketing ou treino de modelos com dados das famílias.
- Sem automação de remoção/liberação de corpo ou decisões médicas, policiais e legais.
- Sem integrações amplas com hospitais ou órgãos públicos antes de validação jurídica, comercial e técnica.

## Requisitos de qualidade

- Disponibilidade e latência de ponta a ponta devem ser medidas por chamadas sintéticas e métricas de provedor; definir SLOs após piloto.
- Falha de IA não pode impedir a transferência para humano. Aplicar timeout, fallback falado e rota de escalonamento configurada.
- Webhooks externos devem ser autenticados, idempotentes, observáveis e tolerantes a repetição e atraso.
- O sistema deve permitir correção e exclusão conforme política de retenção e solicitações válidas.
- Nenhum caso ou configuração de uma funerária pode ser acessado por outra.

## Métricas do piloto

Medir taxa de atendimento, chamadas concluídas, transferências, casos criados, falhas de integração, tempo até alerta e tempo até retorno humano. Acompanhar abandono e reclamações qualitativas. Não otimizar duração da chamada como objetivo isolado; a qualidade do acolhimento prevalece.

Antes de lançar, validar com diretores e famílias se a coleta soa respeitosa, quais regras realmente definem emergência e qual canal de alerta é aceito.
