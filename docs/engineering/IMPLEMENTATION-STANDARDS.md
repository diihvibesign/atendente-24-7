# Padrões de implementação

## Estrutura sugerida

```text
apps/
  web/                 # Next.js: painel admin e painel da funerária
  api/                 # Fastify: REST, webhooks, telefonia e eventos
packages/
  contracts/           # schemas de entrada/saída e tipos compartilhados
  domain/              # regras puras, estados e políticas
  integrations/        # interfaces e adaptadores de fornecedores
  config/              # validação central de configuração
docs/
```

Não criar todos os pacotes de antemão. Extrair módulos quando houver uma fronteira concreta; manter regras de negócio independentes do framework.

## Regras de código

- TypeScript estrito; validar entradas externas em runtime com schemas (ex.: Zod ou equivalente) antes de usar tipos.
- Separar camadas de rota, aplicação, domínio e persistência. Domínio não importa Next.js, Fastify nem SDKs.
- Usar UTC no banco e converter para o fuso configurado pela funerária (padrão inicial `America/Sao_Paulo`) na interface. Testar horário de verão/fusos de municípios quando aplicável.
- Valores monetários em centavos inteiros e moeda explícita (`BRL`); nunca usar `float` para dinheiro.
- Identificadores opacos; não colocar nome, telefone ou outros dados pessoais em URLs, logs, métricas ou IDs de fila.
- Erros externos devem ser normalizados em códigos internos estáveis; não enviar stack traces ou detalhes de fornecedores ao cliente.
- Toda alteração de schema é uma migração revisável. Usar transações e plano de reversão compatível quando necessário.

## Acesso e multi-tenancy

- Resolver o tenant no servidor a partir da sessão autenticada, nunca confiar num `tenant_id` arbitrário enviado pelo navegador.
- Aplicar `tenant_id` em toda tabela pertencente a cliente e em toda consulta. Avaliar Row Level Security como defesa adicional.
- Cobrir autorização no serviço, não só escondendo botões no frontend.
- Aplicar MFA para `admin`, sessão curta e auditoria de ações privilegiadas.
- Acesso de suporte a conteúdo de chamadas exige motivo, permissão específica e trilha de auditoria.

## API, webhooks e tarefas

- Versionar APIs públicas e esquemas de eventos.
- Validar assinatura, timestamp e tamanho do corpo dos webhooks; limitar taxa e rejeitar replay fora da janela aceita.
- Deduplicar eventos com chave do provedor e gravar idempotência na mesma transação da mudança de estado.
- Responder ao webhook rapidamente; processar SMS, e-mail e trabalho pesado em fila.
- Retentativas com backoff e jitter, limite, fila de falhas e operação documentada de reprocessamento.
- Não considerar uma chamada transferida ou SMS enviado até haver confirmação do fornecedor; modelar estados pendentes e falhos.

## Observabilidade e entrega

- Logs estruturados com `request_id`, `call_id` opaco, tenant opaco e código do evento. Redigir telefone, nomes, conteúdo de fala, tokens e payloads.
- Métricas: latência de atendimento, falhas de webhook, transferência, fila, alertas, uso de IA e custo por chamada. Evitar rótulos de alta cardinalidade e dados pessoais.
- Traços distribuídos devem propagar IDs, não transcrições.
- Segredos apenas no gerenciador de segredos. Versionar `.env.example` sem valores reais quando o app existir.
- CI deve executar lint, formatação, checagem de tipos, migrações em banco efêmero e testes relevantes antes do deploy. Os testes de autorização devem provar isolamento entre dois tenants.
- Deploy gradual com health checks, rollback e procedimento manual de fallback para atendimento humano.

## Decisões

Registrar decisões relevantes em `docs/architecture/decisions/NNNN-titulo.md`: contexto, opções, decisão, consequências, riscos e data. Mudanças em dados, fornecedores, retenção ou prompts exigem revisão dos documentos de privacidade e voz.
