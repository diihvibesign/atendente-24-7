# ElevenLabs: chave e primeira avaliação de voz

Verificado na documentação oficial em 11/10/2026. Objetivo: avaliar ElevenLabs Agents com dados sintéticos antes de conectar a telefonia. O adaptador da plataforma ainda não foi implementado; cadastrar a chave não inicia chamadas.

## Criar e guardar a chave

1. Entre na conta e abra [Settings → API Keys](https://elevenlabs.io/app/settings/api-keys).
2. Crie uma API Key com nome `atendente247-desenvolvimento`.
3. Restrinja o escopo aos endpoints de Agents/Conversational AI que a integração utilizar e leitura de Voices. Os rótulos podem variar. Não conceda acesso a outros recursos apenas para resolver um erro de permissão: identifique o endpoint recusado primeiro.
4. Configure uma quota de consumo adequada ao teste. Se configurar expiração, registre a data e planeje rotação; uma chave expirada interrompe a integração.
5. Copie a chave para `ELEVENLABS_API_KEY` nas configurações seguras do ambiente. Localmente, guarde em `.env`, ignorado pelo Git. Reinicie os processos após atualizar. A chave só será lida pelo servidor; não usar prefixo `NEXT_PUBLIC_`.
6. Para produção, prefira uma chave de service account se o plano permitir. A documentação informa que service accounts exigem workspace multi-seat. Uma chave pessoal depende da permanência e das permissões do titular.

Não enviar o valor pelo chat nem adicionar ao repositório. `VOICE_AI_API_KEY` é a alternativa OpenAI e pode ficar vazia durante a avaliação da ElevenLabs. Não é necessário contratar os dois fornecedores.

## Configurar agente, voz e modelo

1. Abra a área [Agents](https://elevenlabs.io/app/agents) e crie um agente de teste.
2. Configure o idioma como Portuguese e determine português brasileiro nas instruções. Não habilite outros idiomas sem necessidade.
3. Em **Agent Voice**, selecione uma voz com sotaque brasileiro. Compare pelo menos três opções com o mesmo texto; idioma português no modelo não garante sotaque brasileiro na voz escolhida.
4. Comece com **V3 Conversational** como modelo de síntese, quando disponível no seletor de Agents. A documentação de Expressive mode indica que esse modelo habilita o modo expressivo e melhora a coordenação dos turnos de fala.
5. Compare com **Flash v2.5** se houver demora nas respostas. O modelo suporta português e a documentação informa síntese de aproximadamente 75 ms, contra aproximadamente 280 ms do V3 Conversational, excluindo rede e aplicação. Medir o tempo total do atendimento; esses números não são um SLO da nossa plataforma.
6. Comece com velocidade `1.0`; compare `0.9` se a voz soar apressada. Configure **Patient** em turn eagerness, nas opções do fluxo da conversa, e avalie se o agente respeita pausas sem gerar silêncios excessivos.
7. Use as regras de [voz e prompts](../ai/VOICE-ASSISTANT.md). Para luto: sem risos, entusiasmo, dramatização ou simulação de choro; uma pergunta por vez; apresentação como assistente digital; sem inventar preços ou afirmar transferência concluída.
8. Teste pelo navegador. Registre o agent ID, voice ID, modelo selecionado, configuração e resultado de cada cenário. Esses IDs são distintos da chave; o agent ID por funerária será resolvido pelo servidor.

Voz é o timbre/sotaque. Modelo de síntese produz o áudio. Modelo de linguagem conduz as respostas. A escolha de voz não substitui a configuração das regras e ferramentas do agente.

A tabela oficial já lista **Eleven v4 Turbo** para síntese em tempo real. A página de Expressive mode ainda nomeia V3 Conversational no seletor, enquanto seus exemplos de API usam `eleven_v4_turbo`. Portanto, não presumir equivalência entre o rótulo do painel e um ID de API. Se V4 Turbo estiver disponível na conta/Agents, incluí-lo na comparação e confirmar a configuração efetivamente salva antes de implementar o adaptador.

## Roteiro de comparação

Texto inicial sintético:

> Olá, você ligou para a Funerária Exemplo. Sou a assistente digital da equipe. Sinto muito pela sua perda. Vou ouvir você com calma e ajudar a entrar em contato com o responsável. Como posso chamar você?

Avalie clareza, sotaque, serenidade, naturalidade e tempo de resposta. Evite escolher apenas pela demonstração curta da biblioteca.

| Cenário                                   | Comportamento esperado                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Pessoa fala devagar, faz pausa e continua | Esperar, sem interromper nem pressionar                                           |
| Pessoa interrompe uma resposta            | Parar de falar e ouvir a nova informação                                          |
| Nome e telefone difíceis                  | Confirmar com cuidado; não adivinhar                                              |
| Pedido de preço                           | Explicar que a equipe humana informa valores                                      |
| Pedido de humano ou remoção urgente       | Solicitar ação ao backend segundo as regras; não anunciar conexão sem confirmação |
| Pessoa recusa fornecer um dado            | Respeitar a recusa e seguir com o mínimo necessário                               |
| Falha de ferramenta ou telefonia          | Usar fallback operacional aprovado, sem prometer ação não executada               |

Uma conversa no navegador avalia voz e comportamento, mas não comprova transferência, fallback, entrega de SMS, isolamento por tenant ou qualidade da ligação telefônica.

## Plano e conexão Twilio

Em 11/10/2026, a página de preços de Agents apresenta Free com 15 minutos, Starter com 75 minutos por US$ 6/mês e Creator com 275 minutos por US$ 22/mês, sem contar promoções. Use a franquia gratuita para a comparação inicial; confirme licença comercial e plano antes do piloto. Uso de LLM e telefonia Twilio têm custos adicionais. Confira os valores novamente na contratação.

Após aprovar a avaliação, usaremos um número Twilio de teste. A [integração nativa](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration) importa um número comprado/provisionado e reconfigura suas definições no Twilio. Caller ID apenas verificado permite saída, mas não recebe chamadas. Não importar a linha operacional da funerária durante a prova.

A documentação recomenda API Key SID/Secret restritos do Twilio para a importação. São diferentes do Auth Token utilizado para validar assinaturas de webhooks da nossa API. O caminho de integração será decidido após provar o controle das regras e dos eventos exigidos pelo PRD.

## Fontes

- [API Keys e restrições](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys)
- [Configuração de voz](https://elevenlabs.io/docs/eleven-agents/customization/voice)
- [Expressive mode e turnos pacientes](https://elevenlabs.io/docs/eleven-agents/customization/voice/expressive-mode)
- [Modelos e latência de síntese](https://elevenlabs.io/docs/overview/models)
- [Preços de Agents](https://elevenlabs.io/pricing/agents)
- [Composição do custo](https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost)
