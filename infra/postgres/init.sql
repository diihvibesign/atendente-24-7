-- Apenas Docker local; produção provisiona seu login separadamente pelo gerenciador de segredos.
CREATE ROLE atendente_app LOGIN PASSWORD 'local_app_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
