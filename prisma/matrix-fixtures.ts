/*
 * Synthetic workspace for the Playwright feature x role matrix (e2e/matrix).
 * Shared by prisma/seed.ts (writes it) and the specs (assert against it).
 * Every identity uses the reserved .test TLD and has no password; E2E signs
 * sessions directly (e2e/matrix/auth.ts). IDs are fixed so specs can assert
 * exact visibility.
 */
export const MATRIX_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'VIEWER'] as const
export type MatrixRole = (typeof MATRIX_ROLES)[number]

// Legacy global User.role for each workspace role. Never 'admin', which is the platform-admin role.
const LEGACY_ROLE: Record<MatrixRole, string> = {
  OWNER: 'fleet_manager', ADMIN: 'fleet_manager', MANAGER: 'fleet_manager',
  DISPATCHER: 'dispatch', TECHNICIAN: 'maintenance', DRIVER: 'driver', VIEWER: 'viewer',
}

export const MATRIX_TEAM = { id: 'e2e-matrix-team', name: 'Matrix Test Fleet (synthetic)' }

export const matrixUser = (role: MatrixRole) => {
  const key = role.toLowerCase()
  return {
    id: `e2e-matrix-${key}`,
    email: `${key}@matrix.fleetvera.test`,
    name: `Matrix ${role[0]}${key.slice(1)} (synthetic)`,
    role: LEGACY_ROLE[role],
  }
}

const OWNER_ID = matrixUser('OWNER').id
const DRIVER_ID = matrixUser('DRIVER').id
const DRIVER_NAME = matrixUser('DRIVER').name

export const MATRIX_VEHICLES = [
  { id: 'e2e-matrix-vehicle-alpha', name: 'E2E Van Alpha', licensePlate: 'TEST-001', assignedDriverId: DRIVER_ID, driver: DRIVER_NAME },
  { id: 'e2e-matrix-vehicle-bravo', name: 'E2E Van Bravo', licensePlate: 'TEST-002', assignedDriverId: null, driver: null },
]

export const MATRIX_DELIVERIES = [
  { id: 'e2e-matrix-delivery-assigned', customer: 'E2E Customer Assigned', status: 'pending', assignedDriverId: DRIVER_ID, driver: DRIVER_NAME, vehicleId: 'e2e-matrix-vehicle-alpha' },
  { id: 'e2e-matrix-delivery-unassigned', customer: 'E2E Customer Unassigned', status: 'pending', assignedDriverId: null, driver: null, vehicleId: null },
  { id: 'e2e-matrix-delivery-delivered', customer: 'E2E Customer Delivered', status: 'delivered', assignedDriverId: null, driver: null, vehicleId: 'e2e-matrix-vehicle-bravo' },
]

export const MATRIX_MAINTENANCE = [
  { id: 'e2e-matrix-maintenance-alpha', title: 'E2E Brake inspection', vehicleId: 'e2e-matrix-vehicle-alpha', vehicleName: 'E2E Van Alpha', priority: 'high' },
  { id: 'e2e-matrix-maintenance-bravo', title: 'E2E Tire rotation', vehicleId: 'e2e-matrix-vehicle-bravo', vehicleName: 'E2E Van Bravo', priority: 'medium' },
]

export const MATRIX_CLIENTS = [
  { id: 'e2e-matrix-client-cafe', name: 'E2E Client Harbor Cafe', type: 'cafe' },
  { id: 'e2e-matrix-client-office', name: 'E2E Client Depot Office', type: 'office' },
]

export const MATRIX_OWNER_ID = OWNER_ID
