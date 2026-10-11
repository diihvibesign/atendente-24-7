# ADR 0003 — Identidade local, sessões duráveis e isolamento PostgreSQL

Data: 11/10/2026. Estado: adotado para fundação, sujeito à revisão antes de staging.

## Contexto

O produto exige somente `admin` e `user`, isolamento demonstrável entre funerárias, MFA para o administrador e controle server-side independente do frontend. Ainda não há fornecedor de identidade/e-mail escolhido.

## Decisão

Fastify controla sessões opacas, persistidas por hash no PostgreSQL; cookies são HttpOnly, Secure em produção, SameSite Strict, com Origin exata e token CSRF para mudanças. Senhas novas usam scrypt com N=131072, r=8, p=1, salt aleatório e comparação constante. A migração de hashes antigos da demo local ocorre no login. Admin sempre precisa de TOTP; segredo é criptografado por AES-256-GCM e último passo usado impede replay.

O bootstrap do admin é CLI de operador. Convites e redefinição usam tokens aleatórios persistidos por hash, com expiração e consumo em transação. Até integrar e-mail, a entrega é assistida por canal seguro. Redefinir senha revoga sessões, preserva MFA e registra auditoria.

Tenant é derivado da sessão. Operações de conteúdo usam transação com `set_config(..., true)`, garantindo contexto local à transação. PostgreSQL usa RLS com FORCE e login sem bypass/superuser; consultas também incluem tenant. Chaves compostas impedem referências a configuração, contato, caso ou ator de outra empresa. A API não usa a conexão de migração.

Configurações, notas e auditoria recebem grants mínimos. Configuração é imutável e possui publicação explícita, com bloqueio de contato sem verificação. Admin gerencia metadados de tenants e não recebe bypass de conteúdo.

## Consequências

Há manutenção própria de identidade, recuperação e proteção contra abuso. Antes de produção, revisar desenho com especialista e considerar fornecedor gerenciado que preserve os dois papéis e o isolamento. MFA criptografado exige backup/rotação planejada da chave. Rate limits locais servem à instância inicial; múltiplas instâncias exigem armazenamento compartilhado. A verificação de posse do telefone e o e-mail ainda são gates pendentes.
