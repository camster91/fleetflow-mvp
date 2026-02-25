const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({})

async function seed() {
  console.log('No seed data configured. Add your own users via the registration endpoint or admin UI.')
}

// Export the seed function for Prisma
module.exports = { seed }

// Run seed if called directly
if (require.main === module) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
