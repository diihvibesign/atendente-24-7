# ADR 0001: stack inicial do MVP

- **Status:** proposta para o MVP
- **Data:** 2026-10-11

## Contexto

O produto combina um painel multiempresa, webhooks de telefonia, mídia de voz em tempo real, filas de notificações e cobrança recorrente. O primeiro ciclo precisa permitir validar a jornada com poucas partes operacionais e manter os fornecedores substituíveis.

## Decisão

Adotar TypeScript estrito num monorepo pnpm. Usar Next.js para os painéis e Fastify num processo separado para API, webhooks e sessões de voz. Usar PostgreSQL gerenciado como fonte de verdade e Redis/BullMQ para filas e estado efêmero. Integrar telefonia, IA de voz, SMS e pagamentos por interfaces de adaptador.

## Consequências

- O MVP mantém um único domínio de negócio e dois processos implantáveis, sem introduzir microsserviços.
- WebSocket e tráfego de telefonia não dependem do runtime do painel.
- Regras de negócio podem ser exercitadas sem os SDKs dos fornecedores.
- A escolha de provedores e região continua pendente de validação de cobertura brasileira, latência, custo, proteção de dados e termos de uso.
- Essa stack ainda não foi instalada ou executada porque o repositório não contém aplicação; a primeira implementação deve confirmar versões suportadas e registrar lockfile.

## Revisão

Revisar após o piloto ou se limites medidos de concorrência, custo ou disponibilidade exigirem outra arquitetura.
