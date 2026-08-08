import { createMocks } from "node-mocks-http";

jest.mock("@/lib/apiAuth", () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}));
jest.mock("@/lib/rateLimit", () => ({
  rateLimitMiddleware: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findFirst: jest.fn(), count: jest.fn() },
    delivery: { findFirst: jest.fn(), count: jest.fn() },
    maintenanceTask: { count: jest.fn() },
    intelligenceFinding: { findFirst: jest.fn() },
    auditLog: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import handler from "@/pages/api/assistant/actions/execute";
import { requireTenantContext, assertSameOrigin } from "@/lib/apiAuth";
import { rateLimitMiddleware } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";

const context = {
  session: { user: { id: "manager-1", name: "Morgan" } },
  tenant: {
    ownerId: "owner-1",
    teamId: "team-1",
    role: "MANAGER",
    resourceWhere: {
      OR: [{ teamId: "team-1" }, { ownerId: "owner-1", teamId: null }],
    },
  },
};
const delivery = {
  id: "d1",
  customer: "Acme",
  address: "1 Main",
  status: "pending",
  driver: null,
  items: 1,
  progress: 0,
  notes: null,
  ownerId: "owner-1",
  teamId: "team-1",
  updatedAt: new Date("2026-08-08T12:00:00Z"),
};
const finding = (id = "f1", entityType = "delivery", entityId = "d1") => ({ id, status: "OPEN", resolvedAt: null, expiresAt: null, evidence: JSON.stringify([{ entityType, entityId }]) });

describe("/api/assistant/actions/execute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACTION_PREVIEW_KEYS = JSON.stringify({ current: "test-secret-that-is-at-least-32-bytes-long", previous: "previous-secret-that-is-at-least-32-bytes" });
    process.env.ACTION_PREVIEW_CURRENT_KID = "current";
    (requireTenantContext as jest.Mock).mockResolvedValue(context);
    (assertSameOrigin as jest.Mock).mockReturnValue(true);
    (rateLimitMiddleware as jest.Mock).mockResolvedValue(true);
    (prisma.delivery.findFirst as jest.Mock).mockResolvedValue(delivery);
  });

  it("returns an exact server-issued preview without writing", async () => {
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue({
      ...finding(),
    });
    const { req, res } = createMocks({
      method: "POST",
      body: {
        action: {
          type: "update_delivery_status",
          deliveryId: "d1",
          values: { status: "delivered" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: "f1",
      },
    });
    await handler(req as never, res as never);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        token: expect.any(String),
        preview: {
          kind: "write",
          label: expect.any(String),
          before: expect.objectContaining({ status: "pending" }),
          after: expect.objectContaining({ status: "delivered" }),
        },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["resolved", { ...finding(), status: "RESOLVED" }],
    ["dismissed", { ...finding(), status: "DISMISSED" }],
    ["expired", { ...finding(), expiresAt: new Date(0) }],
    ["unrelated", finding("f1", "delivery", "other")],
    ["corrupt", { ...finding(), evidence: "not-json" }],
  ])("rejects %s finding provenance", async (_label, source) => {
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue(source);
    const { req, res } = createMocks({ method: "POST", body: { action: { type: "update_delivery_status", deliveryId: "d1", values: { status: "delivered" }, expectedUpdatedAt: delivery.updatedAt.toISOString() }, sourceFindingId: "f1" } });
    await handler(req as never, res as never); expect(res._getStatusCode()).toBe(404);
  });

  it("revalidates finding state inside the write transaction", async () => {
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue(finding());
    let mocks = createMocks({ method: "POST", body: { action: { type: "update_delivery_status", deliveryId: "d1", values: { status: "delivered" }, expectedUpdatedAt: delivery.updatedAt.toISOString() }, sourceFindingId: "f1" } });
    await handler(mocks.req as never, mocks.res as never); const token = mocks.res._getJSONData().token;
    const tx = { intelligenceFinding: { findFirst: jest.fn().mockResolvedValue({ ...finding(), status: "DISMISSED" }) }, delivery: { findFirst: jest.fn(), updateMany: jest.fn() }, deliveryEvent: { create: jest.fn() }, actionExecution: { create: jest.fn() }, auditLog: { create: jest.fn() } };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => fn(tx)); mocks = createMocks({ method: "POST", body: { previewToken: token, confirm: true } }); await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getStatusCode()).toBe(409); expect(tx.delivery.updateMany).not.toHaveBeenCalled(); expect(tx.actionExecution.create).not.toHaveBeenCalled(); expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("requires a second explicit confirmation and commits mutation with audit atomically", async () => {
    let mocks = createMocks({
      method: "POST",
      body: {
        action: {
          type: "update_delivery_status",
          deliveryId: "d1",
          values: { status: "delivered" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: "f1",
      },
    });
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue({
      ...finding(),
    });
    await handler(mocks.req as never, mocks.res as never);
    const token = mocks.res._getJSONData().token;
    const tx = {
      intelligenceFinding: { findFirst: jest.fn().mockResolvedValue(finding()) },
      actionExecution: { create: jest.fn().mockResolvedValue({}) },
      delivery: {
        findFirst: jest.fn().mockResolvedValue(delivery),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      deliveryEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: Function) => fn(tx),
    );
    mocks = createMocks({
      method: "POST",
      body: { previewToken: token, confirm: true },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getStatusCode()).toBe(200);
    expect(tx.delivery.updateMany).toHaveBeenCalled();
    const result = mocks.res._getJSONData().result;
    const auditCall = tx.auditLog.create.mock.calls[0][0].data;
    expect(JSON.parse(auditCall.metadata).result).toEqual(result);
    expect(result).toEqual(
      expect.objectContaining({
        before: { status: "pending", notes: null, progress: 0, completedTime: null },
        after: { status: "delivered", notes: null, progress: 100, completedTime: expect.any(String) },
        eventCreated: true,
      }),
    );
    expect(auditCall).toEqual(
      expect.objectContaining({
        action: "ai_action_confirmed",
        metadata: expect.stringContaining("f1"),
      }),
    );
  });

  it.each(["VIEWER"])("forbids %s from previewing writes", async (role) => {
    (requireTenantContext as jest.Mock).mockResolvedValue({
      ...context,
      tenant: { ...context.tenant, role },
    });
    const { req, res } = createMocks({
      method: "POST",
      body: {
        action: {
          type: "update_delivery_status",
          deliveryId: "d1",
          values: { status: "delivered" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: "f1",
      },
    });
    await handler(req as never, res as never);
    expect(res._getStatusCode()).toBe(403);
  });

  it("rejects stale records before issuing a token", async () => {
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue({
      ...finding(),
    });
    const { req, res } = createMocks({
      method: "POST",
      body: {
        action: {
          type: "update_delivery_status",
          deliveryId: "d1",
          values: { status: "delivered" },
          expectedUpdatedAt: "2026-08-08T11:00:00.000Z",
        },
        sourceFindingId: "f1",
      },
    });
    await handler(req as never, res as never);
    expect(res._getStatusCode()).toBe(409);
    expect(res._getData()).not.toContain("token");
  });

  it("binds confirmation to the exact tenant and rejects replay atomically", async () => {
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue({
      ...finding(),
    });
    let mocks = createMocks({
      method: "POST",
      body: {
        action: {
          type: "update_delivery_status",
          deliveryId: "d1",
          values: { status: "delivered" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: "f1",
      },
    });
    await handler(mocks.req as never, mocks.res as never);
    const token = mocks.res._getJSONData().token;
    (requireTenantContext as jest.Mock).mockResolvedValue({
      ...context,
      tenant: { ...context.tenant, teamId: "team-2" },
    });
    mocks = createMocks({
      method: "POST",
      body: { previewToken: token, confirm: true },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getStatusCode()).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    (requireTenantContext as jest.Mock).mockResolvedValue(context);
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: "P2002" });
    mocks = createMocks({
      method: "POST",
      body: { previewToken: token, confirm: true },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getStatusCode()).toBe(409);
  });

  it("checks method, origin, auth and rate limit before parsing", async () => {
    let m = createMocks({ method: "GET" });
    await handler(m.req as never, m.res as never);
    expect(m.res._getStatusCode()).toBe(405);
    (assertSameOrigin as jest.Mock).mockReturnValue(false);
    m = createMocks({ method: "POST" });
    await handler(m.req as never, m.res as never);
    expect(requireTenantContext).not.toHaveBeenCalled();
    (assertSameOrigin as jest.Mock).mockReturnValue(true);
    (requireTenantContext as jest.Mock).mockResolvedValue(null);
    m = createMocks({ method: "POST" });
    await handler(m.req as never, m.res as never);
    expect(rateLimitMiddleware).not.toHaveBeenCalled();
  });

  it("creates a maintenance task with the exact signed snapshot and finding provenance", async () => {
    const vehicle = {
      id: "v1",
      name: "Van 1",
      updatedAt: new Date("2026-08-08T12:00:00Z"),
    };
    (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(vehicle);
    (prisma.intelligenceFinding.findFirst as jest.Mock).mockResolvedValue({
      ...finding("f-maint", "vehicle", "v1"),
    });
    let mocks = createMocks({
      method: "POST",
      body: {
        action: {
          type: "create_maintenance_task",
          vehicleId: "v1",
          values: {
            vehicle: "untrusted",
            type: "Oil change",
            dueDate: "2026-08-09",
            priority: "high",
            notes: "Use synthetic oil",
          },
          expectedVehicleUpdatedAt: vehicle.updatedAt.toISOString(),
        },
        sourceFindingId: "f-maint",
      },
    });
    await handler(mocks.req as never, mocks.res as never);
    const preview = mocks.res._getJSONData();
    expect(preview.preview.after).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        vehicleName: "Van 1",
        notes: "Use synthetic oil",
        completed: false,
        ownerId: "owner-1",
        teamId: "team-1",
      }),
    );
    const created = {
      ...preview.preview.after,
      dueDate: new Date("2026-08-09T00:00:00Z"),
      partsNeeded: null,
    };
    const tx = {
      intelligenceFinding: { findFirst: jest.fn().mockResolvedValue(finding("f-maint", "vehicle", "v1")) },
      actionExecution: { create: jest.fn() },
      vehicle: { findFirst: jest.fn().mockResolvedValue(vehicle) },
      maintenanceTask: { create: jest.fn().mockResolvedValue(created) },
      auditLog: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: Function) => fn(tx),
    );
    mocks = createMocks({
      method: "POST",
      body: { previewToken: preview.token, confirm: true },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getStatusCode()).toBe(200);
    expect(tx.maintenanceTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: preview.preview.after.id,
          title: "Oil change",
          notes: "Use synthetic oil",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("keeps weekly summaries and edit prefills non-mutating with signed audited provenance", async () => {
    (prisma.vehicle.count as jest.Mock).mockResolvedValue(2);
    (prisma.maintenanceTask.count as jest.Mock).mockResolvedValue(1);
    (prisma.delivery.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);
    let mocks = createMocks({
      method: "POST",
      body: { action: { type: "draft_weekly_summary" } },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getJSONData()).toEqual(
      expect.objectContaining({
        requiresConfirmation: false,
        provenanceToken: expect.any(String),
        preview: expect.objectContaining({
          after: expect.objectContaining({ vehicles: 2, openMaintenance: 1 }),
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
    (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: "v1" });
    mocks = createMocks({
      method: "POST",
      body: {
        action: {
          type: "open_edit",
          entityType: "vehicle",
          entityId: "v1",
          values: { mileage: 42 },
        },
      },
    });
    await handler(mocks.req as never, mocks.res as never);
    expect(mocks.res._getJSONData()).toEqual(
      expect.objectContaining({
        href: "/vehicles?edit=v1&mileage=42",
        provenanceToken: expect.any(String),
      }),
    );
  });

  it.each([
    [
      "vehicle",
      { status: "active", mileage: 10 },
      { status: "delayed", mileage: 42 },
      "/vehicles?edit=v1&status=delayed&mileage=42",
    ],
    [
      "delivery",
      { status: "pending", notes: "Old" },
      { status: "in-transit", notes: "New" },
      "/deliveries?edit=v1&status=in-transit&notes=New",
    ],
  ])(
    "shows exact allowlisted current and proposed %s edit fields",
    async (entityType, current, values, href) => {
      const model = entityType === "vehicle" ? prisma.vehicle : prisma.delivery;
      (model.findFirst as jest.Mock).mockResolvedValue({
        id: "v1",
        ...current,
      });
      const { req, res } = createMocks({
        method: "POST",
        body: {
          action: { type: "open_edit", entityType, entityId: "v1", values },
        },
      });
      await handler(req as never, res as never);
      expect(res._getJSONData()).toEqual(
        expect.objectContaining({
          preview: expect.objectContaining({ before: current, after: values }),
          href,
        }),
      );
    },
  );
});
