-- Caixa de entrada interna do sandbox, sem vínculo de tenant recebido do provedor.
-- IDs permitem consultar a fonte de verdade ao implementar processamento/reconciliação.
CREATE TABLE billing_webhook_inbox (
  provider text NOT NULL CHECK (provider = 'asaas'),
  environment text NOT NULL CHECK (environment = 'sandbox'),
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 200),
  event_type text NOT NULL CHECK (event_type ~ '^(PAYMENT|SUBSCRIPTION)_[A-Z0-9_]+$'),
  provider_created_at text CHECK (length(provider_created_at) <= 80),
  payment_id text CHECK (length(payment_id) BETWEEN 1 AND 200),
  subscription_id text CHECK (length(subscription_id) BETWEEN 1 AND 200),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processed','failed')),
  PRIMARY KEY (provider,environment,event_id),
  CHECK (payment_id IS NOT NULL OR subscription_id IS NOT NULL)
);
CREATE INDEX billing_webhook_pending_idx ON billing_webhook_inbox(received_at)
  WHERE state = 'pending';

REVOKE ALL ON billing_webhook_inbox FROM PUBLIC;
GRANT INSERT (provider,environment,event_id,event_type,provider_created_at,payment_id,subscription_id,payload_hash)
  ON billing_webhook_inbox TO atendente_app;
GRANT SELECT (provider,environment,event_id,payload_hash)
  ON billing_webhook_inbox TO atendente_app;
-- A API não lê dados financeiros, muda estado, altera conteúdo nem remove eventos.
