const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSubscriptions() {
  try {
    console.log('Fetching all users...');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      const existing = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      if (existing) {
        console.log(`User ${user.email} already has subscription (${existing.status})`);
        skipped++;
        continue;
      }

      // Create trial subscription
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 365); // 1 year beta

      const subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: 'PER_USER',
          status: 'TRIAL',
          trialEndsAt,
        },
      });

      console.log(`Created trial subscription for ${user.email} (ID: ${subscription.id})`);
      created++;
    }

    console.log(`\nSummary: ${created} subscriptions created, ${skipped} already exist.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSubscriptions();