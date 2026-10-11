# Como obter e configurar as credenciais

Insira valores somente nas configurações seguras do ambiente ou no gerenciador de segredos do host. Não envie pelo chat, não coloque em commits e não copie para documentação. No computador local, `.env` é ignorado e criado com permissão restrita por `pnpm setup:local`. Os processos precisam reiniciar após receber novos valores. Declarar um nome no ambiente não conecta automaticamente um fornecedor.

## Twilio: fornecedor escolhido

1. Crie uma conta em [console.twilio.com](https://console.twilio.com/) e um projeto para o Atendente 24/7.
2. No painel do projeto, copie o **Account SID**, começando com `AC`, para `TWILIO_ACCOUNT_SID`.
3. Revele o **Auth Token** e copie para `TWILIO_AUTH_TOKEN`. Para validar assinaturas, precisamos deste token da conta; API Key SID/Secret não o substituem.
4. Habilite faturamento e verifique a documentação exigida para contratar um número brasileiro com capacidade de voz. Confirme DDD, disponibilidade, permissões geográficas e preço antes de comprar. Credenciais não são suficientes para garantir um número disponível.
5. Em conta trial, verifique os celulares permitidos para testes. Use apenas números de pessoas que concordaram com o teste.
6. Na fase de telefonia, após publicar API HTTPS/WSS, configuraremos o número para o webhook inbound e callbacks. Não cadastrar URL de localhost. Transferência para celular e entrega de SMS terão validação separada.

Custos de números, chamadas, transferências, streams e SMS são cobrados separadamente. Limites e alertas de custo serão definidos antes do piloto. Chaves nunca vão para o frontend.

## IA de voz: candidato OpenAI Realtime

**Opcional enquanto escolhemos o fornecedor.** ElevenLabs Agents também pode conduzir a conversa com Twilio. Veja [alternativas de voz](../architecture/VOICE-PROVIDERS.md); não precisa contratar OpenAI agora.

1. Acesse [platform.openai.com](https://platform.openai.com/) com uma conta autorizada.
2. Crie um projeto dedicado de desenvolvimento. Configure faturamento, orçamento e alertas. Assinatura do ChatGPT não paga o uso da API.
3. Em **API Keys**, crie uma chave do projeto. Se usar permissões restritas, conceda acesso aos endpoints necessários à integração de voz, que será validada na fase 2.
4. Guarde a chave quando for exibida e insira em `VOICE_AI_API_KEY`. Este é o nome interno da aplicação; não é necessário usar um nome reservado com prefixo `OPENAI_`.
5. Validaremos voz pt-BR, latência, interrupção, custos e tratamento de dados antes de escolher o modelo e ativar chamadas reais. Esta fase ainda não usa a chave.

## IA de voz: avaliação com ElevenLabs Agents

Siga o [passo a passo para criar a chave e escolher a voz](ELEVENLABS-SETUP.md). A chave fica em `ELEVENLABS_API_KEY`, já incluída entre os requisitos do ambiente para a avaliação. Haverá um ID de agente por funerária, configurado no servidor. O fornecedor ainda não está integrado. Não importe seu número de produção antes de validar o fluxo e suas regras de transferência.

## Asaas: somente sandbox inicialmente

1. Crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com/), separada da conta de produção.
2. Nas configurações de integrações/API, gere uma chave do sandbox. Os rótulos do painel podem mudar.
3. Insira o valor completo em `ASAAS_API_KEY`, preservando caracteres como `$`. O host do sandbox será `api-sandbox.asaas.com`.
4. Crie seu próprio token para o webhook, com pelo menos 32 bytes aleatórios. Exemplo no terminal:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Insira o resultado em `ASAAS_WEBHOOK_TOKEN`. Não coloque um valor de exemplo ou a chave da API neste campo.
6. O receptor `POST /webhooks/asaas/events` está implementado, desativado por padrão. Após publicar a API HTTPS, configure `ASAAS_WEBHOOK_ENABLED=true`, valide o endpoint e cadastre o webhook no sandbox com o mesmo token no campo de autenticação. Veja [URL, cadastro e teste do Asaas](ASAAS-WEBHOOK-SETUP.md). A rota valida `asaas-access-token` e guarda eventos pendentes; não processa assinaturas ainda. Não cadastre eventos em URL fictícia.
7. Antes de migrar para produção, confirme fornecedor, preços, trial, carência, meios de pagamento e cancelamento. As credenciais de produção precisam ficar em ambiente separado.

## Banco e proteção do MFA

Localmente, rode `pnpm setup:local`, `docker compose up -d --wait` e `pnpm db:migrate`. A chave `MFA_ENCRYPTION_KEY` é gerada automaticamente; os acessos PostgreSQL de desenvolvimento ficam restritos ao loopback. Não use as senhas do Compose fora do desenvolvimento.

Para staging:

1. Escolha PostgreSQL gerenciado e região após avaliação de residência dos dados.
2. Provisione o login `atendente_app` sem superuser, sem `BYPASSRLS` e sem poder criar roles ou bancos. O nome é usado nos grants/policies da migração. Não faça a aplicação dona das tabelas.
3. Insira a URL desse login em `DATABASE_URL`, com TLS validado segundo o provedor. A API recusa superuser e bypass de RLS.
4. Insira uma URL de usuário de migrações em `MIGRATION_DATABASE_URL`, apenas no job de migração. Esse usuário precisa criar o schema e conceder permissões ao login da aplicação. Não entregue essa conexão ao processo web/API de produção.
5. Gere 32 bytes aleatórios em hex para `MFA_ENCRYPTION_KEY`, usando o comando do token de webhook. Guarde no gerenciador de segredos e inclua sua recuperação no plano de backup.
6. Não troque uma chave MFA já utilizada sem migrar os segredos criptografados: os autenticadores existentes deixarão de funcionar. O `.env` local existente é preservado pelo setup.
7. Defina `APP_ORIGIN` com a origem pública HTTPS exata do painel e `API_URL` com o endereço privado da API. Configure `NODE_ENV=production`. Esses nomes são configuração, não segredos.

`TEST_DATABASE_URL` e `TEST_MIGRATION_DATABASE_URL` são exclusivos de testes descartáveis. A suíte exige um banco com nome terminado em `_test` e nunca limpa o banco de desenvolvimento.

## Primeiro administrador e recuperação

O primeiro admin exige senha com pelo menos 12 caracteres e MFA. Forneça `ADMIN_BOOTSTRAP_PASSWORD` temporariamente pelo seu gerenciador de segredos ou terminal seguro e execute `pnpm admin:create seu-email`. O comando guarda o URI de cadastro do autenticador em `.local/admin-mfa.txt`, com permissão restrita. Cadastre-o em seu autenticador e remova o arquivo. Não versionar nem enviar esse URI por chat. O comando não imprime senha ou segredo.

Até selecionar o fornecedor de e-mail transacional, a recuperação é assistida: operador autorizado confirma a identidade e executa `pnpm access:reset email-da-conta`. O link de 30 minutos fica em `.local/reset-link.txt`; entregue por canal seguro. O link só pode ser utilizado uma vez, revoga sessões ao redefinir a senha e não remove MFA admin. A recuperação automática por e-mail permanece pendente no gate AUTH-01.

## O que está e o que falta conectar

| Item                    | Situação nesta fase                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| GitHub                  | Acesso de Git já disponível; não pedir token adicional sem falha específica                            |
| PostgreSQL local        | Funciona via Docker; não exige conta externa                                                           |
| MFA local               | Chave gerada no setup; exige cadastrar admin no autenticador                                           |
| Twilio                  | Credenciais solicitadas; integração e chamadas reais ainda pendentes                                   |
| IA / Asaas              | Candidatos, credenciais para fases futuras; nenhuma cobrança ou chamada é disparada                    |
| Redis                   | Introduzir junto com fila/outbox na fase 2/3; sem credenciais solicitadas nesta fase                   |
| Host HTTPS/WSS / e-mail | Fornecedores ainda precisam ser escolhidos                                                             |
| Notion                  | Ferramenta não exposta nesta execução; documentação fica no repositório com a autorização mais recente |

Depois de preencher as credenciais na interface segura do ambiente, salve/revise a configuração e reinicie os processos. A publicação do ambiente é uma ação separada; não equivale a publicar a plataforma para clientes.
