# Role command centres

The dashboard resolves the active workspace role on the server through `GET /api/dashboard/context`; it does not trust the account-level role for final authorization. The endpoint returns only the workspace role, and every underlying collection API independently applies the same tenant scope and permissions.

| Workspace role | Dashboard | Primary decisions | Write boundary |
| --- | --- | --- | --- |
| Owner, admin, manager | Owner command centre | Review fleet risks, add fleet capacity, manage team | Existing manager/admin permissions |
| Dispatcher | Dispatch command centre | Triage exceptions, assign unassigned delivery work, review workload | Deliveries only |
| Technician | Maintenance command centre | Triage due work, review work queue, update work orders | Maintenance only |
| Driver | Driver command centre | Open assigned deliveries, report an issue, open safety procedures | No fleet-management writes |
| Viewer or unknown/legacy role | Fleet overview | Review exceptions and totals | Read only |

Each command centre renders exceptions and assignments before aggregate totals. The three collection requests settle independently, so successful data remains visible during a partial failure and the alert provides a keyboard-accessible retry. Empty states do not imply that all data is healthy when another source failed.

The driver layout uses one-column controls with a minimum 44px target, remains within a 375px viewport, and does not render dispatcher, technician, or fleet-administration actions.

## Decision and action contract

- Owner/admin/manager decisions: fleet risks requiring intervention; capacity constraints; team changes that unblock work. Actions: Review fleet risks, Add vehicle, Manage team.
- Dispatcher decisions: exceptions threatening today; unassigned deliveries; routes requiring rebalancing. Actions: Assign delivery, Review routes, Check driver status.
- Technician decisions: overdue work; highest-priority vehicle; applicable procedure. Actions: Update work orders, Review maintenance schedule, Open service procedures.
- Driver decisions: next assigned stop; assigned vehicle attention; applicable safety procedure. Actions: Open my deliveries, View my assigned vehicle, Open safety procedures.

The server sends these bounded contracts with the canonical workspace role. Driver records are selected only through stable `assignedDriverId` relations plus the canonical tenant scope. Display names are retained for presentation and legacy assignment resolution but are never used to authorize dashboard reads.

Migration adoption backfills only an exact, case-normalized display-name match that resolves to exactly one accepted `DRIVER` team membership. Personal-workspace, non-driver, ambiguous, and unresolved legacy names remain unassigned and require explicit reconciliation. Operators can reconcile them with `SELECT id, driver, "teamId" FROM "Vehicle" WHERE driver IS NOT NULL AND "assignedDriverId" IS NULL;` and the equivalent `Delivery` query, then reassign by user ID in the application.
