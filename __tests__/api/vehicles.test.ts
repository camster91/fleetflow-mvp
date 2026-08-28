import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
  authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    vehicle: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/fleet', () => ({
  dbToVehicle: jest.fn((v: any) => v),
  vehicleToDb: jest.fn((v: any) => v),
  logActivity: jest.fn(),
}));

import handler from '@/pages/api/vehicles/index';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

describe('GET /api/vehicles', () => {
  it('returns 401 without a valid session', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /api/vehicles', () => {
  it('returns 401 without a valid session', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { name: 'Truck 1' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it('denies a viewer from creating a vehicle', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'viewer-1' } });
    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] },
    ]);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetflow.test' },
      body: { name: 'Truck 1', status: 'active' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin vehicle creation request', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } });
    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [] },
    ]);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: {
        host: 'fleetflow.test',
        origin: 'https://attacker.example',
      },
      body: { name: 'Truck 1', status: 'active' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(res._getJSONData()).toEqual({ error: 'Forbidden origin' });
    expect(prisma.vehicle.create).not.toHaveBeenCalled();
  });
});

describe('tenant vehicle access', () => {
  it('reads the selected team scope for an accepted member', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'member-1' } });
    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'MEMBER' }] },
    ]);
    (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.vehicle.count as jest.Mock).mockResolvedValue(0);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1' },
    }));
  });
});
