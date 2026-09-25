import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  MATRIX_CLIENTS,
  MATRIX_DELIVERIES,
  MATRIX_MAINTENANCE,
  MATRIX_OWNER_ID,
  MATRIX_ROLES,
  MATRIX_TEAM,
  MATRIX_VEHICLES,
  matrixUser,
} from './matrix-fixtures'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123!', 12)
  const user = await prisma.user.upsert({
    where: { email: 'admin@fleetflow.test' },
    update: {},
    create: {
      email: 'admin@fleetflow.test',
      name: 'Admin User',
      password: hashedPassword,
      role: 'fleet_manager',
      company: 'FleetFlow Demo',
      emailVerified: new Date(),
      onboardingCompleted: true,
    },
  })
  console.log(`✓ Admin user: ${user.email}`)

  // Sample vehicle
  await prisma.vehicle.upsert({
    where: { id: 'seed-vehicle-1' },
    update: {},
    create: {
      id: 'seed-vehicle-1',
      name: 'Van 1',
      status: 'active',
      driver: 'John Smith',
      location: 'Downtown Depot',
      eta: '2:00 PM',
      mileage: 15000,
      maintenanceDue: false,
      ownerId: user.id,
    },
  })
  console.log('✓ Sample vehicle created')

  // Sample SOP category
  await prisma.sOPCategory.upsert({
    where: { id: 'seed-sop-1' },
    update: {},
    create: {
      id: 'seed-sop-1',
      name: 'Safety Procedures',
      description: 'Vehicle safety and emergency procedures',
      documentCount: 0,
      ownerId: user.id,
    },
  })
  console.log('✓ Sample SOP category created')

  await seedRoleMatrixWorkspace()
  console.log('✓ Role-matrix workspace created')

  console.log('Seeding complete!')
}

/** Idempotent synthetic workspace for the Playwright role matrix (see prisma/matrix-fixtures.ts). */
async function seedRoleMatrixWorkspace() {
  const joinedAt = new Date('2026-01-01T00:00:00.000Z')
  for (const role of MATRIX_ROLES) {
    const { id, ...user } = matrixUser(role)
    const profile = { ...user, company: MATRIX_TEAM.name, emailVerified: joinedAt, onboardingCompleted: true }
    await prisma.user.upsert({ where: { id }, update: profile, create: { id, ...profile } })
  }

  const ownerId = MATRIX_OWNER_ID
  await prisma.team.upsert({
    where: { id: MATRIX_TEAM.id },
    update: { name: MATRIX_TEAM.name, ownerId },
    create: { ...MATRIX_TEAM, ownerId },
  })
  for (const role of MATRIX_ROLES) {
    const userId = matrixUser(role).id
    const membership = { role, status: 'ACCEPTED', joinedAt, invitedBy: role === 'OWNER' ? null : ownerId }
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: MATRIX_TEAM.id, userId } },
      update: membership,
      create: { teamId: MATRIX_TEAM.id, userId, ...membership },
    })
  }

  const scope = { ownerId, teamId: MATRIX_TEAM.id }
  for (const { id, ...vehicle } of MATRIX_VEHICLES) {
    const data = {
      ...vehicle,
      ...scope,
      status: 'active',
      location: 'Example Depot',
      mileage: 1000,
      vehicleType: 'van',
    }
    await prisma.vehicle.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
  for (const { id, ...delivery } of MATRIX_DELIVERIES) {
    const data = { ...delivery, ...scope, address: '100 Example Street, Testville', items: 2 }
    await prisma.delivery.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
  for (const { id, ...task } of MATRIX_MAINTENANCE) {
    const data = {
      ...task,
      ...scope,
      type: task.title,
      dueDate: new Date('2030-01-15T00:00:00.000Z'),
      completed: false,
    }
    await prisma.maintenanceTask.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
  for (const { id, ...client } of MATRIX_CLIENTS) {
    const data = { ...client, ...scope, address: '200 Example Avenue, Testville', email: `${id}@example.test` }
    await prisma.client.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
