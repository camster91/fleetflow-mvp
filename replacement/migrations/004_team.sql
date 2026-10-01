ALTER TABLE fleetvera_rebuild.memberships ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
ALTER TABLE fleetvera_rebuild.memberships ADD COLUMN revoked_at timestamptz;
CREATE TABLE fleetvera_rebuild.invitations (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 email text NOT NULL, role text NOT NULL CHECK(role IN ('owner','dispatcher','driver','mechanic')),
 token_hash text NOT NULL UNIQUE, issuer_id uuid NOT NULL REFERENCES fleetvera_rebuild.users(id),
 expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
