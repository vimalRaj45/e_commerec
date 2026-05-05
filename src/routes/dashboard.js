async function dashboardRoutes(fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOwner);

  // Stats
  fastify.get('/stats', async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersToday, revenueToday, totalProducts, lowStockItems] = await Promise.all([
      fastify.prisma.order.count({ where: { createdAt: { gte: today } } }),
      fastify.prisma.order.aggregate({
        where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
        _sum: { total: true }
      }),
      fastify.prisma.product.count({ where: { isDeleted: false } }),
      fastify.prisma.product.count({ where: { stock: { lte: 5 }, isDeleted: false } }),
    ]);

    return {
      success: true,
      data: {
        ordersToday,
        revenueToday: revenueToday._sum.total || 0,
        totalProducts,
        lowStockItems,
      }
    };
  });

  // Charts
  fastify.get('/charts', async (request, reply) => {
    const { range = '7' } = request.query;
    const days = parseInt(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await fastify.prisma.order.findMany({
      where: { createdAt: { gte: startDate }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, total: true }
    });

    // Group by day
    const chartData = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      chartData[dateStr] = { date: dateStr, revenue: 0, count: 0 };
    }

    orders.forEach(order => {
      const dateStr = order.createdAt.toISOString().split('T')[0];
      if (chartData[dateStr]) {
        chartData[dateStr].revenue += parseFloat(order.total);
        chartData[dateStr].count += 1;
      }
    });

    return { success: true, data: Object.values(chartData).reverse() };
  });
}

module.exports = dashboardRoutes;
