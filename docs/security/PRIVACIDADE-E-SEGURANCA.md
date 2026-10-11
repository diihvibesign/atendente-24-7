# Privacidade e segurança

Este documento é uma linha de base técnica, não parecer jurídico. Validar os papéis de controlador e operador, bases legais, avisos, consentimentos e transferências internacionais com assessoria especializada antes do piloto.

## Dados e minimização

O atendimento pode conter dados pessoais e informações sobre luto e circunstâncias da morte. Tratar todos os registros de caso como confidenciais e limitar a coleta ao retorno e ao encaminhamento.

- Gravação de áudio desativada por padrão.
- Transcrição completa desativada por padrão. Persistir respostas estruturadas essenciais, estado da chamada e observações objetivas mínimas.
- Informar no começo da ligação que se trata de assistente digital e como as informações serão usadas para encaminhar o atendimento.
- Alertas por SMS contêm o mínimo necessário; preferir ID do caso e link seguro. Nunca enviar transcrição, localização detalhada ou conteúdo íntimo em SMS.
- Não usar conteúdo para treinar modelo, marketing ou análise emocional.

## Controles

- TLS em trânsito e criptografia gerenciada em repouso; avaliar criptografia por campo para dados de maior risco.
- MFA para administradores, privilégio mínimo, rotação de segredo e acesso temporário a suporte.
- Segregação por tenant validada no servidor e, se viável, reforçada com RLS no banco.
- Auditoria de visualização/alteração administrativa com ator, tenant, motivo e horário, sem registrar conteúdo sensível.
- Retenção por categoria definida antes do piloto; rotina automatizada de exclusão e processo para solicitações de titulares.
- Plano de incidente com contenção de acesso, preservação de evidência, avaliação e comunicação conforme prazos aplicáveis.
- Revisão de suboperadores de telefonia, IA, SMS, hospedagem e pagamentos: região, DPA, retenção, uso para treino, subprocessadores e exclusão.

## Resposta a falhas

Falha de IA, rede ou fila deve gerar uma rota de contingência humana configurada e alerta operacional. Não reproduzir informação de uma chamada anterior como fallback. Se não houver rota humana disponível, o sistema deve declarar a limitação de modo honesto e coletar apenas um contato de retorno, se a pessoa aceitar.

## Antes do piloto

Confirmar avaliação de impacto e base legal aplicável; texto do aviso verbal; retenção e descarte; fluxo de direitos do titular; termos dos fornecedores; contatos de plantão; plano de continuidade; e limites de conteúdo em SMS. A implantação no Brasil pode envolver transferência internacional e dados de terceiros, então revisar contratos e configurações de região antes de enviar chamadas reais.
