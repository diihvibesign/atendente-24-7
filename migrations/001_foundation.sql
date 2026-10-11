REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE tenants (
  id uuid PRIMARY KEY, name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  published_version integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), name text NOT NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(email)), role text NOT NULL CHECK (role IN ('admin','user')),
  password_hash text, active boolean NOT NULL DEFAULT true, mfa_secret text, last_totp_step bigint,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id,id),
  CHECK ((role = 'admin' AND tenant_id IS NULL AND mfa_secret IS NOT NULL) OR (role = 'user' AND tenant_id IS NOT NULL))
);
CREATE INDEX users_tenant_idx ON users(tenant_id);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE access_tokens (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('invite','reset')), expires_at timestamptz NOT NULL,
  consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_tokens_user_idx ON access_tokens(user_id);
CREATE TABLE contacts (
  tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL,
  name text NOT NULL, phone text NOT NULL CHECK (phone ~ '^\+55[0-9]{10,11}$'),
  verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id)
);
CREATE TABLE routing_versions (
  tenant_id uuid NOT NULL REFERENCES tenants(id), version integer NOT NULL CHECK (version > 0),
  configuration jsonb NOT NULL, contact_id uuid, published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id,version),
  FOREIGN KEY (tenant_id,contact_id) REFERENCES contacts(tenant_id,id)
);
ALTER TABLE tenants ADD CONSTRAINT published_routing_fk FOREIGN KEY (id,published_version) REFERENCES routing_versions(tenant_id,version);
CREATE TABLE cases (
  tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contacted','closed')),
  priority text NOT NULL CHECK (priority IN ('normal','urgent')),
  caller jsonb NOT NULL, callback_phone jsonb NOT NULL, deceased jsonb NOT NULL, location jsonb NOT NULL, need jsonb NOT NULL,
  configuration_version integer, source text NOT NULL CHECK (source IN ('synthetic','phone')),
  notification_status text NOT NULL DEFAULT 'not_sent' CHECK (notification_status IN ('not_sent','queued','sent','delivered','failed')),
  transfer_status text NOT NULL DEFAULT 'not_requested' CHECK (transfer_status IN ('not_requested','pending','connected','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,configuration_version) REFERENCES routing_versions(tenant_id,version)
);
CREATE INDEX cases_recent_idx ON cases(tenant_id,created_at DESC,id);
CREATE INDEX cases_status_idx ON cases(tenant_id,status,created_at DESC);
CREATE INDEX cases_config_idx ON cases(tenant_id,configuration_version);
CREATE TABLE case_notes (
  tenant_id uuid NOT NULL, id uuid NOT NULL, case_id uuid NOT NULL, actor_id uuid NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), FOREIGN KEY (tenant_id,case_id) REFERENCES cases(tenant_id,id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX case_notes_case_idx ON case_notes(tenant_id,case_id,created_at);
CREATE INDEX case_notes_actor_idx ON case_notes(actor_id);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), tenant_id uuid REFERENCES tenants(id),
  action text NOT NULL, resource_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_recent_idx ON audit_events(tenant_id,created_at DESC);
CREATE INDEX audit_actor_idx ON audit_events(actor_id,created_at DESC);

-- Conteúdo pertence ao tenant. Admin não recebe um bypass de RLS.
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON contacts TO atendente_app USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE routing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON routing_versions TO atendente_app USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON cases TO atendente_app USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON case_notes TO atendente_app USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

GRANT USAGE ON SCHEMA public TO atendente_app;
GRANT SELECT,INSERT,UPDATE ON tenants,users,access_tokens TO atendente_app;
GRANT SELECT,INSERT,DELETE ON sessions TO atendente_app;
GRANT SELECT,INSERT ON contacts,case_notes TO atendente_app;
GRANT SELECT,INSERT ON routing_versions TO atendente_app;
GRANT UPDATE (published_at) ON routing_versions TO atendente_app;
GRANT SELECT,INSERT ON cases TO atendente_app;
GRANT UPDATE (status,updated_at) ON cases TO atendente_app;
GRANT INSERT ON audit_events TO atendente_app;
-- Sem UPDATE/DELETE de notas, auditoria e documentos de configuração.
