CREATE SCHEMA fleetvera_rebuild;
CREATE TABLE fleetvera_rebuild.users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK(email=lower(email)),
 display_name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fleetvera_rebuild.workspaces (
 id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fleetvera_rebuild.memberships (
 workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 user_id uuid NOT NULL REFERENCES fleetvera_rebuild.users(id),
 role text NOT NULL CHECK(role IN ('owner','dispatcher','driver','mechanic')),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE fleetvera_rebuild.sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES fleetvera_rebuild.users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_expiry ON fleetvera_rebuild.sessions(expires_at);
CREATE TABLE fleetvera_rebuild.vehicles (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 registration text NOT NULL, label text NOT NULL,
 status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','maintenance','retired')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), UNIQUE(workspace_id,registration)
);
CREATE TABLE fleetvera_rebuild.clients (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 name text NOT NULL, contact_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE TABLE fleetvera_rebuild.audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 actor_id uuid NOT NULL REFERENCES fleetvera_rebuild.users(id),
 action text NOT NULL, target_id uuid NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
