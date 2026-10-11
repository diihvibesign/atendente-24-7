# Alternativas para conversa por voz

Twilio é o fornecedor de telefonia escolhido. O serviço que conduz a conversa ainda é uma decisão aberta. OpenAI Realtime não é requisito obrigatório da fundação. ElevenLabs Agents é um candidato para começar com mais componentes gerenciados.

| Opção                                    | O que entrega                                         | Consequência para o projeto                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ElevenLabs Agents com Twilio             | Plataforma de conversa com agente e integração Twilio | Menos trabalho com a sessão de áudio; validar ferramentas, transferência, eventos assinados, isolamento por agente e retenção no fornecedor |
| OpenAI Realtime com Twilio Media Streams | Modelo de conversa por voz em tempo real              | Aplicação controla bridge de áudio, estado, interrupções e ferramentas; maior trabalho inicial de integração                                |
| ElevenLabs apenas como TTS               | Geração de fala                                       | Não conduz a conversa sozinho; exige STT, modelo de linguagem e orquestração adicionais                                                     |

O SDK oficial da ElevenLabs confirma `conversationalAi.twilio.registerCall`: recebe agente e parâmetros da chamada e retorna TwiML para conectar a ligação. Isso permite avaliar uma arquitetura em que nossa API valida o webhook Twilio e resolve o tenant antes de delegar o áudio ao agente. Também há importação de números Twilio e API de chamadas outbound. Essas capacidades não comprovam por si só a disponibilidade de número brasileiro ou uma transferência segura em celular brasileiro.

Fontes examinadas em 11/10/2026: [referência do SDK oficial](https://github.com/elevenlabs/elevenlabs-js/blob/main/reference.md#conversationalai-twilio) e [integração nativa Twilio](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration). O acesso à documentação voltou a funcionar após atualizar a rede do ambiente. A importação nativa reconfigura o número no Twilio: usar número de teste e validar as regras antes de tocar uma linha operacional.

A página de [preços de Agents](https://elevenlabs.io/pricing/agents) informa, sem promoções, Free com 15 minutos, Starter com 75 minutos por US$ 6/mês e Creator com 275 minutos por US$ 22/mês. A documentação informa cobrança de LLM adicional e telefonia Twilio separada. Comparar custo total com número, chamada, agente/LLM, segmentos SMS, transferência, impostos e concorrência; não extrapolar tarifas de TTS avulso para Agents.

Recomendação para a fase 2: prova curta de ElevenLabs Agents + Twilio e comparação com Realtime usando o mesmo roteiro sintético. Ainda não foi escolhido nem conectado um agente.

## Gates da escolha

- Voz pt-BR inteligível, calma, sem fingir atendente humano, com uma pergunta por vez.
- Interrupção, silêncio, recusa, nomes difíceis e pedido explícito de humano.
- Regras de transferência avaliadas no backend; ferramenta do agente pede ação, não decide política nem confirma conexão.
- Webhooks autenticados e eventos idempotentes; agent ID e tenant derivados no servidor.
- Resultado da transferência confirmado pela telefonia, com fallback testado e SMS sem duplicação.
- Configuração por tenant isolada, versão capturada no início da chamada e timeout operacional.
- Gravação/transcrição/retenção no fornecedor revisadas e configuradas; desligar armazenamento no nosso banco não desliga retenção externa.
- Medir latência e custo em chamadas autorizadas. Não divulgar superioridade de voz, preço ou latência sem medições.

`ELEVENLABS_API_KEY` foi incluída como requisito para a prova de voz. `VOICE_AI_API_KEY` poderá ficar vazia enquanto OpenAI não for usado. Não é necessário contratar os dois fornecedores antes da avaliação. Veja o [passo a passo da chave e escolha da voz](../engineering/ELEVENLABS-SETUP.md).
