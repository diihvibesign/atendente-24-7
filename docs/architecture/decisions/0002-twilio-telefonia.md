# ADR 0002: Twilio para telefonia no piloto

- **Status:** escolhido para o piloto; implementação pendente
- **Data:** 2026-10-11

## Contexto

O MVP precisa receber chamadas no Brasil, conectar áudio da ligação a um assistente de voz em tempo real e transferir a chamada ao plantonista segundo regras do servidor. A primeira escolha deve permitir validar a jornada sem impedir a troca futura de operadora.

## Decisão

Usar Twilio Programmable Voice para chamadas do piloto e Twilio Media Streams para entregar e receber áudio em tempo real via WebSocket. Implementar a integração atrás de um adaptador próprio. O uso de Twilio SMS para alertas fica pendente de uma decisão e validação de preços separadas.

## Evidência de seleção

- A [página de preços de voz no Brasil](https://www.twilio.com/en-us/voice/pricing/br) apresenta tarifas específicas: recebimento em número local a US$ 0,0100/min, número local a US$ 4,25/mês, chamada de saída local a US$ 0,0310/min e saída para celular a US$ 0,0663/min. A página informa preços atualizados em agosto de 2026.
- A [documentação de Media Streams](https://www.twilio.com/docs/voice/media-streams) descreve mídia em tempo real por WebSocket, inclusive áudio bidirecional para aplicações externas.
- A tarifa publicada para Media Streams é US$ 0,0044/min. Como referência, uma chamada de entrada com streaming soma US$ 0,0144/min de telefonia e streaming, antes do custo do modelo de voz, tributos e transferência para um celular.

## Consequências e validações pendentes

- A referência de custo está em USD e pode variar com impostos, câmbio, cidade/DDD, destino da chamada e uso de recursos adicionais.
- Confirmar elegibilidade e disponibilidade de número local brasileiro para cada cliente, portabilidade, caller ID e capacidade de chamadas simultâneas.
- Testar transferência imediata para celular, comportamento quando não há resposta, latência, interrupções de fala, estabilidade de WebSocket e fallback em falha de IA.
- Confirmar tarifas e entrega de SMS no Brasil antes de usar Twilio como canal de alertas.
- Revisar DPA, suboperadores, retenção de mídia e configurações que mantêm gravação desativada.
- O preço e a capacidade técnica parecem adequados para o piloto, mas ainda não foram confirmados por uma integração executada neste repositório.
