const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚮 Starting database truncation...');

  try {
    // Delete in order of dependency
    const orderItems = await prisma.orderItem.deleteMany();
    console.log(`- Deleted ${orderItems.count} Order Items`);

    const orders = await prisma.order.deleteMany();
    console.log(`- Deleted ${orders.count} Orders`);

    const notifications = await prisma.notificationLog.deleteMany();
    console.log(`- Deleted ${notifications.count} Notifications`);

    const products = await prisma.product.deleteMany();
    console.log(`- Deleted ${products.count} Products`);

    console.log('✅ Truncation complete! (Users and Shop settings were preserved)');
  } catch (error) {
    console.error('❌ Truncation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
