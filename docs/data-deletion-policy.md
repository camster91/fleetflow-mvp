# Data deletion policy

This page records how FleetFlow deletes records and why. The database enforces
these rules through foreign keys (`prisma/schema.prisma`). API routes turn a
blocked delete into a readable response through `lib/prismaErrors.ts`, so it
never shows up as a raw 500.

## Error mapping (`lib/prismaErrors.ts`)

| Prisma code | Meaning                                   | HTTP | Default message |
|-------------|-------------------------------------------|------|-----------------|
| P2003       | A foreign key blocks the write            | 409  | Record is still referenced; remove or archive dependents first |
| P2025       | Record to update or delete no longer exists | 404 | Not found |
| P2002       | Unique constraint conflict                | 409  | A record with these details already exists |

Other errors are rethrown unchanged. Routes can pass their own messages.
`withPrismaErrors(handler, messages)` wraps a whole route.
`sendPrismaError(res, error, messages)` works inside an existing `catch`.

Routes that use it today: `vehicles/[id]`, `deliveries/[id]`, `maintenance/[id]`,
`clients/[id]` and `admin/users` (PATCH and DELETE).

## Vehicles and expenses

`ExpenseRecord.vehicle` stays `onDelete: Restrict`. Expense records are
financial history and must never disappear as a side effect of a vehicle
delete. Deleting a vehicle that has expenses returns **409**: "This vehicle has
expense records, so it can't be deleted. Set it to inactive to archive it, or
remove its expenses first."

## Team deletion: refuse while the team owns records

Team-scoped operational records point at their team with `onDelete: NoAction`.
The affected models are Vehicle, Delivery, MaintenanceTask, Client, SOPCategory,
VendingMachine, ExpenseRecord and Announcement (migration
`20260925010000_team_delete_restrict_password_history_fk`).

- **Deleting a team directly** fails with P2003 (409 when it goes through the
  mapper) while any of those records still exist. Remove or move them first.
  Previously the foreign keys used `SET NULL`. That silently moved the team's
  records into the team owner's *personal* workspace (`ownerId = owner, teamId
  = null`, see `lib/apiAuth.ts`), which is how team data leaked into a personal
  scope.
- **Deleting the team owner's account** still works. The user delete cascades to
  the owner's teams and, through `ownerId`, to the owner's records. Postgres
  checks `NO ACTION` at the end of the statement, so the team and its records
  are removed together. If another user owns a record that still points at the
  team, the account delete is refused (409) instead of orphaning it.
- Records that only make sense inside the team keep `onDelete: Cascade` and are
  removed with it: members, intelligence findings and runs, maintenance risk
  feedback, document uploads and integration connections.

We chose to refuse rather than cascade because a cascade would also delete
expense history, and `ExpenseRecord.vehicle` is restricted anyway. Refusing is
the smallest change that can never destroy data or move it to the wrong scope.
FleetFlow has no team-delete endpoint yet. When one is added, it should archive
or explicitly remove team records first, and use the mapper for the 409.

## Users

- Almost everything a user owns cascades with the user (`ownerId ... onDelete:
  Cascade`).
- `PasswordHistory.userId` now has a foreign key to `User` with `onDelete:
  Cascade`. The migration first deletes any orphaned password-history rows left
  behind by users who were already deleted.
- `admin/users` DELETE returns 409 when a restricted record blocks the delete
  and 404 when the user no longer exists.

## Follow-ups

- Soft delete/archive for fleet records with financial history. Today "archive"
  for a vehicle means setting its status to `inactive`.
- A team-delete flow that offers archive, export or transfer before removal.
