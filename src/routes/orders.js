const { orderSchema } = require('../schemas/zod');
const { generateInvoiceNumber } = require('../services/invoice');
const { sendEmailAsync } = require('../services/email');
const config = require('../config');

async function orderRoutes(fastify, opts) {
  // Place Order (Authenticated Customer)
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const userId = request.user.id;

    const body = orderSchema.parse(request.body);
    const sessionId = request.cookies.cart_session;
    const shop = await fastify.prisma.shop.findFirst();

    const order = await fastify.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of body.items) {
        // SELECT FOR UPDATE equivalent in Prisma is using findUnique with select or findFirst
        // Note: Prisma doesn't have a direct "FOR UPDATE" in findUnique, but we can use raw query if needed.
        // However, we can use a combination of check and decrement with a WHERE clause for atomicity.
        
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product || !product.isActive || product.isDeleted) {
          throw new Error(`Product ${item.productId} not found or inactive`);
        }

        if (product.stock < item.quantity) {
          const err = new Error(`Out of stock: ${product.name}`);
          err.statusCode = 409;
          throw err;
        }

        // Decrement stock atomically
        const updatedProduct = await tx.product.update({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });

        if (!updatedProduct) {
          const err = new Error(`Out of stock: ${product.name}`);
          err.statusCode = 409;
          throw err;
        }

        const itemTotal = parseFloat(product.price) * item.quantity;
        subtotal += itemTotal;

        orderItemsData.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          size: item.size,
          hsnCode: product.hsnCode,
        });
      }

      const cgst = subtotal * 0.09;
      const sgst = subtotal * 0.09;
      const total = subtotal + cgst + sgst;

      const invoiceNumber = await generateInvoiceNumber(fastify.redis);

      const newOrder = await tx.order.create({
        data: {
          invoiceNumber,
          shopId: shop.id,
          userId: userId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail,
          customerAddress: body.customerAddress,
          deliveryType: body.deliveryType,
          paymentMethod: body.paymentMethod,
          subtotal,
          cgst,
          sgst,
          taxAmount: cgst + sgst,
          total,
          paymentStatus: body.paymentMethod === 'COD' ? 'COD' : 'PENDING',
          items: {
            create: orderItemsData
          }
        },
        include: { items: true }
      });

      return newOrder;
    });

    // Clear cart
    if (sessionId) {
      await fastify.redis.del(`cart:${sessionId}`);
    }

    // Send notification email to owner (Async)
    const emailHtml = `
      <h1>New Order #${order.invoiceNumber}</h1>
      <p>Customer: ${order.customerName}</p>
      <p>Phone: ${order.customerPhone}</p>
      <p>Total: ₹${order.total}</p>
      <p>Payment: ${order.paymentMethod}</p>
      <a href="${config.R2_PUBLIC_URL}/admin/orders.html">View Order</a>
    `;
    
    sendEmailAsync({
      to: config.OWNER_EMAIL,
      subject: `New Order #${order.invoiceNumber} — ${order.customerName}`,
      html: emailHtml,
      orderId: order.id,
      fastify
    });

    return { success: true, data: order };
  });

  // Get Order (Public - requires phone verification)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const { customerPhone } = request.query;

    if (!customerPhone) {
      return reply.code(400).send({ success: false, error: { code: 'PHONE_REQUIRED', message: 'Customer phone required' } });
    }

    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order || order.customerPhone !== customerPhone) {
      return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
    }

    return { success: true, data: order };
  });

  // Track Order Status
  fastify.get('/track/:id', async (request, reply) => {
    const { id } = request.params;
    
    // Check cache
    const cachedStatus = await fastify.redis.get(`order:status:${id}`);
    if (cachedStatus) return { success: true, data: typeof cachedStatus === 'string' ? JSON.parse(cachedStatus) : cachedStatus };

    try {
      const order = await fastify.prisma.order.findUnique({
        where: { id },
        select: { status: true, updatedAt: true, createdAt: true, invoiceNumber: true, total: true, subtotal: true, taxAmount: true, paymentMethod: true }
      });

      if (!order) {
        return reply.code(404).send({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } });
      }

      const result = {
        id,
        invoiceNumber: order.invoiceNumber,
        status: order.status,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        paymentMethod: order.paymentMethod,
        updatedAt: order.updatedAt,
        timeline: [
          { status: 'PLACED', time: order.createdAt },
        ]
      };

      await fastify.redis.set(`order:status:${id}`, JSON.stringify(result), { ex: 60 });

      return { success: true, data: result };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: { code: 'TRACKING_ERROR', message: 'Failed to fetch tracking details' } });
    }
  });
  
  // Get My Orders (Authenticated Customer)
  fastify.get('/my', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const orders = await fastify.prisma.order.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        createdAt: true,
        paymentStatus: true
      }
    });

    return { success: true, data: orders };
  });
}

module.exports = orderRoutes;
