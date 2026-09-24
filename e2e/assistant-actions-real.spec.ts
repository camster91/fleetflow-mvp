import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const db = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ownerId = `qa-owner-${suffix}`,
  managerId = `qa-manager-${suffix}`,
  outsiderId = `qa-outsider-${suffix}`,
  teamId = `qa-team-${suffix}`,
  deliveryId = `qa-delivery-${suffix}`,
  staleDeliveryId = `qa-stale-${suffix}`,
  findingId = `qa-finding-${suffix}`;

test.afterAll(async () => {
  await db.auditLog.deleteMany({
    where: { userId: { in: [ownerId, managerId, outsiderId] } },
  });
  await db.actionExecution.deleteMany({ where: { ownerId } });
  await db.intelligenceFinding.deleteMany({ where: { ownerId } });
  await db.deliveryEvent.deleteMany({ where: { deliveryId } });
  await db.delivery.deleteMany({ where: { ownerId } });
  // Teams cannot be deleted while they still own records (docs/data-deletion-policy.md).
  await db.maintenanceTask.deleteMany({ where: { teamId } });
  await db.teamMember.deleteMany({ where: { teamId } });
  await db.team.deleteMany({ where: { id: teamId } });
  await db.user.deleteMany({
    where: { id: { in: [ownerId, managerId, outsiderId] } },
  });
  await db.$disconnect();
});

test("real backend enforces signed tenant-scoped stale and replay-safe confirmation with atomic audit", async ({
  request,
  baseURL,
}) => {
  test.skip(
    !baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL),
    "Disposable local database only",
  );
  await db.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@test.invalid`, name: "QA Owner" },
      { id: managerId, email: `${managerId}@test.invalid`, name: "QA Manager" },
      {
        id: outsiderId,
        email: `${outsiderId}@test.invalid`,
        name: "QA Outsider",
      },
    ],
  });
  await db.team.create({ data: { id: teamId, name: "QA Team", ownerId } });
  await db.teamMember.create({
    data: {
      teamId,
      userId: managerId,
      role: "MANAGER",
      status: "ACCEPTED",
      joinedAt: new Date(),
    },
  });
  const delivery = await db.delivery.create({
    data: {
      id: deliveryId,
      ownerId,
      teamId,
      customer: "QA Customer",
      address: "1 QA Street",
      status: "pending",
      notes: "Original",
    },
  });
  await db.intelligenceFinding.create({
    data: {
      id: findingId,
      ownerId,
      teamId,
      type: "delivery-schedule-passed",
      severity: "high",
      confidence: 1,
      score: 100,
      ruleVersion: "qa",
      title: "QA late delivery",
      explanation: "QA",
      evidence: JSON.stringify([
        { entityType: "delivery", entityId: deliveryId },
        { entityType: "delivery", entityId: staleDeliveryId },
      ]),
    },
  });
  const jwt = await new SignJWT({
    sub: managerId,
    email: `${managerId}@test.invalid`,
    role: "MANAGER",
    purpose: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  const headers = {
    cookie: `token=${jwt}; fleetflow_team=${teamId}`,
    origin: baseURL!,
    host: new URL(baseURL!).host,
    "content-type": "application/json",
  };
  const previewResponse = await request.post(
    `${baseURL}/api/assistant/actions/execute`,
    {
      headers,
      data: {
        action: {
          type: "update_delivery_status",
          deliveryId,
          values: { status: "delivered", notes: "Confirmed note" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: findingId,
      },
    },
  );
  expect(previewResponse.status()).toBe(200);
  const preview = await previewResponse.json();
  expect(preview.preview.before).toEqual(
    expect.objectContaining({ status: "pending", notes: "Original" }),
  );
  expect(preview.preview.after).toEqual(
    expect.objectContaining({ status: "delivered", notes: "Confirmed note" }),
  );
  const concurrent = await Promise.all([
    request.post(`${baseURL}/api/assistant/actions/execute`, {
      headers,
      data: { previewToken: preview.token, confirm: true },
    }),
    request.post(`${baseURL}/api/assistant/actions/execute`, {
      headers,
      data: { previewToken: preview.token, confirm: true },
    }),
  ]);
  expect(concurrent.map((item) => item.status()).sort()).toEqual([200, 409]);
  const confirmed = concurrent.find((item) => item.status() === 200)!;
  const confirmedResult = (await confirmed.json()).result;
  expect(
    (await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).status,
  ).toBe("delivered");
  expect(
    await db.deliveryEvent.count({
      where: { deliveryId, status: "delivered" },
    }),
  ).toBe(1);
  expect(
    await db.actionExecution.count({
      where: { ownerId, actionType: "update_delivery_status" },
    }),
  ).toBe(1);
  const audit = await db.auditLog.findFirstOrThrow({
    where: {
      userId: managerId,
      action: "ai_action_confirmed",
      entityId: deliveryId,
    },
  });
  expect(JSON.parse(audit.metadata!).result).toEqual(confirmedResult);
  expect(audit.metadata).toContain(findingId);
  const staleDelivery = await db.delivery.create({
    data: {
      id: staleDeliveryId,
      ownerId,
      teamId,
      customer: "Stale QA",
      address: "2 QA Street",
      status: "pending",
    },
  });
  const stalePreviewResponse = await request.post(
    `${baseURL}/api/assistant/actions/execute`,
    {
      headers,
      data: {
        action: {
          type: "update_delivery_status",
          deliveryId: staleDeliveryId,
          values: { status: "cancelled" },
          expectedUpdatedAt: staleDelivery.updatedAt.toISOString(),
        },
        sourceFindingId: findingId,
      },
    },
  );
  const stalePreview = await stalePreviewResponse.json();
  await db.delivery.update({
    where: { id: staleDeliveryId },
    data: { notes: "Changed elsewhere" },
  });
  const staleConfirm = await request.post(
    `${baseURL}/api/assistant/actions/execute`,
    { headers, data: { previewToken: stalePreview.token, confirm: true } },
  );
  expect(staleConfirm.status()).toBe(409);
  expect(
    (await db.delivery.findUniqueOrThrow({ where: { id: staleDeliveryId } }))
      .status,
  ).toBe("pending");
  const outsiderJwt = await new SignJWT({
    sub: outsiderId,
    email: `${outsiderId}@test.invalid`,
    role: "fleet_manager",
    purpose: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  const crossTenant = await request.post(
    `${baseURL}/api/assistant/actions/execute`,
    {
      headers: {
        ...headers,
        cookie: `token=${outsiderJwt}; fleetflow_team=${teamId}`,
      },
      data: {
        action: {
          type: "update_delivery_status",
          deliveryId,
          values: { status: "pending" },
          expectedUpdatedAt: delivery.updatedAt.toISOString(),
        },
        sourceFindingId: findingId,
      },
    },
  );
  expect(crossTenant.status()).toBe(403);
  await db.intelligenceFinding.delete({ where: { id: findingId } });
  const deletedSource = await request.post(
    `${baseURL}/api/assistant/actions/execute`,
    { headers, data: { previewToken: preview.token, confirm: true } },
  );
  expect(deletedSource.status()).toBe(409);
});
