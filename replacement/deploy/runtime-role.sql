-- Run only after dedicated rebuild migrations, with the database owner's role.
BEGIN;
SELECT 'CREATE ROLE fleetvera_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fleetvera_runtime') \gexec
ALTER ROLE fleetvera_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'runtime_password';
REVOKE ALL ON DATABASE fleetvera_rebuild_staging FROM PUBLIC;
GRANT CONNECT ON DATABASE fleetvera_rebuild_staging TO fleetvera_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA fleetvera_rebuild TO fleetvera_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA fleetvera_rebuild TO fleetvera_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA fleetvera_rebuild TO fleetvera_runtime;
REVOKE UPDATE,DELETE ON fleetvera_rebuild.audit_events FROM fleetvera_runtime;
GRANT SELECT ON public.fleetvera_rebuild_migrations TO fleetvera_runtime;
COMMIT;
