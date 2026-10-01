CREATE TABLE fleetvera_rebuild.deliveries (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES fleetvera_rebuild.workspaces(id),
 client_id uuid NOT NULL, reference text NOT NULL,
 pickup_address text NOT NULL, dropoff_address text NOT NULL,
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','assigned','in_transit','delivered','cancelled')),
 driver_id uuid, vehicle_id uuid, version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 started_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,reference),
 FOREIGN KEY(workspace_id,client_id) REFERENCES fleetvera_rebuild.clients(workspace_id,id),
 FOREIGN KEY(workspace_id,vehicle_id) REFERENCES fleetvera_rebuild.vehicles(workspace_id,id),
 FOREIGN KEY(workspace_id,driver_id) REFERENCES fleetvera_rebuild.memberships(workspace_id,user_id),
 CHECK(status NOT IN ('assigned','in_transit','delivered') OR (driver_id IS NOT NULL AND vehicle_id IS NOT NULL)),
 CHECK(status!='in_transit' OR started_at IS NOT NULL),
 CHECK(status!='delivered' OR (started_at IS NOT NULL AND completed_at IS NOT NULL)),
 CHECK(status!='cancelled' OR cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_open_delivery_per_vehicle ON fleetvera_rebuild.deliveries(workspace_id,vehicle_id) WHERE status IN ('assigned','in_transit');
CREATE UNIQUE INDEX one_open_delivery_per_driver ON fleetvera_rebuild.deliveries(workspace_id,driver_id) WHERE status IN ('assigned','in_transit');
CREATE INDEX delivery_workspace_status ON fleetvera_rebuild.deliveries(workspace_id,status);
