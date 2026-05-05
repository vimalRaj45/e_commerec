const { statusUpdateSchema } = require('../schemas/zod');
const { generateBillPDF } = require('../services/pdf');
const { sendEmailAsync } = require('../services/email');

async function adminOrderRoutes(fastify, opts) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOwner);

  // List all orders
  fastify.get('/', async (request, reply) => {
    const { status, paymentStatus, page = 1, limit = 20 } = request.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
    };

    const [orders, total] = await Promise.all([
      fastify.prisma.order.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { items: true }
      }),
      fastify.prisma.order.count({ where }),
    ]);

    return { success: true, data: { orders, total, page: Number(page), limit: Number(limit) } };
  });

  // Get full order details
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    return { success: true, data: order };
  });

  // Update order status
  fastify.patch('/:id/status', async (request, reply) => {
    const { id } = request.params;
    const { status } = statusUpdateSchema.parse(request.body);

    const order = await fastify.prisma.order.findUnique({ where: { id } });
    if (!order) {
      return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    const updated = await fastify.prisma.order.update({
      where: { id },
      data: { status }
    });

    // Invalidate status cache
    await fastify.redis.del(`order:status:${id}`);

    // If Delivered, send email to customer
    if (status === 'DELIVERED' && order.customerEmail) {
      sendEmailAsync({
        to: order.customerEmail,
        subject: `Your order ${order.invoiceNumber} has been delivered`,
        html: `<h1>Thank you!</h1><p>Your order ${order.invoiceNumber} has been delivered. We hope you enjoy your purchase.</p>`,
        orderId: order.id,
        fastify
      });
    }

    return { success: true, data: updated };
  });

  // Generate PDF bill
  fastify.post('/:id/bill', async (request, reply) => {
    const { id } = request.params;
    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    const shop = await fastify.prisma.shop.findFirst();
    const doc = generateBillPDF(order, shop);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="invoice-${order.invoiceNumber}.pdf"`);
    
    return reply.send(doc);
  });
}

module.exports = adminOrderRoutes;
