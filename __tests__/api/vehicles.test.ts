import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock next-auth before importing handler
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/fleet', () => ({
  dbToVehicle: jest.fn((v: any) => v),
  vehicleToDb: jest.fn((v: any) => v),
  logActivity: jest.fn(),
}));

import handler from '@/pages/api/vehicles/index';

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
});
