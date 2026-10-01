CREATE TABLE fleetvera_rebuild.maintenance (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 vehicle_id uuid NOT NULL, service_type text NOT NULL CHECK(service_type IN ('inspection','service','repair','other')),
 title text NOT NULL, due_on date NOT NULL, notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','cancelled')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0), cost_cents integer CHECK(cost_cents>=0),
 currency text CHECK(currency ~ '^[A-Z]{3}$'), started_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,vehicle_id) REFERENCES fleetvera_rebuild.vehicles(workspace_id,id),
 CHECK(status!='in_progress' OR started_at IS NOT NULL),
 CHECK(status!='completed' OR (started_at IS NOT NULL AND completed_at IS NOT NULL AND cost_cents IS NOT NULL AND currency IS NOT NULL)),
 CHECK(status!='cancelled' OR cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_maintenance_per_vehicle ON fleetvera_rebuild.maintenance(workspace_id,vehicle_id) WHERE status='in_progress';
CREATE INDEX maintenance_workspace_due ON fleetvera_rebuild.maintenance(workspace_id,due_on);
